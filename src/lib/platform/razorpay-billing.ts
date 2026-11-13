/**
 * Razorpay billing state machine (DB side). Flow, documented in docs/billing.md:
 *
 *   createCheckoutOrder -> Razorpay Checkout modal -> (a) browser POSTs the signed result to
 *   /api/billing/razorpay/verify and (b) Razorpay POSTs a webhook to /api/webhooks/razorpay.
 *   Both call activatePaidOrder(); a conditional UPDATE on payments.status guarantees the
 *   period is granted exactly once no matter which arrives first.
 *
 * Refunds: only a full refund (cumulative) takes the period back, see applyFullRefund().
 *
 * The Razorpay account may be shared with other apps (same webhook secret), so any event
 * whose order_id is not in our payments table is recorded and ignored.
 */
import { and, desc, eq, inArray, isNotNull, isNull, lt, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { billingEvents, conversionEvents, payments, users } from "@/db/schema";
import {
	PLANS,
	PLAN_GRACE_DAYS,
	PLAN_PERIOD_DAYS,
	isPaidPlan,
	normalizeBillingTier,
	resolveEntitlement,
	type PaidPlan,
} from "./plans";
import { createRazorpayOrder, getPlanCharge, getRazorpayConfig } from "./razorpay";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function createCheckoutOrder(user: { id: string; email: string; name?: string | null }, plan: PaidPlan) {
	const config = getRazorpayConfig();
	if (!config.configured) {
		throw new Error("Payments are not configured yet. Please contact support.");
	}

	const { amount, currency } = getPlanCharge(plan);
	const order = await createRazorpayOrder({
		amount,
		currency,
		receipt: `if_${crypto.randomUUID().replace(/-/g, "").slice(0, 30)}`,
		notes: { app: "indexfast", userId: user.id, plan, email: user.email },
	});

	await db.insert(payments).values({
		userId: user.id,
		provider: "razorpay",
		orderId: order.id,
		plan,
		amount: order.amount,
		currency: order.currency,
		status: "created",
	});

	return {
		keyId: config.keyId,
		orderId: order.id,
		amount: order.amount,
		currency: order.currency,
		plan,
		planName: PLANS[plan].name,
		email: user.email,
		name: user.name || "",
	};
}

/**
 * Whether a payment that is already `paid` still needs its period written to the user row.
 * Older code claimed the payment and updated the user in two separate writes, so a failure
 * in between left a paid order that never upgraded anyone. Heal only when the user holds
 * nothing better: the same plan ending earlier, or no paid plan in force at all (never
 * overwrite a different active plan, e.g. a later upgrade).
 */
export function needsSelfHeal(
	user: { billingTier: string | null; planExpiresAt: Date | null } | null | undefined,
	payment: { status: string; plan: string; periodEnd: Date | null },
	now = new Date(),
) {
	if (payment.status !== "paid" || !payment.periodEnd || payment.periodEnd <= now || !isPaidPlan(payment.plan)) {
		return false;
	}
	if (normalizeBillingTier(user?.billingTier) === payment.plan) {
		return Boolean(user?.planExpiresAt && user.planExpiresAt < payment.periodEnd);
	}
	const status = resolveEntitlement(user, now).status;
	return status === "free" || status === "expired";
}

/**
 * Idempotent: grants the paid period once, returns the resulting expiry.
 *
 * The claim, the user upgrade and the period stamp run as one transaction (neon-http batch),
 * so a failure can never leave a paid order without its upgrade. The new expiry is computed
 * inside the users UPDATE from the row's current value: concurrent payments for one user are
 * serialised by the row lock and each stacks onto the previous one instead of both reading the
 * same old expiry. Same plan still active extends from its expiry, anything else starts now.
 */
export async function activatePaidOrder(input: { orderId: string; paymentId: string; expectedUserId?: string }) {
	const [payment] = await db.select().from(payments).where(eq(payments.orderId, input.orderId)).limit(1);
	if (!payment) {
		return { ok: false as const, reason: "unknown_order" };
	}
	if (input.expectedUserId && payment.userId !== input.expectedUserId) {
		return { ok: false as const, reason: "unauthorized" };
	}
	if (payment.status === "paid" || payment.status === "refunded") {
		return healPaidOrder(payment);
	}
	if (!isPaidPlan(payment.plan)) {
		return { ok: false as const, reason: "invalid_plan" };
	}

	const now = new Date();
	const utcNow = sql`(now() at time zone 'utc')`;
	const period = sql`make_interval(days => ${PLAN_PERIOD_DAYS})`;
	const [claimed, granted] = await db.batch([
		db
			.update(payments)
			.set({ status: "paid", paymentId: input.paymentId, failureReason: null, updatedAt: now })
			.where(and(eq(payments.orderId, input.orderId), notInArray(payments.status, ["paid", "refunded"])))
			.returning({ id: payments.id }),
		db
			.update(users)
			.set({
				billingTier: payment.plan,
				planExpiresAt: sql`(case when ${users.billingTier} = ${payment.plan} and ${users.planExpiresAt} > ${utcNow} then ${users.planExpiresAt} else ${utcNow} end) + ${period}`,
				updatedAt: now,
			})
			// Only the transaction that just claimed the order (paid, not yet stamped) may grant.
			.where(
				and(
					eq(users.id, payment.userId),
					sql`exists (select 1 from ${payments} where ${payments.orderId} = ${input.orderId} and ${payments.paymentId} = ${input.paymentId} and ${payments.status} = 'paid' and ${payments.periodEnd} is null)`,
				),
			)
			.returning({ planExpiresAt: users.planExpiresAt }),
		db
			.update(payments)
			.set({
				periodEnd: sql`(select ${users.planExpiresAt} from ${users} where ${users.id} = ${payment.userId})`,
				periodStart: sql`(select ${users.planExpiresAt} from ${users} where ${users.id} = ${payment.userId}) - ${period}`,
			})
			.where(and(eq(payments.orderId, input.orderId), eq(payments.status, "paid"), isNull(payments.periodEnd))),
	]);

	if (claimed.length === 0) {
		const [latest] = await db.select().from(payments).where(eq(payments.orderId, input.orderId)).limit(1);
		return healPaidOrder(latest ?? payment);
	}

	// First paid activation for this user = the trial-start conversion event. (IndexFast
	// has no free-trial period; see docs/billing.md.) Best-effort: analytics must never
	// fail a payment.
	await recordTrialStartedIfFirst(payment.userId);

	return { ok: true as const, alreadyProcessed: false, periodEnd: granted[0]?.planExpiresAt ?? null, plan: payment.plan };
}

/**
 * Insert the trial_started conversion event the first time a user activates a paid
 * plan. Attribution is joined later via the account_created event for the same user
 * (see src/lib/attribution.ts). Best-effort: any failure is logged, never thrown, so
 * analytics can never break billing. The report counts the first trial_started per
 * user, so a duplicate insert here is harmless.
 */
async function recordTrialStartedIfFirst(userId: string) {
	try {
		const [already] = await db
			.select({ id: conversionEvents.id })
			.from(conversionEvents)
			.where(and(eq(conversionEvents.userId, userId), eq(conversionEvents.event, "trial_started")))
			.limit(1);
		if (already) return;
		const paid = await db
			.select({ id: payments.id })
			.from(payments)
			.where(and(eq(payments.userId, userId), eq(payments.status, "paid")))
			.limit(2);
		if (paid.length !== 1) return;
		await db.insert(conversionEvents).values({ event: "trial_started", path: "/dashboard/billing", userId });
	} catch (error) {
		console.error("trial_started event failed", error);
	}
}

async function healPaidOrder(payment: typeof payments.$inferSelect) {
	const [user] = await db
		.select({ billingTier: users.billingTier, planExpiresAt: users.planExpiresAt })
		.from(users)
		.where(eq(users.id, payment.userId))
		.limit(1);
	if (needsSelfHeal(user, payment)) {
		await db
			.update(users)
			.set({ billingTier: payment.plan, planExpiresAt: payment.periodEnd, updatedAt: new Date() })
			.where(eq(users.id, payment.userId));
	}
	return { ok: true as const, alreadyProcessed: true, periodEnd: payment.periodEnd, plan: payment.plan };
}

export async function markPaymentFailed(orderId: string, paymentId: string | null, reason: string) {
	await db
		.update(payments)
		.set({ status: "failed", paymentId, failureReason: reason.slice(0, 500), updatedAt: new Date() })
		.where(and(eq(payments.orderId, orderId), eq(payments.status, "created")));
}

/**
 * Total refunded so far for the payment. Razorpay sends one event per refund, so two partial
 * refunds that add up to the full amount only show as full via the payment's cumulative
 * amount_refunded; the single refund amount is the fallback for payloads without it.
 */
export function refundedAmount(paymentEntity: { amount_refunded?: number } | undefined, refund: { amount?: number } | undefined) {
	if (typeof paymentEntity?.amount_refunded === "number") return paymentEntity.amount_refunded;
	return typeof refund?.amount === "number" ? refund.amount : 0;
}

/**
 * Full refund: flip the payment to `refunded` and take exactly its period back off the user.
 * Only when the user is still on the refunded plan; an admin grant or legacy tier the user is
 * on now has nothing to do with this payment. Both writes are one transaction; the users
 * UPDATE is tied to this call's flip via its updatedAt marker so a duplicate refund event
 * (refund.created + refund.processed) subtracts once.
 */
async function applyFullRefund(paymentRowId: string) {
	const marker = new Date();
	await db.batch([
		db
			.update(payments)
			.set({ status: "refunded", updatedAt: marker })
			.where(and(eq(payments.id, paymentRowId), eq(payments.status, "paid"))),
		db
			.update(users)
			.set({
				planExpiresAt: sql`${users.planExpiresAt} - (select ${payments.periodEnd} - ${payments.periodStart} from ${payments} where ${payments.id} = ${paymentRowId})`,
				updatedAt: marker,
			})
			.where(
				and(
					isNotNull(users.planExpiresAt),
					sql`exists (select 1 from ${payments} where ${payments.id} = ${paymentRowId} and ${payments.userId} = ${users.id} and ${payments.plan} = ${users.billingTier} and ${payments.status} = 'refunded' and ${payments.periodStart} is not null and ${payments.periodEnd} is not null and ${eq(payments.updatedAt, marker)})`,
				),
			),
	]);
}

type RazorpayWebhook = {
	event?: string;
	payload?: {
		payment?: { entity?: { id?: string; order_id?: string; amount?: number; amount_refunded?: number; error_description?: string } };
		order?: { entity?: { id?: string } };
		refund?: { entity?: { payment_id?: string; amount?: number } };
	};
};

export async function handleRazorpayWebhook(rawBody: string, eventIdHeader: string | null) {
	const event = JSON.parse(rawBody) as RazorpayWebhook;
	const eventType = event.event || "unknown";
	const paymentEntity = event.payload?.payment?.entity;
	const orderId = paymentEntity?.order_id || event.payload?.order?.entity?.id || null;
	const refund = event.payload?.refund?.entity;

	let ours: typeof payments.$inferSelect | undefined;
	if (orderId) {
		[ours] = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
	} else if (refund?.payment_id) {
		[ours] = await db.select().from(payments).where(eq(payments.paymentId, refund.payment_id)).limit(1);
	}

	// Ledger insert doubles as idempotency: a replayed event id is a no-op.
	const eventId = eventIdHeader || `razorpay:${eventType}:${paymentEntity?.id || orderId || crypto.randomUUID()}`;
	const inserted = await db
		.insert(billingEvents)
		.values({ eventId: `razorpay:${eventId}`, eventType: `razorpay.${eventType}`, userId: ours?.userId ?? null, payload: event, processedAt: new Date() })
		.onConflictDoNothing({ target: billingEvents.eventId })
		.returning({ id: billingEvents.id });

	if (inserted.length === 0) {
		return { handled: false, reason: "duplicate" };
	}
	if (!ours) {
		return { handled: false, reason: "not_an_indexfast_order" };
	}

	try {
		return await processRazorpayEvent(eventType, ours, paymentEntity, refund);
	} catch (error) {
		// Drop the ledger row so Razorpay's retry of this event is processed, not skipped as a duplicate.
		await db.delete(billingEvents).where(eq(billingEvents.id, inserted[0].id));
		throw error;
	}
}

async function processRazorpayEvent(
	eventType: string,
	ours: typeof payments.$inferSelect,
	paymentEntity: NonNullable<NonNullable<RazorpayWebhook["payload"]>["payment"]>["entity"],
	refund: NonNullable<NonNullable<RazorpayWebhook["payload"]>["refund"]>["entity"],
) {
	switch (eventType) {
		case "payment.captured":
		case "order.paid":
			if (paymentEntity?.id) {
				await activatePaidOrder({ orderId: ours.orderId, paymentId: paymentEntity.id });
			}
			return { handled: true };
		case "payment.failed":
			await markPaymentFailed(ours.orderId, paymentEntity?.id ?? null, paymentEntity?.error_description || "Payment failed");
			return { handled: true };
		case "refund.processed":
		case "refund.created":
			if (refundedAmount(paymentEntity, refund) >= ours.amount) {
				await applyFullRefund(ours.id);
			}
			return { handled: true };
		default:
			return { handled: false, reason: "ignored_event" };
	}
}

/**
 * Cron step: move users whose paid period ended more than PLAN_GRACE_DAYS ago back to Free.
 * planExpiresAt is kept so the UI can say "Pro expired on <date>". Legacy Dodo tiers
 * (null expiry) are untouched.
 */
export async function downgradeExpiredPlans(now = new Date()) {
	const cutoff = new Date(now.getTime() - PLAN_GRACE_DAYS * DAY_MS);
	const rows = await db
		.update(users)
		.set({ billingTier: "free", updatedAt: now })
		.where(and(ne(users.billingTier, "free"), lt(users.planExpiresAt, cutoff)))
		.returning({ id: users.id });
	return rows.length;
}

export async function getBillingOverview(userId: string) {
	const [[user], history] = await Promise.all([
		db.select({ billingTier: users.billingTier, planExpiresAt: users.planExpiresAt }).from(users).where(eq(users.id, userId)).limit(1),
		db
			.select()
			.from(payments)
			.where(and(eq(payments.userId, userId), inArray(payments.status, ["paid", "failed", "refunded"])))
			.orderBy(desc(payments.createdAt))
			.limit(20),
	]);
	return {
		entitlement: resolveEntitlement(user),
		lastPlan: normalizeBillingTier(history.find((row) => row.status === "paid")?.plan),
		planExpiresAt: user?.planExpiresAt ?? null,
		history,
	};
}

export type BillingOverview = Awaited<ReturnType<typeof getBillingOverview>>;
