import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

const { parseResearchInput } = await import("@/lib/seo/keywords/service");
const { publicErrorMessage, statusForError } = await import("@/lib/platform/http");
const { DataforseoError } = await import("@/lib/providers/dataforseo/client");
const { InsufficientCreditsError } = await import("@/lib/credits/ledger");

describe("parseResearchInput", () => {
	it("normalizes the seed and applies defaults", () => {
		expect(parseResearchInput({ siteId: "x", keyword: "  Best   SEO Tools " })).toEqual({ keyword: "best seo tools", mode: "suggestions", locationCode: 2840, languageCode: "en", limit: 50 });
	});
	it("clamps the limit and rejects junk modes, locations and languages", () => {
		expect(parseResearchInput({ siteId: "x", keyword: "k", limit: 5000, mode: "drop table", locationCode: -1, languageCode: "../" })).toMatchObject({ limit: 200, mode: "suggestions", locationCode: 2840, languageCode: "en" });
		expect(parseResearchInput({ siteId: "x", keyword: "k", limit: 1 }).limit).toBe(10);
	});
	it("refuses empty and overlong seeds", () => {
		expect(() => parseResearchInput({ siteId: "x", keyword: "   " })).toThrow(/seed keyword/);
		expect(() => parseResearchInput({ siteId: "x", keyword: "a".repeat(81) })).toThrow(/80/);
	});
});

describe("error exposure", () => {
	it("maps provider errors to fixed wording without the provider body", () => {
		const error = new DataforseoError("auth_failed", "DataForSEO HTTP 401 on /v3/x: secret detail");
		expect(publicErrorMessage(error)).not.toContain("secret detail");
		expect(statusForError(error)).toBe(502);
		expect(statusForError(new DataforseoError("rate_limited", "x"))).toBe(429);
	});
	it("shows credit errors to the user with 402", () => {
		const error = new InsufficientCreditsError(20, 3);
		expect(publicErrorMessage(error)).toContain("20 credits");
		expect(statusForError(error)).toBe(402);
	});
});
