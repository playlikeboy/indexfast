/**
 * Pure rules behind the admin numbers: UTC range start, cron run state, and who counts as a
 * paying customer for MRR, and how unpaid access splits into grants, grace and lapsed legacy.
 * The DB queries themselves are exercised by hand on /admin.
 */
import { describe, expect, it } from "vitest";
import { classifyUnpaidAccess, computePayingCustomers, cronRunState, utcRangeStart } from "@/db/admin-queries";
import { PLANS } from "@/lib/platform/plans";

const now = new Date("2026-11-01T15:30:00Z");

describe("utcRangeStart", () => {
	it("starts at UTC midnight and counts today as one of the days", () => {
		expect(utcRangeStart(now, 7).toISOString()).toBe("2026-10-26T00:00:00.000Z");
		expect(utcRangeStart(now, 1).toISOString()).toBe("2026-11-01T00:00:00.000Z");
	});
});

describe("cronRunState", () => {
	const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

	it("reads a long-running run as timed out", () => {
		expect(cronRunState({ status: "running", startedAt: minutesAgo(5), errorMessage: null }, now)).toBe("running");
		expect(cronRunState({ status: "running", startedAt: minutesAgo(45), errorMessage: null }, now)).toBe("timed_out");
	});

	it("tells a closed stale run apart from a failed one", () => {
		expect(cronRunState({ status: "failed", startedAt: minutesAgo(90), errorMessage: "Timed out: the run was stopped." }, now)).toBe("timed_out");
		expect(cronRunState({ status: "failed", startedAt: minutesAgo(90), errorMessage: "queue: boom" }, now)).toBe("failed");
		expect(cronRunState({ status: "success", startedAt: minutesAgo(90), errorMessage: null }, now)).toBe("success");
	});
});

describe("computePayingCustomers", () => {
	const future = new Date("2026-11-20T00:00:00Z");
	const later = new Date("2026-12-20T00:00:00Z");
	const past = new Date("2026-10-20T00:00:00Z");

	it("counts a stacked customer once, on the plan of the last period", () => {
		const result = computePayingCustomers(
			[
				{ userId: "a", plan: "pro", periodEnd: future },
				{ userId: "a", plan: "unlimited", periodEnd: later },
				{ userId: "b", plan: "pro", periodEnd: past },
			],
			[],
			now,
		);
		expect(result.payingUserIds).toEqual(new Set(["a"]));
		expect(result.planMix).toEqual({ unlimited: 1 });
		expect(result.mrrUsd).toBe(PLANS.unlimited.priceUsd);
	});

	it("adds legacy subscribers without double counting a Razorpay customer", () => {
		const result = computePayingCustomers(
			[{ userId: "a", plan: "pro", periodEnd: future }],
			[
				{ userId: "a", billingTier: "scale" },
				{ userId: "c", billingTier: "growth" },
			],
			now,
		);
		expect(result.planMix).toEqual({ pro: 1, growth: 1 });
		expect(result.mrrUsd).toBe(PLANS.pro.priceUsd + PLANS.growth.priceUsd);
	});
});

describe("classifyUnpaidAccess", () => {
	const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
	const future = new Date("2026-11-20T00:00:00Z");

	it("counts a paid customer in grace as grace, never as a grant", () => {
		const users = [{ id: "g", billingTier: "pro", planExpiresAt: hoursAgo(24) }];
		const periods = [{ userId: "g", plan: "pro", periodEnd: hoursAgo(24) }];
		const { payingUserIds } = computePayingCustomers(periods, [], now);
		expect(payingUserIds.has("g")).toBe(false);
		expect(classifyUnpaidAccess(users, periods, payingUserIds, now)).toEqual({ granted: 0, inGrace: 1, lapsedLegacy: 0 });
	});

	it("reports a legacy tier with no expiry and no active subscription as lapsed legacy", () => {
		const users = [{ id: "l", billingTier: "growth", planExpiresAt: null }];
		expect(classifyUnpaidAccess(users, [], new Set(), now)).toEqual({ granted: 0, inGrace: 0, lapsedLegacy: 1 });
	});

	it("counts only active access without any payment as a grant, and skips paying users", () => {
		const users = [
			{ id: "a", billingTier: "unlimited", planExpiresAt: future },
			{ id: "p", billingTier: "pro", planExpiresAt: future },
			{ id: "x", billingTier: "pro", planExpiresAt: hoursAgo(24) },
		];
		expect(classifyUnpaidAccess(users, [{ userId: "p", periodEnd: future }], new Set(["p"]), now)).toEqual({
			granted: 1,
			inGrace: 0,
			lapsedLegacy: 0,
		});
	});
});
