import { describe, expect, it, vi } from "vitest";
import { assertOkTask, DataforseoError, responseCostUsd } from "@/lib/providers/dataforseo/client";
import { fetchKeywordResearch, keywordTaskBody, normalizeIntent, rowsFromLabsResult, toKeywordRow } from "@/lib/providers/dataforseo/labs";
import { platformDataforseoCredentials } from "@/lib/providers/credentials";
import { _stableStringifyForTests, providerCacheKey } from "@/lib/providers/cache";

const creds = { login: "a@b.c", password: "pw", source: "platform" as const };
const item = (keyword: string, volume = 100) => ({
	keyword,
	keyword_info: { search_volume: volume, cpc: 1.5, competition: 0.4, monthly_searches: [{ year: 2026, month: 10, search_volume: 90 }] },
	keyword_properties: { keyword_difficulty: 33 },
	search_intent_info: { main_intent: "commercial" },
});

describe("assertOkTask", () => {
	it("returns the task on success and treats no-results as empty success", () => {
		expect(assertOkTask({ status_code: 20000, tasks: [{ status_code: 20000 }] }).status_code).toBe(20000);
		expect(assertOkTask({ status_code: 20000, tasks: [{ status_code: 40501, status_message: "No Search Results." }] }).status_code).toBe(40501);
	});
	it("carries the charged cost on a failed but billed task", () => {
		try {
			assertOkTask({ status_code: 20000, tasks: [{ status_code: 40501, status_message: "Invalid Field: 'location_code'.", cost: 0.01 }] });
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(DataforseoError);
			expect((error as DataforseoError).code).toBe("invalid_request");
			expect((error as DataforseoError).chargedCostUsd).toBe(0.01);
		}
	});
	it("classifies provider outages and balance problems", () => {
		expect(() => assertOkTask({ status_code: 50000, status_message: "Internal Error." })).toThrow(expect.objectContaining({ code: "upstream_unavailable" }));
		expect(() => assertOkTask({ status_code: 20000, tasks: [{ status_code: 40200, status_message: "Payment Required." }] })).toThrow(expect.objectContaining({ code: "auth_failed" }));
	});
	it("sums cost from the response", () => {
		expect(responseCostUsd({ cost: 0.02 })).toBe(0.02);
		expect(responseCostUsd({ tasks: [{ cost: 0.01 }, { cost: 0.005 }] })).toBeCloseTo(0.015);
	});
});

describe("labs normalization", () => {
	it("maps a Labs item to a keyword row", () => {
		expect(toKeywordRow(item("  SEO  Tool "))).toEqual({
			keyword: "seo tool",
			searchVolume: 100,
			cpc: 1.5,
			competition: 0.4,
			keywordDifficulty: 33,
			intent: "commercial",
			monthlySearches: [{ year: 2026, month: 10, volume: 90 }],
		});
		expect(toKeywordRow({ keyword: "" })).toBeNull();
	});
	it("unwraps related_keywords, puts the suggestions seed first, dedupes and limits", () => {
		expect(rowsFromLabsResult("related", { items: [{ keyword_data: item("a") }, { keyword_data: item("a") }, { keyword_data: item("b") }] }, 10).map((r) => r.keyword)).toEqual(["a", "b"]);
		expect(rowsFromLabsResult("suggestions", { seed_keyword_data: item("seed"), items: [item("x"), item("y")] }, 2).map((r) => r.keyword)).toEqual(["seed", "x"]);
	});
	it("normalizes intent labels", () => {
		expect(normalizeIntent("Informational")).toBe("informational");
		expect(normalizeIntent(null)).toBe("unknown");
	});
	it("never asks for clickstream data (it doubles the price)", () => {
		for (const mode of ["related", "suggestions", "ideas"] as const) {
			expect(keywordTaskBody(mode, { keyword: "k", locationCode: 2840, languageCode: "en", limit: 50 }).include_clickstream_data).toBe(false);
		}
		expect(keywordTaskBody("ideas", { keyword: "k", locationCode: 2840, languageCode: "en", limit: 50 })).toMatchObject({ keywords: ["k"] });
	});
	it("posts with Basic auth and returns rows with the reported cost", async () => {
		const fetchImpl = vi.fn(async () => Response.json({ status_code: 20000, cost: 0.0105, tasks: [{ status_code: 20000, cost: 0.0105, result: [{ items: [item("a"), item("b")] }] }] }));
		const result = await fetchKeywordResearch(creds, "ideas", { keyword: "k", locationCode: 2840, languageCode: "en", limit: 50 }, fetchImpl as unknown as typeof fetch);
		expect(result.rows).toHaveLength(2);
		expect(result.costUsd).toBe(0.0105);
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live");
		expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("a@b.c:pw")}`);
	});
	it("does not retry an HTTP 401 and reports auth_failed", async () => {
		const fetchImpl = vi.fn(async () => new Response("no", { status: 401 }));
		await expect(fetchKeywordResearch(creds, "related", { keyword: "k", locationCode: 2840, languageCode: "en", limit: 10 }, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ code: "auth_failed" });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});
});

describe("platform credentials", () => {
	it("reads login+password or a base64 key, else null", () => {
		expect(platformDataforseoCredentials({ DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p" })).toEqual({ login: "l", password: "p", source: "platform" });
		expect(platformDataforseoCredentials({ DATAFORSEO_API_KEY: btoa("l2:p:2") })).toEqual({ login: "l2", password: "p:2", source: "platform" });
		expect(platformDataforseoCredentials({ DATAFORSEO_API_KEY: "%%%" })).toBeNull();
		expect(platformDataforseoCredentials({})).toBeNull();
	});
});

describe("provider cache key", () => {
	it("is stable across key order and ignores undefined", async () => {
		expect(_stableStringifyForTests({ b: 1, a: [2, { d: undefined, c: 3 }] })).toBe('{"a":[2,{"c":3}],"b":1}');
		expect(await providerCacheKey("p", "/e", { a: 1, b: 2 })).toBe(await providerCacheKey("p", "/e", { b: 2, a: 1 }));
		expect(await providerCacheKey("p", "/e", { a: 1 })).not.toBe(await providerCacheKey("p", "/other", { a: 1 }));
	});
});
