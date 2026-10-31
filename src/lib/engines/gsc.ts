/**
 * Google Search Console clients: list properties, match a site to its property, submit
 * sitemaps, and the URL Inspection API. Pure HTTP + parsing (no DB) so the response mapping
 * is unit tested; google-service.ts owns tokens, quotas and writes.
 *
 * Honesty rule: an inspection result is Google's own verdict, so it is the only signal that
 * may set urls.indexingStatus to "indexed". Our live diagnostics can only prove indexability.
 */
import { GSC_API_BASE, GSC_INSPECTION_ENDPOINT } from "@/lib/automation/constants";
import { parseRetryAfterHeader, type EngineSubmissionResult } from "@/lib/automation/search-engines";

const TIMEOUT_MS = 20_000;

export type GscProperty = { siteUrl: string; permissionLevel: string };

/** Google's JSON error body is {error:{code,message,status}}; fall back to the raw text. */
export function readGoogleError(status: number, body: string) {
	try {
		const parsed = JSON.parse(body) as { error?: { message?: string; status?: string } | string; error_description?: string };
		if (parsed.error && typeof parsed.error === "object") {
			return [parsed.error.status, parsed.error.message].filter(Boolean).join(": ") || `Google returned HTTP ${status}.`;
		}
		if (typeof parsed.error === "string") return [parsed.error, parsed.error_description].filter(Boolean).join(": ");
	} catch {
		// Not JSON.
	}
	return body.slice(0, 500) || `Google returned HTTP ${status}.`;
}

/** Google says RESOURCE_EXHAUSTED for both minute and daily quotas; only the text tells them apart. */
export function isGoogleDailyQuotaMessage(message: string) {
	return /per day|daily/i.test(message);
}

