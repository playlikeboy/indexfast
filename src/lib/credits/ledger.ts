/*
 * Credit ledger: the only code that moves an organization's SEO data credits.
 *
 * Flow for every paid provider call (see meterProviderCall):
 *   1. ensureMonthlyGrant resets the monthly bucket at the first spend of a new UTC month.
 *   2. reserveCredits debits an estimate atomically; it refuses when the balance is short, so
 *      the balance can never go below zero (that is the customer's hard spend cap).
 *   3. The call runs. settleReservation turns the reservation into the real charge (from the
 *      provider's reported cost), refunding any difference; releaseReservation refunds it all
 *      when the provider did not charge us.
 *
 * One ledger row per paid call: its kind moves reserve -> settle | release, so the billing page
 * shows one line per action. Grants and purchases are their own rows with an idempotency ref.
 *
 * The reserve statement is a single SQL statement with a CTE (not the query builder) because it
 * must read the old bucket values and debit them in one atomic step on the HTTP driver, which
 * has no interactive transactions.
 */
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { creditLedger, organizations } from "@/db/schema";
import { getUserEntitlement } from "@/lib/platform/entitlements";
import { creditPeriod, creditsForProviderCost, splitRefund, toMicroUsd } from "@/lib/credits/pricing";
import type { Organization } from "@/lib/org/context";

export class InsufficientCreditsError extends Error {
	constructor(
		public readonly needed: number,
		public readonly available: number,
	) {
		super(`This needs about ${needed} credits and ${available} are left this month. Credits reset on the 1st (UTC); upgrade at https://indexfast.co/dashboard/billing for more.`);
		this.name = "InsufficientCreditsError";
	}
}

export type CreditContext = { organization: Organization; userId: string | null; siteId?: string | null };
export type Reservation = { id: string; credits: number; fromMonthly: number; fromPurchased: number; period: string };

async function monthlyGrantFor(organization: Organization) {
	const entitlement = await getUserEntitlement(organization.ownerUserId);
	return entitlement.limits.monthlySeoCredits;
}

/** Resets the monthly bucket to the plan grant once per UTC month. Safe to call on every spend. */
export async function ensureMonthlyGrant(organization: Organization, now = new Date()) {
	const period = creditPeriod(now);
	if (organization.creditPeriod === period) return;
	const grant = await monthlyGrantFor(organization);
	const updated = await db
		.update(organizations)
		.set({ monthlyCredits: grant, creditPeriod: period, updatedAt: now })
		.where(and(eq(organizations.id, organization.id), sql`${organizations.creditPeriod} is distinct from ${period}`))
		.returning({ id: organizations.id });
	if (updated.length > 0) {
		await db
			.insert(creditLedger)
			.values({ organizationId: organization.id, kind: "grant", credits: grant, ref: `grant:${period}`, metadata: { period } })
			.onConflictDoNothing({ target: [creditLedger.organizationId, creditLedger.ref] });
	}
}

export async function getCreditBalance(organizationId: string) {
	const [row] = await db
		.select({ monthly: organizations.monthlyCredits, purchased: organizations.purchasedCredits, period: organizations.creditPeriod })
		.from(organizations)
		.where(eq(organizations.id, organizationId))
		.limit(1);
	return row ? { ...row, total: row.monthly + row.purchased } : { monthly: 0, purchased: 0, period: null, total: 0 };
}

export async function reserveCredits(
	ctx: CreditContext,
	input: { credits: number; feature: string; provider: string; endpoint: string; metadata?: Record<string, unknown> },
): Promise<Reservation> {
	await ensureMonthlyGrant(ctx.organization);
	const amount = Math.max(0, Math.ceil(input.credits));
	const period = creditPeriod();
	let fromMonthly = 0;
	let fromPurchased = 0;
	if (amount > 0) {
		const result = await db.execute(sql`
			with prev as (
				select id, monthly_credits as m, purchased_credits as p from organizations where id = ${ctx.organization.id} for update
			)
			update organizations o
			set monthly_credits = greatest(prev.m - ${amount}, 0),
				purchased_credits = prev.p - greatest(${amount} - prev.m, 0),
				updated_at = now()
			from prev
			where o.id = prev.id and prev.m + prev.p >= ${amount}
			returning least(greatest(prev.m, 0), ${amount})::int as from_monthly`);
		const row = result.rows[0] as { from_monthly: number } | undefined;
		if (!row) {
			const balance = await getCreditBalance(ctx.organization.id);
			throw new InsufficientCreditsError(amount, balance.total);
		}
		fromMonthly = Number(row.from_monthly);
		fromPurchased = amount - fromMonthly;
	}
	try {
		const [ledger] = await db
			.insert(creditLedger)
			.values({
				organizationId: ctx.organization.id,
				userId: ctx.userId,
				siteId: ctx.siteId ?? null,
				kind: "reserve",
				feature: input.feature,
				provider: input.provider,
				endpoint: input.endpoint,
				credits: -amount,
				metadata: { ...input.metadata, fromMonthly, fromPurchased, period },
			})
			.returning({ id: creditLedger.id });
		return { id: ledger.id, credits: amount, fromMonthly, fromPurchased, period };
	} catch (error) {
		// No ledger row means nobody could ever settle or see this debit: give it back.
		await refund(ctx.organization.id, amount, { fromMonthly, fromPurchased, period });
		throw error;
	}
}

