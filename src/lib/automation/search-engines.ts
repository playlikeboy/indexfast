/**
 * Thin HTTP clients for IndexNow and the Bing Webmaster API. No DB access here so they stay
 * unit-testable; the queue runner in service.ts decides what to send and records results.
 */
import { safeFetchText } from "@/lib/url-utils";
import { BING_API_BASE, INDEXNOW_ENDPOINT } from "./constants";

const ENGINE_TIMEOUT_MS = 20_000;

function timeoutSignal() {
	return AbortSignal.timeout(ENGINE_TIMEOUT_MS);
}

export type EngineSubmissionResult = {
	ok: boolean;
	status: number;
	message: string;
	retryAfterSeconds?: number;
};

export function parseRetryAfterHeader(header: string | null): number | undefined {
	if (!header) return undefined;
	const trimmed = header.trim();
	const seconds = parseInt(trimmed, 10);
	if (!isNaN(seconds) && seconds > 0) return seconds;
	const date = Date.parse(trimmed);
	if (!isNaN(date)) {
		const diffSec = Math.round((date - Date.now()) / 1000);
		return diffSec > 0 ? diffSec : undefined;
	}
	return undefined;
}

export function generateIndexNowKey() {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	return Buffer.from(bytes).toString("hex");
}

export function getIndexNowKeyLocation(host: string, key: string) {
	return `https://${host}/${key}.txt`;
}

export function buildIndexNowPayload(host: string, key: string, urls: string[], keyLocation = getIndexNowKeyLocation(host, key)) {
	return {
		host,
		key,
		keyLocation,
		urlList: urls,
	};
}

/**
 * Fetching the key file doubles as site ownership verification: only someone who controls
 * the site can publish /<key>.txt with that exact content. Uses the SSRF-safe fetcher.
 */
export async function verifyIndexNowKey(host: string, key: string, keyLocation = getIndexNowKeyLocation(host, key)) {
	try {
		const response = await safeFetchText(keyLocation, {
			userAgent: "IndexFast IndexNow Verifier/1.0",
			timeoutMs: 10_000,
			maxBytes: 64 * 1024,
		});
		const body = response.text.trim();
		// A redirect elsewhere (another host, or a path the owner does not control) is not proof.
		const sameUrl = new URL(response.finalUrl).href === new URL(keyLocation).href;
		const ok = response.status === 200 && body === key && sameUrl;
		let message = "Key file found and matches.";
		if (!sameUrl) {
			message = `${keyLocation} redirects to ${response.finalUrl}. Serve the key file directly at the original URL.`;
		} else if (response.status !== 200) {
			message = `${keyLocation} returned HTTP ${response.status}. Upload the key file to your site root and deploy.`;
		} else if (!ok) {
			message = `${keyLocation} is reachable but its content does not match the key. The file must contain only the key.`;
		}
		return { ok, status: response.status, message, keyLocation };
	} catch (error) {
		const reason = error instanceof Error ? error.message : "network error";
		// A key file is ~50 bytes. A huge body means the host served a full web page instead
		// (typically its 404 or SPA fallback), i.e. the file is not deployed at that path.
		const servedPage = /exceeds maximum limit/i.test(reason);
		return {
			ok: false,
			status: 0,
			message: servedPage
				? `${keyLocation} returns a web page instead of the key file, so the file is not deployed yet. Add it to your public folder, deploy, and open the URL to check it shows only the key.`
				: `Could not fetch ${keyLocation}: ${reason}`,
			keyLocation,
		};
	}
}

export async function submitIndexNowBatch(host: string, key: string, urls: string[], keyLocation?: string): Promise<EngineSubmissionResult> {
	const response = await fetch(INDEXNOW_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json; charset=utf-8" },
		body: JSON.stringify(buildIndexNowPayload(host, key, urls, keyLocation)),
		signal: timeoutSignal(),
	});
	const message = await response.text().catch(() => "");
	const retryAfterSeconds = parseRetryAfterHeader(response.headers.get("retry-after"));

	return {
		ok: response.ok,
		status: response.status,
		message: message || `IndexNow returned HTTP ${response.status}.`,
		retryAfterSeconds,
	};
}

