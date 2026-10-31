import { describe, expect, it } from "vitest";
import { needsSelfHeal, refundedAmount } from "@/lib/platform/razorpay-billing";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-01T00:00:00Z");
const inDays = (days: number) => new Date(now.getTime() + days * DAY);

describe("refundedAmount (full-refund threshold)", () => {
	const charged = 1900;

	it("prefers the payment's cumulative amount_refunded", () => {
		// Two partial refunds: the second event's own amount is partial, the cumulative total is full.
		expect(refundedAmount({ amount_refunded: 1900 }, { amount: 900 }) >= charged).toBe(true);
		expect(refundedAmount({ amount_refunded: 1000 }, { amount: 1000 }) >= charged).toBe(false);
	});

	it("falls back to the single refund amount, then zero", () => {
		expect(refundedAmount(undefined, { amount: 1900 }) >= charged).toBe(true);
		expect(refundedAmount({}, { amount: 500 })).toBe(500);
		expect(refundedAmount(undefined, undefined)).toBe(0);
	});
});

describe("needsSelfHeal", () => {
	const paid = { status: "paid", plan: "pro", periodEnd: inDays(20) };

	it("heals a user who never received the paid period", () => {
		expect(needsSelfHeal({ billingTier: "free", planExpiresAt: null }, paid, now)).toBe(true);
		expect(needsSelfHeal(null, paid, now)).toBe(true);
	});

	it("heals the same plan when the stored expiry is earlier", () => {
		expect(needsSelfHeal({ billingTier: "pro", planExpiresAt: inDays(5) }, paid, now)).toBe(true);
		expect(needsSelfHeal({ billingTier: "pro", planExpiresAt: inDays(20) }, paid, now)).toBe(false);
	});

	it("never overwrites a different plan that is still in force", () => {
		expect(needsSelfHeal({ billingTier: "unlimited", planExpiresAt: inDays(3) }, paid, now)).toBe(false);
		expect(needsSelfHeal({ billingTier: "growth", planExpiresAt: null }, paid, now)).toBe(false);
	});

	it("heals over a different plan that has fully expired", () => {
		expect(needsSelfHeal({ billingTier: "unlimited", planExpiresAt: inDays(-10) }, paid, now)).toBe(true);
	});

	it("does nothing for refunded, ended or unstamped payments", () => {
		const user = { billingTier: "free", planExpiresAt: null };
		expect(needsSelfHeal(user, { ...paid, status: "refunded" }, now)).toBe(false);
		expect(needsSelfHeal(user, { ...paid, periodEnd: inDays(-1) }, now)).toBe(false);
		expect(needsSelfHeal(user, { ...paid, periodEnd: null }, now)).toBe(false);
	});
});
