import { describe, expect, it } from "vitest";
import {
	calculateBackoffMs,
	classifyClaimedJob,
	groupSubmissionJobs,
	isRetryable,
	isThrottled,
	resolveEligibleEngines,
	splitByEngineBudget,
	type SiteQueueState,
} from "../service";
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

	it("uses a 1-hour base backoff for 429 rate limit with jitter", () => {
		const backoffMs = calculateBackoffMs(1, { status: 429 });
		// 60 min = 3,600,000ms. Jitter is +/-20%: between 2,880,000ms and 4,320,000ms
		expect(backoffMs).toBeGreaterThanOrEqual(2_880_000);
		expect(backoffMs).toBeLessThanOrEqual(4_320_000);
	});

	it("doubles 429 backoff per attempt and caps it at 24 hours", () => {
		// Attempt 2 base is 60 * 2 = 120 min with +/-20% jitter
		const attempt2Ms = calculateBackoffMs(2, { status: 429 });
		expect(attempt2Ms).toBeGreaterThanOrEqual(5_760_000);
		expect(attempt2Ms).toBeLessThanOrEqual(8_640_000);

		// Attempt 10 would be 512h uncapped; the 24h ceiling (+/-20% jitter) applies
		const attempt10Ms = calculateBackoffMs(10, { status: 429 });
		expect(attempt10Ms).toBeGreaterThanOrEqual(24 * 3_600_000 * 0.8);
		expect(attempt10Ms).toBeLessThanOrEqual(24 * 3_600_000 * 1.2);
	});

	it("treats rate limits as retryable and throttled, without using up attempts", () => {
		const tooMany = { ok: false, status: 429, message: '{"errorCode":"TooManyRequests"}' };
		const bingThrottle = { ok: false, status: 400, message: '{"ErrorCode":17,"Message":"ERROR!!! ThrottleIP"}' };
		expect(isThrottled(tooMany)).toBe(true);
		expect(isThrottled(bingThrottle)).toBe(true);
		expect(isRetryable(bingThrottle)).toBe(true);
		expect(isThrottled({ status: 422, message: "Unprocessable Entity" })).toBe(false);
		expect(isRetryable({ ok: false, status: 403, message: "Key not valid" })).toBe(false);
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

describe("rate-limit backoff uses Retry-After as a floor", () => {
	it("never waits less than the exponential throttle backoff, even with a short Retry-After", () => {
		const ms = calculateBackoffMs(1, { status: 429, retryAfterSeconds: 60 });
		expect(ms).toBeGreaterThanOrEqual(2_880_000);
	});

	it("waits as long as the engine asks when that is longer than the backoff", () => {
		const ms = calculateBackoffMs(1, { status: 429, retryAfterSeconds: 30 * 3600 });
		expect(ms).toBeGreaterThanOrEqual(30 * 3_600_000);
		expect(ms).toBeLessThanOrEqual(30 * 3_600_000 + 5_000);
	});

	it("detects a Bing ThrottleIP answered with HTTP 400 as a throttle", () => {
		expect(isThrottled({ status: 400, message: '{"ErrorCode":17,"Message":"ThrottleIP"}' })).toBe(true);
	});
});

const verifiedSite = { verified: true, automationEnabled: true };
const paid = { limits: { bing: true } } as Parameters<typeof resolveEligibleEngines>[2];
const free = { limits: { bing: false } } as Parameters<typeof resolveEligibleEngines>[2];
const allVerified = {
	indexNow: { status: "verified", automationEnabled: true },
	bingSite: { automationEnabled: true },
	bingUser: { status: "verified" },
};

describe("resolveEligibleEngines", () => {
	it("allows Bing only on plans that include it", () => {
		expect(resolveEligibleEngines(allVerified, verifiedSite, paid)).toEqual(["indexnow", "bing"]);
		expect(resolveEligibleEngines(allVerified, verifiedSite, free)).toEqual(["indexnow"]);
		expect(resolveEligibleEngines(allVerified, verifiedSite, free, true)).toEqual(["indexnow"]);
	});

	it("sends nothing automatically while site automation is off, but manual submits still work", () => {
		const off = { verified: true, automationEnabled: false };
		expect(resolveEligibleEngines(allVerified, off, paid)).toEqual([]);
		expect(resolveEligibleEngines(allVerified, off, paid, true)).toEqual(["indexnow", "bing"]);
	});

	it("respects per-site engine toggles and unverified keys", () => {
		const bingOff = { ...allVerified, bingSite: { automationEnabled: false } };
		expect(resolveEligibleEngines(bingOff, verifiedSite, paid)).toEqual(["indexnow"]);
		const pendingKey = { ...allVerified, indexNow: { status: "pending", automationEnabled: true } };
		expect(resolveEligibleEngines(pendingKey, verifiedSite, paid, true)).toEqual(["bing"]);
	});
});

describe("classifyClaimedJob", () => {
	const active: SiteQueueState = { paused: false, automatedEngines: ["indexnow"], manualEngines: ["indexnow", "bing"], indexNowAwaitingCheck: false };

	it("sends jobs for eligible engines, using manual eligibility for manual jobs", () => {
		expect(classifyClaimedJob({ engine: "indexnow", reason: "new" }, active)).toBe("send");
		expect(classifyClaimedJob({ engine: "bing", reason: "manual" }, active)).toBe("send");
		expect(classifyClaimedJob({ engine: "bing", reason: "changed" }, active)).toBe("skip");
	});

	it("keeps jobs queued for paused sites and for a key awaiting re-verification", () => {
		expect(classifyClaimedJob({ engine: "indexnow", reason: "manual" }, { ...active, paused: true })).toBe("paused");
		const pending: SiteQueueState = { ...active, automatedEngines: [], manualEngines: [], indexNowAwaitingCheck: true };
		expect(classifyClaimedJob({ engine: "indexnow", reason: "new" }, pending)).toBe("wait");
		expect(classifyClaimedJob({ engine: "bing", reason: "new" }, pending)).toBe("skip");
	});

	it("skips jobs whose site no longer exists", () => {
		expect(classifyClaimedJob({ engine: "indexnow", reason: "new" }, undefined)).toBe("skip");
	});
});

describe("splitByEngineBudget", () => {
	const group = ["a", "b", "c", "d"];

	it("sends everything when there is no known limit or the limit covers the group", () => {
		expect(splitByEngineBudget(group, null)).toEqual({ sendable: group, defer: [], release: [] });
		expect(splitByEngineBudget(group, { limit: 10, probe: false })).toEqual({ sendable: group, defer: [], release: [] });
	});

	it("defers the rest to the engine's midnight only when the remaining quota is known", () => {
		expect(splitByEngineBudget(group, { limit: 1, probe: false })).toEqual({ sendable: ["a"], defer: ["b", "c", "d"], release: [] });
		expect(splitByEngineBudget(group, { limit: 0, probe: false })).toEqual({ sendable: [], defer: group, release: [] });
	});

	it("releases the rest behind a 1-URL probe so the backlog does not drain at 1 URL per day", () => {
		expect(splitByEngineBudget(group, { limit: 1, probe: true })).toEqual({ sendable: ["a"], defer: [], release: ["b", "c", "d"] });
	});
});