async function googleFetch(accessToken: string, url: string, init: RequestInit = {}) {
	const response = await fetch(url, {
		...init,
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	const body = await response.text().catch(() => "");
	return { response, body };
}

function toResult(response: Response, body: string, okMessage: string): EngineSubmissionResult {
	return {
		ok: response.ok,
		status: response.status,
		message: response.ok ? okMessage : readGoogleError(response.status, body),
		retryAfterSeconds: parseRetryAfterHeader(response.headers.get("retry-after")),
	};
}

export async function listGscProperties(accessToken: string): Promise<EngineSubmissionResult & { properties: GscProperty[] }> {
	const { response, body } = await googleFetch(accessToken, `${GSC_API_BASE}/sites`);
	const result = toResult(response, body, "Listed Search Console properties.");
	if (!response.ok) return { ...result, properties: [] };
	try {
		const entries = (JSON.parse(body) as { siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> }).siteEntry ?? [];
		return {
			...result,
			properties: entries
				.filter((entry) => typeof entry.siteUrl === "string")
				.map((entry) => ({ siteUrl: entry.siteUrl as string, permissionLevel: entry.permissionLevel ?? "siteUnverifiedUser" })),
		};
	} catch {
		return { ...result, properties: [] };
	}
}

/**
 * The property that covers a site's exact host. A Domain property (sc-domain:example.com)
 * covers every subdomain and protocol, so the most specific one wins; otherwise an exact
 * URL-prefix property for the host (https first). Unverified entries cannot be used.
 */
export function matchGscProperty(properties: GscProperty[], host: string): GscProperty | null {
	const cleanHost = host.toLowerCase();
	const usable = properties.filter((property) => property.permissionLevel !== "siteUnverifiedUser");
	const domainMatch = usable
		.filter((property) => property.siteUrl.startsWith("sc-domain:"))
		.map((property) => ({ property, domain: property.siteUrl.slice("sc-domain:".length).toLowerCase() }))
		.filter(({ domain }) => cleanHost === domain || cleanHost.endsWith(`.${domain}`))
		.sort((a, b) => b.domain.length - a.domain.length)[0];
	if (domainMatch) return domainMatch.property;
	for (const prefix of [`https://${cleanHost}/`, `http://${cleanHost}/`]) {
		const match = usable.find((property) => property.siteUrl.toLowerCase() === prefix);
		if (match) return match;
	}
	return null;
}

/** Owners and full users may submit sitemaps; the Indexing API needs a verified owner. */
export function canSubmitSitemaps(permissionLevel: string) {
	return permissionLevel === "siteOwner" || permissionLevel === "siteFullUser";
}

export function isPropertyOwner(permissionLevel: string) {
	return permissionLevel === "siteOwner";
}

export function gscSitemapEndpoint(property: string, sitemapUrl: string) {
	return `${GSC_API_BASE}/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
}

export async function submitGscSitemap(accessToken: string, property: string, sitemapUrl: string): Promise<EngineSubmissionResult> {
	const { response, body } = await googleFetch(accessToken, gscSitemapEndpoint(property, sitemapUrl), { method: "PUT" });
	return toResult(response, body, `Sitemap submitted to Search Console (${property}).`);
}

export type IndexingStatus = "indexed" | "not_indexed" | "blockers" | "unknown";

export type InspectionSummary = {
	verdict: string;
	coverageState: string | null;
	indexingState: string | null;
	robotsTxtState: string | null;
	pageFetchState: string | null;
	lastCrawlTime: string | null;
	googleCanonical: string | null;
	userCanonical: string | null;
	inspectionResultLink: string | null;
	gscStatus: string; // Stored in urls.gscStatus: Google's coverage text, e.g. "Submitted and indexed"
	indexingStatus: IndexingStatus;
};

const BLOCKING_INDEXING_STATES = new Set(["BLOCKED_BY_META_TAG", "BLOCKED_BY_HTTP_HEADER", "BLOCKED_BY_ROBOTS_TXT"]);
const BLOCKING_FETCH_STATES = new Set(["SOFT_404", "BLOCKED_ROBOTS_TXT", "NOT_FOUND", "ACCESS_DENIED", "SERVER_ERROR", "REDIRECT_ERROR", "ACCESS_FORBIDDEN", "BLOCKED_4XX", "INTERNAL_CRAWL_ERROR", "INVALID_URL"]);

function stringOrNull(value: unknown) {
	return typeof value === "string" && value ? value : null;
}

/** Map an index:inspect response onto our columns. PARTIAL is a legacy "valid with warnings". */
export function parseInspectionResponse(json: unknown): InspectionSummary {
	const root = (json && typeof json === "object" ? json : {}) as { inspectionResult?: Record<string, unknown> };
	const result = root.inspectionResult ?? {};
	const index = (result.indexStatusResult && typeof result.indexStatusResult === "object" ? result.indexStatusResult : {}) as Record<string, unknown>;
	const verdict = stringOrNull(index.verdict) ?? "VERDICT_UNSPECIFIED";
	const summary = {
		verdict,
		coverageState: stringOrNull(index.coverageState),
		indexingState: stringOrNull(index.indexingState),
		robotsTxtState: stringOrNull(index.robotsTxtState),
		pageFetchState: stringOrNull(index.pageFetchState),
		lastCrawlTime: stringOrNull(index.lastCrawlTime),
		googleCanonical: stringOrNull(index.googleCanonical),
		userCanonical: stringOrNull(index.userCanonical),
		inspectionResultLink: stringOrNull(result.inspectionResultLink),
	};
	let indexingStatus: IndexingStatus = "unknown";
	if (verdict === "PASS" || verdict === "PARTIAL") {
		indexingStatus = "indexed";
	} else if (
		BLOCKING_INDEXING_STATES.has(summary.indexingState ?? "") ||
		summary.robotsTxtState === "DISALLOWED" ||
		BLOCKING_FETCH_STATES.has(summary.pageFetchState ?? "")
	) {
		indexingStatus = "blockers";
	} else if (verdict === "FAIL" || verdict === "NEUTRAL") {
		indexingStatus = "not_indexed";
	}
	return { ...summary, gscStatus: summary.coverageState ?? verdict, indexingStatus };
}

export async function inspectGscUrl(
	accessToken: string,
	property: string,
	url: string,
): Promise<EngineSubmissionResult & { inspection?: InspectionSummary }> {
	const { response, body } = await googleFetch(accessToken, GSC_INSPECTION_ENDPOINT, {
		method: "POST",
		body: JSON.stringify({ inspectionUrl: url, siteUrl: property, languageCode: "en-US" }),
	});
	const result = toResult(response, body, "Inspected.");
	if (!response.ok) return result;
	try {
		return { ...result, inspection: parseInspectionResponse(JSON.parse(body)) };
	} catch {
		return { ...result, ok: false, status: 502, message: "Search Console returned an unreadable inspection result." };
	}
}
