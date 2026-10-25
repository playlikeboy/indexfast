import { describe, expect, it } from "vitest";
import { buildBingBatchPayload, isBingThrottled } from "../search-engines";
import { isRetryable } from "../service";

describe("Bing automation utilities", () => {
	it("formats Bing batch payload with siteUrl and urlList", () => {
		const urls = [
			"https://example.com/blog/article-1",
			"https://example.com/blog/article-2",
		];
		const payload = buildBingBatchPayload("https://example.com", urls);

		expect(payload).toEqual({
			siteUrl: "https://example.com",
			urlList: urls,
		});
		expect(payload.urlList).toHaveLength(2);
	});

	it("correctly parses JSON response from Bing GetUrlSubmissionQuota", () => {
		const rawBingResponse = JSON.stringify({
			d: {
				DailyQuota: 10000,
				MonthlyQuota: 1000000,
			},
		});

		const parsed = JSON.parse(rawBingResponse);
		const data = parsed?.d || parsed;

		expect(data.DailyQuota).toBe(10000);
		expect(data.MonthlyQuota).toBe(1000000);
	});

	it("handles alternative flat Bing quota response format", () => {
		const flatResponse = JSON.stringify({
			DailyQuota: 5000,
			MonthlyQuota: 250000,
		});

		const parsed = JSON.parse(flatResponse);
		const data = parsed?.d || parsed;

		expect(data.DailyQuota).toBe(5000);
	});

	it("detects Bing ThrottleIP and ErrorCode 17 as rate limit", () => {
		const throttleResponse = JSON.stringify({
			ErrorCode: 17,
			Message: "ERROR!!! ThrottleIP",
		});

		expect(isBingThrottled(400, throttleResponse)).toBe(true);
		expect(isBingThrottled(429, "")).toBe(true);
		expect(isBingThrottled(200, "OK")).toBe(false);

		// isRetryable must recognize ThrottleIP
		expect(isRetryable({ ok: false, status: 400, message: throttleResponse })).toBe(true);
		expect(isRetryable({ ok: false, status: 429, message: "Rate limit" })).toBe(true);
	});
});
