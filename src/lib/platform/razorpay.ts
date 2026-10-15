/**
 * Razorpay REST client + signature helpers. Pure (no DB) so it can be unit-tested and used
 * from any route. Uses Web Crypto only, because this runs on Cloudflare Workers.
 *
 * Why Orders (one-time payments) instead of Razorpay Subscriptions: each payment buys a
 * fixed 30-day prepaid period. That keeps the expiry policy fully under our control
 * (see plans.ts), works for international cards without mandate setup, and makes renewal
 * and upgrades a single checkout. See docs/billing.md.
 */
import { PLANS, type PaidPlan } from "./plans";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export function getRazorpayConfig() {
	const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
	const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
	const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
	const currency = (process.env.RAZORPAY_CURRENCY || "USD").toUpperCase();
	return { keyId, keySecret, webhookSecret, currency, configured: Boolean(keyId && keySecret) };
}

/**
 * Charge amount in minor units. Defaults to the USD list price; RAZORPAY_PRICE_PRO /
 * RAZORPAY_PRICE_UNLIMITED override it (e.g. when RAZORPAY_CURRENCY=INR, set paise).
 */
export function getPlanCharge(plan: PaidPlan) {
	const { currency } = getRazorpayConfig();
	const override = Number(process.env[`RAZORPAY_PRICE_${plan.toUpperCase()}`]);
	const amount = Number.isInteger(override) && override > 0 ? override : Math.round(PLANS[plan].priceUsd * 100);
	return { amount, currency };
}

function bytesToHex(buffer: ArrayBuffer) {
	return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256Hex(secret: string, message: string) {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

/** Constant-time comparison so signature checks do not leak timing information. */
export function safeEqual(a: string, b: string) {
	if (a.length !== b.length) {
		return false;
	}
	let diff = 0;
	for (let index = 0; index < a.length; index += 1) {
		diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}
	return diff === 0;
}

/** Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export async function verifyCheckoutSignature(input: { orderId: string; paymentId: string; signature: string; keySecret: string }) {
	if (!input.orderId || !input.paymentId || !input.signature || !input.keySecret) {
		return false;
	}
	const expected = await hmacSha256Hex(input.keySecret, `${input.orderId}|${input.paymentId}`);
	return safeEqual(expected, input.signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook secret). Must use the raw body. */
export async function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string) {
	if (!signature || !webhookSecret) {
		return false;
	}
	return safeEqual(await hmacSha256Hex(webhookSecret, rawBody), signature);
}

async function razorpayFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
	const { keyId, keySecret } = getRazorpayConfig();
	if (!keyId || !keySecret) {
		throw new Error("Payments are not configured yet.");
	}
	const response = await fetch(`${RAZORPAY_API}${path}`, {
		...init,
		headers: {
			Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
			"Content-Type": "application/json",
			...(init.headers || {}),
		},
		signal: AbortSignal.timeout(15_000),
	});
	const body = (await response.json().catch(() => ({}))) as T & { error?: { description?: string } };
	if (!response.ok) {
		throw new Error(body.error?.description || `Razorpay returned HTTP ${response.status}`);
	}
	return body;
}

export type RazorpayOrder = { id: string; amount: number; currency: string; status: string; notes?: Record<string, string> };

export function createRazorpayOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }) {
	return razorpayFetch<RazorpayOrder>("/orders", {
		method: "POST",
		body: JSON.stringify({ amount: input.amount, currency: input.currency, receipt: input.receipt, notes: input.notes }),
	});
}

export type RazorpayPayment = { id: string; order_id: string; status: string; amount: number; currency: string };

export function fetchRazorpayPayment(paymentId: string) {
	return razorpayFetch<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}
