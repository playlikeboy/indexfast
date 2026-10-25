import { describe, expect, it } from "vitest";
import { calculateBackoffMs, groupSubmissionJobs } from "../service";
import { parseRetryAfterHeader } from "../search-engines";
import { AUTOMATION_LIMITS } from "../constants";

describe("submission queue batching and retry isolation", () => {
	it("isolates jobs with different retry attempts into separate batches", () => {
		const jobs = [
			{ id: "job-1", siteId: "site-a", engine: "indexnow", attempts: 0, loc: "https://example.com/1" },
			{ id: "job-2", siteId: "site-a", engine: "indexnow", attempts: 2, loc: "https://example.com/2" },
			{ id: "job-3", siteId: "site-a", engine: "indexnow", attempts: 0, loc: "https://example.com/3" },
			{ id: "job-4", siteId: "site-a", engine: "indexnow", attempts: 1, loc: "https://example.com/4" },
		];

		const groups = groupSubmissionJobs(jobs);

		// Must have 3 separate groups: site-a:indexnow:0, site-a:indexnow:1, site-a:indexnow:2
		expect(groups.size).toBe(3);

		const attempt0Group = groups.get("site-a:indexnow:0");
		expect(attempt0Group).toBeDefined();
		expect(attempt0Group?.map((j) => j.id)).toEqual(["job-1", "job-3"]);

		const attempt1Group = groups.get("site-a:indexnow:1");
		expect(attempt1Group).toBeDefined();
		expect(attempt1Group?.map((j) => j.id)).toEqual(["job-4"]);

		const attempt2Group = groups.get("site-a:indexnow:2");
		expect(attempt2Group).toBeDefined();
		expect(attempt2Group?.map((j) => j.id)).toEqual(["job-2"]);
	});

	it("separates jobs across different engines and sites even with same attempts", () => {
		const jobs = [
			{ id: "job-1", siteId: "site-a", engine: "indexnow", attempts: 0, loc: "https://example.com/1" },
			{ id: "job-2", siteId: "site-a", engine: "bing", attempts: 0, loc: "https://example.com/2" },
			{ id: "job-3", siteId: "site-b", engine: "indexnow", attempts: 0, loc: "https://other.com/3" },
		];

		const groups = groupSubmissionJobs(jobs);
		expect(groups.size).toBe(3);
		expect(groups.has("site-a:indexnow:0")).toBe(true);
		expect(groups.has("site-a:bing:0")).toBe(true);
		expect(groups.has("site-b:indexnow:0")).toBe(true);
	});

	it("prevents incorrect retry decision from mixing fresh and near-terminal jobs", () => {
		// Simulating the retry policy logic in processSubmissionQueue:
		// attempt = batch[0].attempts + 1;
		// retry = isRetryable && attempt < AUTOMATION_LIMITS.maxSubmitAttempts;
		const maxAttempts = AUTOMATION_LIMITS.maxSubmitAttempts; // 3

		const freshJob = { id: "job-fresh", siteId: "site-a", engine: "indexnow", attempts: 0, loc: "https://example.com/fresh" };
		const finalAttemptJob = { id: "job-final", siteId: "site-a", engine: "indexnow", attempts: 2, loc: "https://example.com/final" };

		const groups = groupSubmissionJobs([freshJob, finalAttemptJob]);

		for (const batch of groups.values()) {
			const attempt = batch[0].attempts + 1;
			const isRetry = attempt < maxAttempts;

			if (batch[0].id === "job-fresh") {
				// Fresh job was at attempt 0, next is 1. Should be retried!
				expect(attempt).toBe(1);
				expect(isRetry).toBe(true);
			} else if (batch[0].id === "job-final") {
				// Final attempt job was at attempt 2, next is 3. Reached maxSubmitAttempts, must NOT retry!
				expect(attempt).toBe(3);
				expect(isRetry).toBe(false);
			}
		}
	});
});

describe("calculateBackoffMs and Retry-After header parsing", () => {
	it("honors server-provided Retry-After seconds with subtle jitter", () => {
		const backoffMs = calculateBackoffMs(1, { retryAfterSeconds: 120 });
		// 120s = 120,000ms. Jitter adds 0-5s, so backoff must be between 120,000ms and 125,000ms
		expect(backoffMs).toBeGreaterThanOrEqual(120_000);
		expect(backoffMs).toBeLessThanOrEqual(125_000);
	});

	it("uses 15-minute base backoff for 429 rate limit with jitter", () => {
		const backoffMs = calculateBackoffMs(1, { status: 429 });
		// 15 min = 900,000ms. Jitter is ±20%: between 720,000ms and 1,080,000ms
		expect(backoffMs).toBeGreaterThanOrEqual(720_000);
		expect(backoffMs).toBeLessThanOrEqual(1_080_000);
	});

	it("exponentially scales backoff for consecutive attempts", () => {
		// Attempt 2 base is 15 * 2^1 = 30 min (1,800,000ms) with ±20% jitter
		const attempt2Ms = calculateBackoffMs(2, { status: 429 });
		expect(attempt2Ms).toBeGreaterThanOrEqual(1_440_000);
		expect(attempt2Ms).toBeLessThanOrEqual(2_160_000);

		// Attempt 3 base is 15 * 2^2 = 60 min (3,600,000ms) with ±20% jitter
		const attempt3Ms = calculateBackoffMs(3, { status: 429 });
		expect(attempt3Ms).toBeGreaterThanOrEqual(2_880_000);
		expect(attempt3Ms).toBeLessThanOrEqual(4_320_000);
	});

	it("parses integer Retry-After header correctly", () => {
		expect(parseRetryAfterHeader("60")).toBe(60);
		expect(parseRetryAfterHeader(" 180 ")).toBe(180);
		expect(parseRetryAfterHeader("0")).toBeUndefined();
		expect(parseRetryAfterHeader("-10")).toBeUndefined();
		expect(parseRetryAfterHeader(null)).toBeUndefined();
		expect(parseRetryAfterHeader("")).toBeUndefined();
		expect(parseRetryAfterHeader("invalid")).toBeUndefined();
	});

	it("parses HTTP-date Retry-After header correctly", () => {
		const futureDate = new Date(Date.now() + 300_000).toUTCString();
		const parsedSec = parseRetryAfterHeader(futureDate);
		expect(parsedSec).toBeDefined();
		expect(parsedSec).toBeGreaterThanOrEqual(295);
		expect(parsedSec).toBeLessThanOrEqual(305);

		// Past date should return undefined
		const pastDate = new Date(Date.now() - 60_000).toUTCString();
		expect(parseRetryAfterHeader(pastDate)).toBeUndefined();
	});
});
