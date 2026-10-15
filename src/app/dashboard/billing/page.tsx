/**
 * Billing: current plan + expiry, the two paid plans (Razorpay only; Dodo is hidden), the
 * expiry policy in plain words, and payment history. Pricing comes from plans.ts.
 */
import { Check } from "lucide-react";
import { RazorpayCheckout } from "@/components/app/RazorpayCheckout";
import { Badge, Card, EmptyState, PageHeader, cn, formatDate, formatMoney } from "@/components/app/ui";
import { requireSessionUser } from "@/lib/auth";
import { PLAN_GRACE_DAYS, PLAN_PERIOD_DAYS, VISIBLE_PLANS, isPaidPlan } from "@/lib/platform/plans";
import { getBillingOverview } from "@/lib/platform/razorpay-billing";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
	const user = await requireSessionUser();
	const { entitlement, history } = await getBillingOverview(user.id);
	const legacy = !isPaidPlan(entitlement.purchasedTier) && entitlement.purchasedTier !== "free";

	const statusText = {
		free: "Free plan",
		active: entitlement.expiresAt ? `Active until ${formatDate(entitlement.expiresAt)}` : "Active",
		grace: `Expired ${formatDate(entitlement.expiresAt)}, grace until ${formatDate(entitlement.graceEndsAt)}`,
		expired: `Ended ${formatDate(entitlement.expiresAt)}`,
	}[entitlement.status];

	return (
		<>
			<PageHeader title="Billing" description="Simple prepaid plans. No auto-charge, no surprise renewals." />

			<Card className="mb-6">
				<div className="flex flex-wrap items-center justify-between gap-3 p-5">
					<div>
						<p className="text-sm text-[var(--app-muted)]">Current plan</p>
						<p className="mt-1 flex items-center gap-2 text-xl font-semibold">
							{entitlement.plan.name}
							<Badge tone={entitlement.status === "grace" ? "bad" : entitlement.status === "active" ? "ok" : "neutral"}>{statusText}</Badge>
						</p>
						{legacy ? <p className="mt-1 text-sm text-[var(--app-muted)]">Legacy subscription, managed by your original billing provider.</p> : null}
					</div>
					{entitlement.daysLeft !== null && entitlement.daysLeft > 0 ? (
						<p className="text-sm text-[var(--app-muted)]">{entitlement.daysLeft} days left</p>
					) : null}
				</div>
			</Card>

			<div className="mb-6 grid gap-4 md:grid-cols-3">
				{VISIBLE_PLANS.map((plan) => {
					const current = entitlement.tier === plan.id;
					const highlight = plan.id === "unlimited";
					return (
						<div key={plan.id} className={cn("flex flex-col rounded-xl border bg-[var(--app-panel)] p-5", highlight ? "border-[var(--app-text)]" : "border-[var(--app-border)]")}>
							<div className="flex items-center justify-between">
								<h2 className="font-semibold">{plan.name}</h2>
								{current ? <Badge tone="accent">Current</Badge> : null}
							</div>
							<p className="mt-3">
								<span className="text-3xl font-semibold tracking-tight">${plan.priceUsd}</span>
								{plan.priceUsd > 0 ? <span className="text-sm text-[var(--app-muted)]"> / 30 days</span> : null}
							</p>
							<p className="mt-1 text-sm text-[var(--app-muted)]">{plan.tagline}</p>
							<ul className="mt-4 flex-1 space-y-2 text-sm">
								{plan.features.map((feature) => (
									<li key={feature} className="flex gap-2">
										<Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-ok)]" aria-hidden />
										{feature}
									</li>
								))}
							</ul>
							<div className="mt-5">
								{isPaidPlan(plan.id) ? (
									<RazorpayCheckout
										plan={plan.id}
										variant={highlight ? "primary" : "secondary"}
										label={current ? `Renew +${PLAN_PERIOD_DAYS} days` : entitlement.tier === "unlimited" && plan.id === "pro" ? "Switch to Pro" : `Get ${plan.name}`}
									/>
								) : null}
							</div>
						</div>
					);
				})}
			</div>

			<Card className="mb-6" title="How plans work">
				<ul className="space-y-2 p-5 text-sm text-[var(--app-muted)]">
					<li>Each payment gives {PLAN_PERIOD_DAYS} days. Renewing early adds time on top of what is left.</li>
					<li>Switching plan starts the new plan immediately.</li>
					<li>You get a reminder 5 days before the end. Nothing is charged automatically.</li>
					<li>After the end date you keep full access for a {PLAN_GRACE_DAYS}-day grace period.</li>
					<li>Then the account moves to Free: your oldest site keeps running daily, other sites pause. Nothing is deleted, and paying again resumes everything.</li>
				</ul>
			</Card>

			<Card title="Payment history">
				{history.length === 0 ? (
					<EmptyState title="No payments yet" />
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="text-left text-xs text-[var(--app-muted)]">
								<tr>
									<th className="px-5 py-2 font-medium">Date</th>
									<th className="px-5 py-2 font-medium">Plan</th>
									<th className="px-5 py-2 font-medium">Amount</th>
									<th className="px-5 py-2 font-medium">Period</th>
									<th className="px-5 py-2 font-medium">Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[var(--app-border)]">
								{history.map((payment) => (
									<tr key={payment.id}>
										<td className="px-5 py-2.5">{formatDate(payment.createdAt)}</td>
										<td className="px-5 py-2.5 capitalize">{payment.plan}</td>
										<td className="px-5 py-2.5">{formatMoney(payment.amount, payment.currency)}</td>
										<td className="px-5 py-2.5 text-[var(--app-muted)]">{payment.periodStart ? `${formatDate(payment.periodStart)} to ${formatDate(payment.periodEnd)}` : "-"}</td>
										<td className="px-5 py-2.5">
											<Badge tone={payment.status === "paid" ? "ok" : payment.status === "failed" ? "bad" : "neutral"}>{payment.status}</Badge>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>
		</>
	);
}
