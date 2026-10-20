"use client";

/**
 * Razorpay Checkout button. Flow: server action creates the order -> load checkout.js ->
 * modal -> on success POST the signed result back (confirmPaymentAction). The webhook
 * activates the same order independently, so closing the tab after paying is safe.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { confirmPaymentAction, createCheckoutAction } from "@/app/actions";
import { buttonClass } from "./ui";

type RazorpaySuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void };
declare global {
	interface Window {
		Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
	}
}

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

export function RazorpayCheckout({ plan, label, variant = "primary" }: { plan: "pro" | "unlimited"; label: string; variant?: keyof typeof buttonClass }) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

	async function start() {
		setBusy(true);
		setMessage(null);
		try {
			const [order] = await Promise.all([createCheckoutAction(plan), loadCheckoutScript()]);
			if (!order?.ok || !order.data) throw new Error(order?.error || "Could not start checkout.");
			const data = order.data as { keyId: string; orderId: string; amount: number; currency: string; planName: string; email: string; name: string };

			const checkout = new window.Razorpay!({
				key: data.keyId,
				order_id: data.orderId,
				amount: data.amount,
				currency: data.currency,
				name: "IndexFast",
				description: `${data.planName} plan, 30 days`,
				prefill: { email: data.email, name: data.name },
				theme: { color: "#111110" },
				modal: { ondismiss: () => setBusy(false) },
				handler: async (response: RazorpaySuccess) => {
					const result = await confirmPaymentAction({
						orderId: response.razorpay_order_id,
						paymentId: response.razorpay_payment_id,
						signature: response.razorpay_signature,
					});
					setMessage({ ok: Boolean(result?.ok), text: (result?.ok ? result.message : result?.error) || "" });
					setBusy(false);
					router.refresh();
				},
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
		<div className="space-y-2">
			<button type="button" onClick={start} disabled={busy} className={`${buttonClass[variant]} w-full`}>
				{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
				{label}
			</button>
			{message ? <p className={`text-sm ${message.ok ? "text-[var(--app-ok)]" : "text-[var(--app-bad)]"}`}>{message.text}</p> : null}
		</div>
	);
}