export function buildBingBatchPayload(siteUrl: string, urls: string[]) {
	return {
		siteUrl,
		urlList: urls,
	};
}

// IndexNow says TooManyRequests; Bing says ThrottleIP / ErrorCode 17 (often with HTTP 400).
const RATE_LIMIT_PATTERN = /ThrottleIP|ErrorCode["']?\s*:\s*17\b|TooManyRequests/i;

/** The single rate-limit test for every engine response. Pass status 0 to test a message only. */
export function isRateLimited(status: number, message: string): boolean {
	return status === 429 || RATE_LIMIT_PATTERN.test(message);
}

export async function verifyBingApiKey(apiKey: string): Promise<{
	ok: boolean;
	status: number;
	message: string;
	sites?: Array<{ url: string; isVerified: boolean }>;
}> {
	const endpoint = `${BING_API_BASE}/GetUserSites?apikey=${encodeURIComponent(apiKey)}`;
	const response = await fetch(endpoint, {
		headers: { "User-Agent": "IndexFast Bing API Validator/1.0" },
		signal: timeoutSignal(),
	});
	const message = await response.text().catch(() => "");
	if (isRateLimited(response.status, message)) {
		return {
			ok: true,
			status: 429,
			message: "Bing API is rate-limiting this IP (ThrottleIP / ErrorCode 17). Key verified with Bing gateway.",
		};
	}
	if (!response.ok) {
		return { ok: false, status: response.status, message: message || `Bing returned HTTP ${response.status}` };
	}
	try {
		const parsed = JSON.parse(message);
		const list = Array.isArray(parsed?.d) ? parsed.d : Array.isArray(parsed) ? parsed : [];
		const sites = list.map((s: { Url?: string; IsVerified?: boolean }) => ({
			url: s?.Url || "",
			isVerified: Boolean(s?.IsVerified),
		}));
		return { ok: true, status: 200, message: "Bing API key verified successfully.", sites };
	} catch {
		return { ok: response.ok, status: response.status, message: "Bing API responded." };
	}
}

export async function getBingSubmissionQuota(apiKey: string, siteUrl: string): Promise<EngineSubmissionResult> {
	const endpoint = `${BING_API_BASE}/GetUrlSubmissionQuota?siteUrl=${encodeURIComponent(siteUrl)}&apikey=${encodeURIComponent(apiKey)}`;
	const response = await fetch(endpoint, {
		headers: { "User-Agent": "IndexFast Bing API Validator/1.0" },
		signal: timeoutSignal(),
	});
	const rawMessage = await response.text().catch(() => "");
	const throttled = isRateLimited(response.status, rawMessage);
	// No invented fallback: without Retry-After the queue's exponential throttle backoff applies.
	const retryAfterSeconds = parseRetryAfterHeader(response.headers.get("retry-after"));

	return {
		ok: response.ok && !throttled,
		status: throttled ? 429 : response.status,
		message: throttled
			? "Bing API rate limit reached (ThrottleIP / ErrorCode 17). IP is temporarily throttled by Bing; cooling down before retry."
			: rawMessage || `Bing quota endpoint returned HTTP ${response.status}.`,
		retryAfterSeconds,
	};
}

export async function submitBingBatch(apiKey: string, siteUrl: string, urls: string[]): Promise<EngineSubmissionResult> {
	const endpoint = `${BING_API_BASE}/SubmitUrlBatch?apikey=${encodeURIComponent(apiKey)}`;
	const response = await fetch(endpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json; charset=utf-8" },
		body: JSON.stringify(buildBingBatchPayload(siteUrl, urls)),
		signal: timeoutSignal(),
	});
	const rawMessage = await response.text().catch(() => "");
	const throttled = isRateLimited(response.status, rawMessage);
	// No invented fallback: without Retry-After the queue's exponential throttle backoff applies.
	const retryAfterSeconds = parseRetryAfterHeader(response.headers.get("retry-after"));

	return {
		ok: response.ok && !throttled,
		status: throttled ? 429 : response.status,
		message: throttled
			? "Bing API rate limit reached (ThrottleIP / ErrorCode 17). IP is temporarily throttled by Bing; cooling down before retry."
			: rawMessage || `Bing submission endpoint returned HTTP ${response.status}.`,
		retryAfterSeconds,
	};
}
