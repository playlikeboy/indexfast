import { describe, expect, it } from "vitest";
import { canSubmitSitemaps, gscSitemapEndpoint, isGoogleDailyQuotaMessage, matchGscProperty, parseInspectionResponse, readGoogleError } from "../gsc";

const properties = [
	{ siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
	{ siteUrl: "https://blog.example.com/", permissionLevel: "siteFullUser" },
	{ siteUrl: "https://other.dev/", permissionLevel: "siteUnverifiedUser" },
	{ siteUrl: "http://plain.io/", permissionLevel: "siteRestrictedUser" },
];

describe("matchGscProperty", () => {
	it("prefers the domain property, which covers subdomains", () => {
		expect(matchGscProperty(properties, "www.example.com")?.siteUrl).toBe("sc-domain:example.com");
		expect(matchGscProperty(properties, "blog.example.com")?.siteUrl).toBe("sc-domain:example.com");
		expect(matchGscProperty(properties, "notexample.com")).toBeNull();
	});

	it("falls back to an exact URL-prefix property and ignores unverified ones", () => {
		expect(matchGscProperty(properties, "plain.io")?.siteUrl).toBe("http://plain.io/");
		expect(matchGscProperty(properties, "other.dev")).toBeNull();
	});

	it("permission levels gate sitemap submission", () => {
		expect(canSubmitSitemaps("siteOwner")).toBe(true);
		expect(canSubmitSitemaps("siteRestrictedUser")).toBe(false);
	});
});

describe("Search Console payloads", () => {
	it("encodes property and feed path in the sitemap endpoint", () => {
		expect(gscSitemapEndpoint("sc-domain:example.com", "https://example.com/sitemap.xml")).toBe(
			"https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/sitemaps/https%3A%2F%2Fexample.com%2Fsitemap.xml",
		);
	});

	it("maps inspection verdicts onto indexing status", () => {
		const indexed = parseInspectionResponse({
			inspectionResult: { inspectionResultLink: "https://search.google.com/x", indexStatusResult: { verdict: "PASS", coverageState: "Submitted and indexed", lastCrawlTime: "2026-10-30T10:00:00Z" } },
		});
		expect(indexed).toMatchObject({ indexingStatus: "indexed", gscStatus: "Submitted and indexed", inspectionResultLink: "https://search.google.com/x" });
		const blocked = parseInspectionResponse({ inspectionResult: { indexStatusResult: { verdict: "FAIL", indexingState: "BLOCKED_BY_META_TAG", coverageState: "Excluded by 'noindex' tag" } } });
		expect(blocked.indexingStatus).toBe("blockers");
		const excluded = parseInspectionResponse({ inspectionResult: { indexStatusResult: { verdict: "NEUTRAL", coverageState: "Discovered - currently not indexed" } } });
		expect(excluded.indexingStatus).toBe("not_indexed");
		expect(parseInspectionResponse({}).indexingStatus).toBe("unknown");
	});

	it("reads Google error bodies and tells daily from per-minute quota", () => {
		const body = JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'" } });
		const message = readGoogleError(429, body);
		expect(message).toContain("RESOURCE_EXHAUSTED");
		expect(isGoogleDailyQuotaMessage(message)).toBe(true);
		expect(isGoogleDailyQuotaMessage("limit 'Queries per minute'")).toBe(false);
	});
});
