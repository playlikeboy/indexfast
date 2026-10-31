"use client";

/**
 * Razorpay Checkout key. Flow: server action creates the order -> load checkout.js -> modal ->
 * on success POST the signed result back (confirmPaymentAction). The webhook activates the same
 * order independently, so closing the tab after paying is safe, and a failed confirm call is
 * not a failed payment: the user is told the plan is activating, never that they were charged
 * for nothing. Every path ends with busy cleared so the key cannot spin forever.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmPaymentAction, createCheckoutAction } from "@/app/actions";
import { Button, stackCobaltTheme, type ButtonVariant } from "@/components/ui";
import { PLAN_PERIOD_DAYS } from "@/lib/platform/plans";
import { ResultMessage } from "./client";

type RazorpaySuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void };
declare global {
	interface Window {
		Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
	}
}

const ACTIVATING_MESSAGE = "Payment received, activating. Refresh in a minute.";

function loadCheckoutScript() {
	return new Promise<void>((resolve, reject) => {
		if (window.Razorpay) return resolve();
		const script = document.createElement("script");
		script.src = "https://checkout.razorpay.com/v1/checkout.js";
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Could not load Razorpay. Check your connection or ad blocker."));
		document.body.appendChild(script);
	});
}

export function RazorpayCheckout({ plan, label, variant = "primary" }: { plan: "pro" | "unlimited"; label: string; variant?: ButtonVariant }) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

	async function confirm(response: RazorpaySuccess) {
		try {
			const result = await confirmPaymentAction({
				orderId: response.razorpay_order_id,
				paymentId: response.razorpay_payment_id,
				signature: response.razorpay_signature,
			});
			// The money moved either way; an unconfirmed result still activates through the webhook.
			setMessage(result?.ok ? { ok: true, text: result.message || ACTIVATING_MESSAGE } : { ok: true, text: ACTIVATING_MESSAGE });
		} catch {
			setMessage({ ok: true, text: ACTIVATING_MESSAGE });
		} finally {
			setBusy(false);
			router.refresh();
		}
	}

	async function start() {
		setBusy(true);
		setMessage(null);
		try {
			const [order] = await Promise.all([createCheckoutAction(plan), loadCheckoutScript()]);
			if (!order?.ok || !order.data) throw new Error(order?.error || "Could not start checkout.");
			const data = order.data as { keyId: string; orderId: string; amount: number; currency: string; planName: string; email: string; name: string };
			if (!window.Razorpay) throw new Error("Could not load Razorpay. Check your connection or ad blocker.");

			const checkout = new window.Razorpay({
				key: data.keyId,
				order_id: data.orderId,
				amount: data.amount,
				currency: data.currency,
				name: "IndexFast",
				description: `${data.planName} plan, ${PLAN_PERIOD_DAYS} days`,
				prefill: { email: data.email, name: data.name },
				// Razorpay reads hex only; this is the sRGB mirror of --color-accent.
				theme: { color: stackCobaltTheme.light.primary },
				modal: { ondismiss: () => setBusy(false) },
				handler: (response: RazorpaySuccess) => void confirm(response),
			});
			checkout.on("payment.failed", (response) => {
				setMessage({ ok: false, text: response.error?.description || "Payment failed. You were not charged." });
			});
			checkout.open();
		} catch (error) {
			setMessage({ ok: false, text: error instanceof Error ? error.message : "Checkout failed." });
			setBusy(false);
		}
	}

	return (
		<div className="flex flex-col gap-2">
			<Button onClick={start} loading={busy} variant={variant} className="w-full">
				{label}
			</Button>
			{message ? <ResultMessage result={message.ok ? { ok: true, message: message.text } : { ok: false, error: message.text }} /> : null}
		</div>
	);
}
