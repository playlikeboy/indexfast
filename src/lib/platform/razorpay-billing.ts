/**
 * Razorpay billing state machine (DB side). Flow, documented in docs/billing.md:
 *
 *   createCheckoutOrder -> Razorpay Checkout modal -> (a) browser POSTs the signed result to
 *   /api/billing/razorpay/verify and (b) Razorpay POSTs a webhook to /api/webhooks/razorpay.
 *   Both call activatePaidOrder(); a conditional UPDATE on payments.status guarantees the
 *   period is granted exactly once no matter which arrives first.
 *
 * The Razorpay account may be shared with other apps (same webhook secret), so any event
 * whose order_id is not in our payments table is recorded and ignored.
 */
import { and, desc, eq, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { billingEvents, payments, users } from "@/db/schema";
import {
	PLANS,
	PLAN_GRACE_DAYS,
	computeNextPeriod,
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

/** Idempotent: grants the paid period once, returns the resulting expiry. */
export async function activatePaidOrder(input: { orderId: string; paymentId: string }) {
	const [payment] = await db.select().from(payments).where(eq(payments.orderId, input.orderId)).limit(1);
	if (!payment) {
		return { ok: false as const, reason: "unknown_order" };
	}
	if (payment.status === "paid" || payment.status === "refunded") {
		return { ok: true as const, alreadyProcessed: true, periodEnd: payment.periodEnd, plan: payment.plan };
	}
	if (!isPaidPlan(payment.plan)) {
		return { ok: false as const, reason: "invalid_plan" };
	}

	const [user] = await db
		.select({ billingTier: users.billingTier, planExpiresAt: users.planExpiresAt })
		.from(users)
		.where(eq(users.id, payment.userId))
		.limit(1);
	const now = new Date();
	// Only extend from the current expiry if that plan is still in force (active or grace).
	const current = resolveEntitlement(user, now).status === "expired" ? { billingTier: "free", planExpiresAt: null } : user ?? { billingTier: "free", planExpiresAt: null };
	const period = computeNextPeriod(current, payment.plan, now);

	const claimed = await db
		.update(payments)
		.set({
			status: "paid",
			paymentId: input.paymentId,
			periodStart: period.start,
			periodEnd: period.end,
			failureReason: null,
			updatedAt: now,
		})
		.where(and(eq(payments.orderId, input.orderId), ne(payments.status, "paid"), ne(payments.status, "refunded")))
		.returning({ id: payments.id });

	if (claimed.length === 0) {
		return { ok: true as const, alreadyProcessed: true, periodEnd: payment.periodEnd, plan: payment.plan };
	}

	await db
		.update(users)
		.set({ billingTier: payment.plan, planExpiresAt: period.end, updatedAt: now })
		.where(eq(users.id, payment.userId));

	return { ok: true as const, alreadyProcessed: false, periodEnd: period.end, plan: payment.plan };
}

export async function markPaymentFailed(orderId: string, paymentId: string | null, reason: string) {
	await db
		.update(payments)
		.set({ status: "failed", paymentId, failureReason: reason.slice(0, 500), updatedAt: new Date() })
		.where(and(eq(payments.orderId, orderId), eq(payments.status, "created")));
}

/** After a full refund, the user's entitlement falls back to their latest remaining paid period. */
async function recomputeEntitlementFromLedger(userId: string) {
	const [latest] = await db
		.select({ plan: payments.plan, periodEnd: payments.periodEnd })
		.from(payments)
		.where(and(eq(payments.userId, userId), eq(payments.status, "paid")))
		.orderBy(desc(payments.periodEnd))
		.limit(1);

	await db
		.update(users)
		.set(
			latest?.periodEnd && latest.periodEnd > new Date()
				? { billingTier: latest.plan, planExpiresAt: latest.periodEnd, updatedAt: new Date() }
				: { billingTier: "free", planExpiresAt: new Date(), updatedAt: new Date() },
		)
		.where(eq(users.id, userId));
}

type RazorpayWebhook = {
	event?: string;
	payload?: {
		payment?: { entity?: { id?: string; order_id?: string; amount?: number; error_description?: string } };
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
			if (refund?.amount !== undefined && refund.amount >= ours.amount) {
				await db.update(payments).set({ status: "refunded", updatedAt: new Date() }).where(eq(payments.id, ours.id));
				await recomputeEntitlementFromLedger(ours.userId);
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
