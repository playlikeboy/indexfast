/*
 * Credit math for paid provider data (pure, unit tested). One place defines how a provider's
 * USD price becomes customer credits, so the pricing page, estimates and the ledger agree.
 *
 * Rules:
 * - 1000 credits per USD of marked-up provider cost; markup 1.3 covers payment fees, failed
 *   calls we absorb and the cache. A call that cost anything costs at least 1 credit.
 * - Estimates round up, so a reservation is never smaller than a typical settled charge.
 * - The monthly bucket is spent before purchased credits, because monthly credits expire.
 */

export const CREDITS_PER_USD = 1000;
export const PROVIDER_MARKUP = 1.3;

export function creditsForProviderCost(costUsd: number): number {
	if (!Number.isFinite(costUsd) || costUsd <= 0) return 0;
	return Math.max(1, Math.ceil(costUsd * PROVIDER_MARKUP * CREDITS_PER_USD - 1e-9));
}

export function toMicroUsd(costUsd: number): number {
	return Number.isFinite(costUsd) && costUsd > 0 ? Math.round(costUsd * 1_000_000) : 0;
}

/** UTC calendar month the monthly grant belongs to, e.g. "2026-11". */
export function creditPeriod(date = new Date()): string {
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** How a debit of `amount` splits across the two buckets, or null when the balance is short. */
export function splitDebit(monthly: number, purchased: number, amount: number) {
	if (amount <= 0) return { fromMonthly: 0, fromPurchased: 0 };
	if (monthly + purchased < amount) return null;
	const fromMonthly = Math.min(Math.max(monthly, 0), amount);
	return { fromMonthly, fromPurchased: amount - fromMonthly };
}

/**
 * How a refund of `amount` goes back after a reservation of (fromMonthly, fromPurchased):
 * purchased credits first (they never expire), monthly only while the same month is open.
 */
export function splitRefund(amount: number, reserved: { fromMonthly: number; fromPurchased: number }, samePeriod: boolean) {
	const toPurchased = Math.min(amount, reserved.fromPurchased);
	const toMonthly = samePeriod ? Math.min(amount - toPurchased, reserved.fromMonthly) : 0;
	return { toMonthly, toPurchased };
}

// DataForSEO list prices used for estimates before a call (docs/PROVIDER-COST-MODEL.md). The
// settled charge always uses the cost DataForSEO reports on the task, not these numbers.
export const DATAFORSEO_ESTIMATES = {
	labsTask: 0.01,
	labsPerItem: 0.0001,
} as const;

export function estimateLabsCredits(itemLimit: number) {
	return creditsForProviderCost(DATAFORSEO_ESTIMATES.labsTask + DATAFORSEO_ESTIMATES.labsPerItem * Math.max(0, itemLimit));
}
