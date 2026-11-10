/**
 * LEGACY: DodoPayments billing. Hidden from the UI (Razorpay is the only checkout now, see
 * razorpay-billing.ts) but kept so existing Dodo subscribers keep receiving webhook updates.
 * Do not build new features on this module.
 */
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { billingCustomers, billingEvents, subscriptions, users } from "@/db/schema";
import { normalizeBillingTier, type BillingTier } from "./plans";

type DodoPayload = {
	type?: string;
	event_type?: string;
	id?: string;
	event_id?: string;
	data?: Record<string, unknown>;
};

const productPlanEnv: Partial<Record<BillingTier, string | undefined>> = {
	free: undefined,
	indie: process.env.DODO_PRODUCT_ID_INDIE,
	growth: process.env.DODO_PRODUCT_ID_GROWTH,
	agency: process.env.DODO_PRODUCT_ID_AGENCY,
	scale: process.env.DODO_PRODUCT_ID_SCALE,
};

function asString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asDate(value: unknown) {
	const raw = asString(value);
	if (!raw) {
		return null;
	}

	const date = new Date(raw);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function getPlanFromDodoProductId(productId: string | null | undefined): BillingTier {
	if (!productId) {
		return "free";
	}

	for (const [plan, configuredProductId] of Object.entries(productPlanEnv) as Array<[BillingTier, string | undefined]>) {
		if (configuredProductId && configuredProductId === productId) {
			return plan;
		}
	}

	return "free";
}

function getPayloadData(payload: DodoPayload) {
	return payload.data || {};
}

function getMetadata(data: Record<string, unknown>) {
	const metadata = data.metadata;
	return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
}

export async function getCurrentBilling(userId: string) {
	const [user, subscription, customer] = await Promise.all([
		db.select({ billingTier: users.billingTier }).from(users).where(eq(users.id, userId)).limit(1),
		db
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.userId, userId))
			.orderBy(desc(subscriptions.updatedAt))
			.limit(1),
		db.select().from(billingCustomers).where(eq(billingCustomers.userId, userId)).limit(1),
	]);

	return {
		billingTier: normalizeBillingTier(user[0]?.billingTier),
		subscription: subscription[0] || null,
		customer: customer[0] || null,
	};
}

const LEGACY_DODO_TIERS: BillingTier[] = ["indie", "growth", "agency", "scale"];

/**
 * Which tier a Dodo event should put the user on, or null for "leave the tier alone".
 * The plan comes only from the signed product id (never from metadata, which the payer
 * could influence), payment.* events never change the tier, and only an explicitly
 * active subscription grants a paid tier.
 */
export function resolveDodoTierChange(eventType: string, status: string | null, plan: BillingTier): BillingTier | null {
	if (!eventType.startsWith("subscription.")) {
		return null;
	}
	if (eventType === "subscription.cancelled" || eventType === "subscription.expired" || status === "cancelled" || status === "expired") {
		return "free";
	}
	return status === "active" && plan !== "free" ? plan : null;
}

export async function recordDodoBillingEvent(payload: DodoPayload) {
	const data = getPayloadData(payload);
	const metadata = getMetadata(data);
	const eventType = asString(payload.type) || asString(payload.event_type) || "unknown";
	const eventId = asString(payload.id) || asString(payload.event_id) || `${eventType}-${crypto.randomUUID()}`;
	const userId = asString(metadata.userId) || asString(data.user_id);
	const customerId = asString(data.customer_id) || asString((data.customer as Record<string, unknown> | undefined)?.customer_id);
	const customerEmail = asString(data.email) || asString((data.customer as Record<string, unknown> | undefined)?.email);
	const subscriptionId = asString(data.subscription_id) || asString(data.id);
	const productId = asString(data.product_id) || asString(data.product?.toString());
	const plan = getPlanFromDodoProductId(productId);
	const status = asString(data.status);
	const now = new Date();

	// The ledger insert is the idempotency key: a replayed event must not re-apply tier changes.
	const inserted = await db
		.insert(billingEvents)
		.values({
			eventId,
			eventType,
			userId,
			payload,
			processedAt: now,
		})
		.onConflictDoNothing({ target: billingEvents.eventId })
		.returning({ id: billingEvents.id });

	if (inserted.length === 0) {
		return { eventType, userId, plan, duplicate: true };
	}

	if (!userId) {
		return { eventType, userId: null, plan: "free" as BillingTier };
	}

	if (customerId && customerEmail) {
		await db
			.insert(billingCustomers)
			.values({
				userId,
				dodoCustomerId: customerId,
				email: customerEmail,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: billingCustomers.userId,
				set: {
					dodoCustomerId: customerId,
					email: customerEmail,
					updatedAt: now,
				},
			});
	}

	const tierChange = resolveDodoTierChange(eventType, status, plan);
	if (subscriptionId && eventType.startsWith("subscription.")) {
		const row = {
			dodoProductId: productId,
			plan: tierChange ?? plan,
			status: tierChange === "free" ? "cancelled" : status || "unknown",
			currentPeriodStart: asDate(data.current_period_start),
			currentPeriodEnd: asDate(data.current_period_end),
			cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
			updatedAt: now,
		};
		await db
			.insert(subscriptions)
			.values({ userId, dodoSubscriptionId: subscriptionId, ...row })
			.onConflictDoUpdate({ target: subscriptions.dodoSubscriptionId, set: row });
	}

	if (tierChange === "free") {
		// Only end a legacy Dodo tier (null expiry). A Razorpay period or admin grant the user
		// holds now is unrelated to this subscription and must survive its cancellation.
		await db
			.update(users)
			.set({ billingTier: "free", updatedAt: now })
			.where(and(eq(users.id, userId), inArray(users.billingTier, LEGACY_DODO_TIERS), isNull(users.planExpiresAt)));
	} else if (tierChange) {
		// Legacy tiers never expire on our side (Dodo renews them), so the expiry is cleared.
		// A user holding a live Razorpay period (future planExpiresAt) keeps it: a Dodo renewal
		// must not erase prepaid time the user bought after subscribing on Dodo.
		await db
			.update(users)
			.set({ billingTier: tierChange, planExpiresAt: null, updatedAt: now })
			.where(and(eq(users.id, userId), or(isNull(users.planExpiresAt), lt(users.planExpiresAt, now))));
	}

	return { eventType, userId, plan };
}
