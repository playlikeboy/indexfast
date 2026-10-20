/**
 * Razorpay webhook (configured in the Razorpay dashboard as
 * https://indexfast.co/api/webhooks/razorpay). The signature is computed over the *raw*
 * body, so we read text() before parsing. Events that are not for an IndexFast order are
 * acknowledged with 200 so Razorpay does not retry them forever.
 */
import { handleRazorpayWebhook } from "@/lib/platform/razorpay-billing";
import { getRazorpayConfig, verifyWebhookSignature } from "@/lib/platform/razorpay";

export async function POST(request: Request) {
	const { webhookSecret } = getRazorpayConfig();
	if (!webhookSecret) {
		return Response.json({ error: "Webhook secret not configured" }, { status: 503 });
	}

	const rawBody = await request.text();
	const valid = await verifyWebhookSignature(rawBody, request.headers.get("x-razorpay-signature"), webhookSecret);
	if (!valid) {
		return Response.json({ error: "Invalid signature" }, { status: 401 });
	}

	try {
		const result = await handleRazorpayWebhook(rawBody, request.headers.get("x-razorpay-event-id"));
		return Response.json({ ok: true, ...result });
	} catch (error) {
		console.error("Razorpay webhook failed", error);
		// 500 makes Razorpay retry, which is what we want for transient DB errors.
		return Response.json({ error: "Webhook processing failed" }, { status: 500 });
	}
}
