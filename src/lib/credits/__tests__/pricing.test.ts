import { describe, expect, it } from "vitest";
import { creditPeriod, creditsForProviderCost, estimateLabsCredits, splitDebit, splitRefund, toMicroUsd } from "@/lib/credits/pricing";

describe("creditsForProviderCost", () => {
	it("applies the 1.3 markup at 1000 credits per USD and rounds up", () => {
		expect(creditsForProviderCost(0.01)).toBe(13);
		expect(creditsForProviderCost(0.0151)).toBe(20);
	});
	it("charges at least one credit for any cost and nothing for free calls", () => {
		expect(creditsForProviderCost(0.00001)).toBe(1);
		expect(creditsForProviderCost(0)).toBe(0);
		expect(creditsForProviderCost(Number.NaN)).toBe(0);
		expect(creditsForProviderCost(-1)).toBe(0);
	});
	it("does not round an exact value up by float error", () => {
		expect(creditsForProviderCost(0.1)).toBe(130);
	});
});

describe("estimateLabsCredits", () => {
	it("covers the task fee plus per-item fee", () => {
		expect(estimateLabsCredits(50)).toBe(creditsForProviderCost(0.015));
		expect(estimateLabsCredits(200)).toBeGreaterThan(estimateLabsCredits(50));
	});
});

describe("splitDebit", () => {
	it("spends monthly credits before purchased ones", () => {
		expect(splitDebit(10, 100, 25)).toEqual({ fromMonthly: 10, fromPurchased: 15 });
		expect(splitDebit(50, 0, 25)).toEqual({ fromMonthly: 25, fromPurchased: 0 });
	});
	it("refuses when the balance is short, so the balance never goes negative", () => {
		expect(splitDebit(5, 5, 11)).toBeNull();
	});
});

describe("splitRefund", () => {
	it("returns purchased credits first", () => {
		expect(splitRefund(10, { fromMonthly: 10, fromPurchased: 4 }, true)).toEqual({ toMonthly: 6, toPurchased: 4 });
	});
	it("drops the monthly part once that month is over", () => {
		expect(splitRefund(10, { fromMonthly: 10, fromPurchased: 0 }, false)).toEqual({ toMonthly: 0, toPurchased: 0 });
	});
});

describe("creditPeriod and toMicroUsd", () => {
	it("formats the UTC month", () => {
		expect(creditPeriod(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
	});
	it("stores provider cost in micro-USD", () => {
		expect(toMicroUsd(0.0123)).toBe(12300);
		expect(toMicroUsd(0)).toBe(0);
	});
});
