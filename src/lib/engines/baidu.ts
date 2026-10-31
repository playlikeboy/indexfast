/**
 * Baidu Ziyuan (Search Resource Platform) URL push API. One POST carries newline-separated
 * URLs; the answer says how many were accepted and how many remain in today's quota. There
 * is no quota endpoint, so the remain count from each answer is what limits the next push.
 * Pure HTTP + parsing, no DB.
 */
import { BAIDU_PUSH_ENDPOINT } from "@/lib/automation/constants";
import type { EngineSubmissionResult } from "@/lib/automation/search-engines";
import { secondsUntilMidnight } from "./quota-windows";

export const BAIDU_TIME_ZONE = "Asia/Shanghai";

export function buildBaiduPushUrl(host: string, token: string) {
	return `${BAIDU_PUSH_ENDPOINT}?site=${encodeURIComponent(`https://${host}`)}&token=${encodeURIComponent(token)}`;
}

export type BaiduPushResult = EngineSubmissionResult & { remain?: number; accepted?: number };

/** {"remain":n,"success":n,"not_same_site":[],"not_valid":[]} or {"error":400,"message":"over quota"}. */
export function parseBaiduResponse(status: number, body: string): BaiduPushResult {
	let json: Record<string, unknown> = {};
	try {
		json = JSON.parse(body) as Record<string, unknown>;
	} catch {
		return { ok: false, status: status || 502, message: body.slice(0, 300) || `Baidu returned HTTP ${status}.` };
	}
	if (typeof json.error === "number" || typeof json.message === "string") {
		const message = typeof json.message === "string" ? json.message : `Baidu error ${String(json.error)}`;
		const overQuota = /over quota/i.test(message);
		return {
			ok: false,
			status: overQuota ? 429 : typeof json.error === "number" ? json.error : status,
			message: overQuota ? "Baidu daily push quota is used up (over quota)." : message,
			remain: overQuota ? 0 : undefined,
			retryAfterSeconds: overQuota ? secondsUntilMidnight(BAIDU_TIME_ZONE) : undefined,
		};
	}
	const accepted = typeof json.success === "number" ? json.success : 0;
	const remain = typeof json.remain === "number" ? json.remain : undefined;
	const notSameSite = Array.isArray(json.not_same_site) ? json.not_same_site.length : 0;
	const notValid = Array.isArray(json.not_valid) ? json.not_valid.length : 0;
	const rejected = notSameSite + notValid > 0 ? ` Rejected: ${notSameSite} not on this site, ${notValid} invalid.` : "";
	return {
		ok: status >= 200 && status < 300,
		status,
		message: `Baidu accepted ${accepted} URL(s).${remain !== undefined ? ` ${remain} left today.` : ""}${rejected}`,
		remain,
		accepted,
	};
}

export async function submitBaiduUrls(host: string, token: string, urls: string[]): Promise<BaiduPushResult> {
	const response = await fetch(buildBaiduPushUrl(host, token), {
		method: "POST",
		headers: { "Content-Type": "text/plain" },
		body: urls.join("\n"),
		signal: AbortSignal.timeout(20_000),
	});
	return parseBaiduResponse(response.status, await response.text().catch(() => ""));
}
