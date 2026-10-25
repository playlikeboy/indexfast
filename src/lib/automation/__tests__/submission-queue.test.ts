import { describe, expect, it } from "vitest";
import { groupSubmissionJobs } from "../service";
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
