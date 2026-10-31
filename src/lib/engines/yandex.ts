/**
 * Yandex Webmaster API v4 clients for the recrawl queue. The user pastes an OAuth token; we
 * resolve their Yandex user id and the host id of the site, read the daily recrawl quota and
 * never send more than it allows. Pure HTTP + parsing, no DB.
 */
import { YANDEX_API_BASE } from "@/lib/automation/constants";
import { parseRetryAfterHeader, type EngineSubmissionResult } from "@/lib/automation/search-engines";
import { secondsUntilMidnight } from "./quota-windows";

const TIMEOUT_MS = 20_000;
export const YANDEX_TIME_ZONE = "Europe/Moscow";

async function yandexFetch(token: string, path: string, init: RequestInit = {}) {
	const response = await fetch(`${YANDEX_API_BASE}${path}`, {
		...init,
		headers: { Authorization: `OAuth ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	const body = await response.text().catch(() => "");
	let json: Record<string, unknown> = {};
	try {
		json = JSON.parse(body) as Record<string, unknown>;
	} catch {
		// Error pages are not JSON.
	}
	return { response, body, json };
}

function errorMessage(status: number, json: Record<string, unknown>, body: string) {
	const code = typeof json.error_code === "string" ? json.error_code : "";
	const message = typeof json.error_message === "string" ? json.error_message : "";
	return [code, message].filter(Boolean).join(": ") || body.slice(0, 300) || `Yandex returned HTTP ${status}.`;
}

export async function getYandexUserId(token: string): Promise<EngineSubmissionResult & { userId?: string }> {
	const { response, body, json } = await yandexFetch(token, "/user");
	const userId = json.user_id;
	if (!response.ok || (typeof userId !== "number" && typeof userId !== "string")) {
		return { ok: false, status: response.status, message: errorMessage(response.status, json, body) };
	}
	return { ok: true, status: response.status, message: "Token accepted.", userId: String(userId) };
}

export type YandexHost = { hostId: string; asciiHostUrl: string; verified: boolean };

export function parseYandexHosts(json: unknown): YandexHost[] {
	const hosts = (json && typeof json === "object" ? (json as { hosts?: unknown }).hosts : undefined) ?? [];
	if (!Array.isArray(hosts)) return [];
	return hosts
		.filter((host): host is Record<string, unknown> => Boolean(host) && typeof host === "object")
		.filter((host) => typeof host.host_id === "string" && typeof host.ascii_host_url === "string")
		.map((host) => ({ hostId: host.host_id as string, asciiHostUrl: host.ascii_host_url as string, verified: host.verified === true }));
}

export async function listYandexHosts(token: string, userId: string): Promise<EngineSubmissionResult & { hosts: YandexHost[] }> {
	const { response, body, json } = await yandexFetch(token, `/user/${encodeURIComponent(userId)}/hosts`);
	if (!response.ok) return { ok: false, status: response.status, message: errorMessage(response.status, json, body), hosts: [] };
	return { ok: true, status: response.status, message: "Listed hosts.", hosts: parseYandexHosts(json) };
}

/** Exact host match (Yandex lists http and https separately); a verified https host wins. */
export function matchYandexHost(hosts: YandexHost[], host: string): YandexHost | null {
	const candidates = hosts.filter((entry) => {
		try {
			return new URL(entry.asciiHostUrl).hostname.toLowerCase() === host.toLowerCase();
		} catch {
			return false;
		}
	});
	const score = (entry: YandexHost) => (entry.verified ? 2 : 0) + (entry.asciiHostUrl.startsWith("https:") ? 1 : 0);
	return candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
}

function hostPath(userId: string, hostId: string) {
	return `/user/${encodeURIComponent(userId)}/hosts/${encodeURIComponent(hostId)}`;
}

export function parseYandexQuota(json: unknown) {
	const record = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
	return {
		dailyQuota: typeof record.daily_quota === "number" ? record.daily_quota : null,
		remainder: typeof record.quota_remainder === "number" ? record.quota_remainder : null,
	};
}

export async function getYandexRecrawlQuota(token: string, userId: string, hostId: string) {
	const { response, body, json } = await yandexFetch(token, `${hostPath(userId, hostId)}/recrawl/quota`);
	if (!response.ok) return { ok: false, status: response.status, message: errorMessage(response.status, json, body), dailyQuota: null, remainder: null };
	return { ok: true, status: response.status, message: "Quota read.", ...parseYandexQuota(json) };
}

/**
 * Queue one URL for recrawl. QUOTA_EXCEEDED is reported as 429 with a Retry-After until
 * Moscow midnight, so the shared queue throttle parks the site's Yandex jobs until then.
 */
export async function submitYandexRecrawl(token: string, userId: string, hostId: string, url: string): Promise<EngineSubmissionResult> {
	const { response, body, json } = await yandexFetch(token, `${hostPath(userId, hostId)}/recrawl/queue`, {
		method: "POST",
		body: JSON.stringify({ url }),
	});
	if (response.ok) {
		const remainder = typeof json.quota_remainder === "number" ? ` ${json.quota_remainder} recrawls left today.` : "";
		return { ok: true, status: response.status, message: `Queued for recrawl.${remainder}` };
	}
	const message = errorMessage(response.status, json, body);
	const quota = response.status === 429 || /QUOTA_EXCEEDED|TOO_MANY_REQUESTS/i.test(message);
	return {
		ok: false,
		status: quota ? 429 : response.status,
		message,
		retryAfterSeconds: quota ? secondsUntilMidnight(YANDEX_TIME_ZONE) : parseRetryAfterHeader(response.headers.get("retry-after")),
	};
}