async function refund(organizationId: string, amount: number, reserved: { fromMonthly: number; fromPurchased: number; period: string }) {
	if (amount <= 0) return;
	const { toMonthly, toPurchased } = splitRefund(amount, reserved, reserved.period === creditPeriod());
	if (toMonthly === 0 && toPurchased === 0) return;
	await db
		.update(organizations)
		.set({
			monthlyCredits: sql`${organizations.monthlyCredits} + ${toMonthly}`,
			purchasedCredits: sql`${organizations.purchasedCredits} + ${toPurchased}`,
			updatedAt: new Date(),
		})
		.where(eq(organizations.id, organizationId));
}

/**
 * Final charge for a reservation from the provider's reported cost. If the call cost more than
 * the estimate, the extra is not debited (we absorb it; the estimate tables are then tuned), so a
 * customer is never charged above what they were shown and approved.
 */
export async function settleReservation(organizationId: string, reservation: Reservation, providerCostUsd: number, metadata?: Record<string, unknown>) {
	const actual = Math.min(creditsForProviderCost(providerCostUsd), reservation.credits);
	await refund(organizationId, reservation.credits - actual, reservation);
	await db
		.update(creditLedger)
		.set({
			kind: "settle",
			credits: -actual,
			providerCostMicroUsd: toMicroUsd(providerCostUsd),
			metadata: sql`coalesce(${creditLedger.metadata}, '{}'::jsonb) || ${JSON.stringify({ ...metadata, estimated: reservation.credits })}::jsonb`,
		})
		.where(and(eq(creditLedger.id, reservation.id), eq(creditLedger.organizationId, organizationId)));
	return actual;
}

export async function releaseReservation(organizationId: string, reservation: Reservation, reason: string) {
	await refund(organizationId, reservation.credits, reservation);
	await db
		.update(creditLedger)
		.set({ kind: "release", credits: 0, metadata: sql`coalesce(${creditLedger.metadata}, '{}'::jsonb) || ${JSON.stringify({ reason: reason.slice(0, 300), estimated: reservation.credits })}::jsonb` })
		.where(and(eq(creditLedger.id, reservation.id), eq(creditLedger.organizationId, organizationId)));
}

/** Records a call billed to the customer's own provider key (no credits move). */
export async function recordByokUsage(ctx: CreditContext, input: { feature: string; provider: string; endpoint: string; providerCostUsd: number; cached?: boolean }) {
	await db.insert(creditLedger).values({
		organizationId: ctx.organization.id,
		userId: ctx.userId,
		siteId: ctx.siteId ?? null,
		kind: "settle",
		feature: input.feature,
		provider: input.provider,
		endpoint: input.endpoint,
		credits: 0,
		providerCostMicroUsd: toMicroUsd(input.providerCostUsd),
		byok: true,
		metadata: { cached: input.cached ?? false },
	});
}

export async function listLedger(organizationId: string, limit = 50) {
	return db
		.select()
		.from(creditLedger)
		.where(eq(creditLedger.organizationId, organizationId))
		.orderBy(desc(creditLedger.createdAt))
		.limit(Math.min(Math.max(limit, 1), 200));
}

/**
 * Wraps one paid provider call: reserve the estimate, run, settle on the reported cost.
 * `run` returns the data plus the provider cost in USD (0 for a cache hit). When the provider
 * reports a charge on a failed call (chargedCostUsd on the error), that charge is settled before
 * the error is rethrown; any other failure releases the reservation.
 */
export async function meterProviderCall<T>(
	ctx: CreditContext,
	input: { feature: string; provider: string; endpoint: string; estimateCredits: number; byok: boolean; metadata?: Record<string, unknown> },
	run: () => Promise<{ data: T; costUsd: number; cached: boolean }>,
): Promise<{ data: T; credits: number; cached: boolean }> {
	if (input.byok) {
		const result = await run();
		await recordByokUsage(ctx, { ...input, providerCostUsd: result.costUsd, cached: result.cached });
		return { data: result.data, credits: 0, cached: result.cached };
	}
	const reservation = await reserveCredits(ctx, { credits: input.estimateCredits, feature: input.feature, provider: input.provider, endpoint: input.endpoint, metadata: input.metadata });
	try {
		const result = await run();
		const credits = await settleReservation(ctx.organization.id, reservation, result.costUsd, { cached: result.cached });
		return { data: result.data, credits, cached: result.cached };
	} catch (error) {
		const charged = (error as { chargedCostUsd?: number } | null)?.chargedCostUsd;
		if (typeof charged === "number" && charged > 0) {
			await settleReservation(ctx.organization.id, reservation, charged, { failed: true });
		} else {
			await releaseReservation(ctx.organization.id, reservation, error instanceof Error ? error.message : String(error));
		}
		throw error;
	}
}

/**
 * Refunds reservations left open by a request that died mid-call (Worker eviction, timeout
 * before settle). A live call never takes this long, so anything older is safe to release.
 * Run by the hourly cron.
 */
export async function releaseStaleReservations(olderThan: Date) {
	const stale = await db
		.select({ id: creditLedger.id, organizationId: creditLedger.organizationId, credits: creditLedger.credits, metadata: creditLedger.metadata })
		.from(creditLedger)
		.where(and(eq(creditLedger.kind, "reserve"), lt(creditLedger.createdAt, olderThan)))
		.limit(500);
	for (const row of stale) {
		const meta = (row.metadata ?? {}) as { fromMonthly?: number; fromPurchased?: number; period?: string };
		await releaseReservation(row.organizationId, { id: row.id, credits: -row.credits, fromMonthly: meta.fromMonthly ?? 0, fromPurchased: meta.fromPurchased ?? 0, period: meta.period ?? "" }, "stale reservation released by cron");
	}
	return stale.length;
}
