import { describe, expect, it } from "vitest";
import { computePausedSiteIds } from "@/lib/platform/entitlements";
import { PLANS, PLAN_GRACE_DAYS, VISIBLE_PLANS, computeNextPeriod, resolveEntitlement } from "@/lib/platform/plans";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-15T00:00:00Z");

describe("plan catalog", () => {
	it("only sells Free, Pro ($19) and Unlimited ($99)", () => {
		expect(VISIBLE_PLANS.map((plan) => [plan.id, plan.priceUsd])).toEqual([
			["free", 0],
			["pro", 19],
			["unlimited", 99],
		]);
	});

	it("keeps legacy tiers hidden but defined", () => {
		for (const tier of ["indie", "growth", "agency", "scale"] as const) {
			expect(PLANS[tier].visible).toBe(false);
		}
	});
});

describe("resolveEntitlement expiry policy", () => {
	it("is active before expiry", () => {
		const e = resolveEntitlement({ billingTier: "pro", planExpiresAt: new Date(now.getTime() + 5 * DAY) }, now);
		expect(e.status).toBe("active");
		expect(e.tier).toBe("pro");
		expect(e.daysLeft).toBe(5);
	});

	it("keeps paid limits during the grace period", () => {
		const e = resolveEntitlement({ billingTier: "unlimited", planExpiresAt: new Date(now.getTime() - DAY) }, now);
		expect(e.status).toBe("grace");
		expect(e.limits.sites).toBe(Infinity);
	});

	it("falls back to free limits after grace even before the cron runs", () => {
		const e = resolveEntitlement({ billingTier: "pro", planExpiresAt: new Date(now.getTime() - (PLAN_GRACE_DAYS + 1) * DAY) }, now);
		expect(e.status).toBe("expired");
		expect(e.tier).toBe("free");
		expect(e.limits.sites).toBe(1);
	});

	it("treats a paid tier without expiry as a legacy Dodo subscription", () => {
		expect(resolveEntitlement({ billingTier: "agency", planExpiresAt: null }, now).status).toBe("active");
	});

	it("defaults unknown users to free", () => {
		expect(resolveEntitlement(null, now).tier).toBe("free");
	});
});

describe("computeNextPeriod", () => {
	it("stacks a same-plan renewal onto remaining time", () => {
		const expires = new Date(now.getTime() + 10 * DAY);
		const period = computeNextPeriod({ billingTier: "pro", planExpiresAt: expires }, "pro", now);
		expect(period.start).toEqual(expires);
		expect(period.end.getTime() - expires.getTime()).toBe(30 * DAY);
	});

	it("starts an upgrade immediately", () => {
		const period = computeNextPeriod({ billingTier: "pro", planExpiresAt: new Date(now.getTime() + 10 * DAY) }, "unlimited", now);
		expect(period.start).toEqual(now);
	});
});

describe("computePausedSiteIds", () => {
	it("keeps the oldest sites active and pauses the rest", () => {
		expect(Array.from(computePausedSiteIds(["a", "b", "c"], 1))).toEqual(["b", "c"]);
		expect(computePausedSiteIds(["a", "b"], Infinity).size).toBe(0);
	});
});
