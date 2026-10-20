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
};

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
		return {
			ok: false,
			status: 0,
			message: `Could not fetch ${keyLocation}: ${error instanceof Error ? error.message : "network error"}`,
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

	return {
		ok: response.ok,
		status: response.status,
		message: message || `IndexNow returned HTTP ${response.status}.`,
	};
}

export function buildBingBatchPayload(siteUrl: string, urls: string[]) {
	return {
		siteUrl,
		urlList: urls,
	};
}

export async function getBingSubmissionQuota(apiKey: string, siteUrl: string): Promise<EngineSubmissionResult> {
	const endpoint = `${BING_API_BASE}/GetUrlSubmissionQuota?siteUrl=${encodeURIComponent(siteUrl)}&apikey=${encodeURIComponent(apiKey)}`;
	const response = await fetch(endpoint, {
		headers: { "User-Agent": "IndexFast Bing API Validator/1.0" },
		signal: timeoutSignal(),
	});
	const message = await response.text().catch(() => "");

	return {
		ok: response.ok,
		status: response.status,
		message: message || `Bing quota endpoint returned HTTP ${response.status}.`,
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
	const message = await response.text().catch(() => "");

	return {
		ok: response.ok,
		status: response.status,
		message: message || `Bing submission endpoint returned HTTP ${response.status}.`,
	};
}
