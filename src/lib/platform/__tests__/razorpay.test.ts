import { describe, expect, it } from "vitest";
import { hmacSha256Hex, safeEqual, verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/platform/razorpay";

describe("Razorpay signatures", () => {
	it("matches a known HMAC-SHA256 vector", async () => {
		// RFC 4231-style sanity check computed with openssl.
		expect(await hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog")).toBe(
			"f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
		);
	});

	it("verifies checkout signatures over order_id|payment_id", async () => {
		const signature = await hmacSha256Hex("secret", "order_1|pay_1");
		expect(await verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature, keySecret: "secret" })).toBe(true);
		expect(await verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_2", signature, keySecret: "secret" })).toBe(false);
	});

	it("verifies webhook signatures over the raw body", async () => {
		const body = '{"event":"payment.captured"}';
		const signature = await hmacSha256Hex("whsec", body);
		expect(await verifyWebhookSignature(body, signature, "whsec")).toBe(true);
		expect(await verifyWebhookSignature(`${body} `, signature, "whsec")).toBe(false);
		expect(await verifyWebhookSignature(body, null, "whsec")).toBe(false);
	});

	it("compares in constant time and rejects length mismatch", () => {
		expect(safeEqual("abc", "abc")).toBe(true);
		expect(safeEqual("abc", "abd")).toBe(false);
		expect(safeEqual("abc", "ab")).toBe(false);
	});
});
