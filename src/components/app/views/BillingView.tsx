/**
 * Billing: current plan and expiry, the visible plans (Razorpay only; Dodo is hidden), the
 * expiry policy in plain words, and payment history. Prices, periods and limits come from
 * plans.ts only. One primary key on the screen: the recommended plan's checkout.
 */
import { Check } from "lucide-react";
import { RazorpayCheckout } from "@/components/app/RazorpayCheckout";
import { EmptyState, PageHeader, RENEW_REMINDER_DAYS, formatDate, formatMoney, statusLabel, tableInPanel } from "@/components/app/ui";
import { Badge, Panel, Status, Table, Td, Th, cn, type StatusTone } from "@/components/ui";
import { PLAN_GRACE_DAYS, PLAN_PERIOD_DAYS, VISIBLE_PLANS, isPaidPlan, type Entitlement } from "@/lib/platform/plans";
import type { BillingOverview } from "@/lib/platform/razorpay-billing";

// The plan whose checkout is the screen's one primary action.
const RECOMMENDED_PLAN = "unlimited";

const planTone: Record<Entitlement["status"], StatusTone> = {
	free: "neutral",
	active: "success",
	grace: "danger",
	expired: "neutral",
};

const paymentTone: Record<string, StatusTone> = { paid: "success", failed: "danger", refunded: "neutral", created: "neutral" };

function checkoutLabel(entitlement: Entitlement, planId: string, planName: string) {
	if (entitlement.tier === planId) return `Renew, add ${PLAN_PERIOD_DAYS} days`;
	if (entitlement.tier === "unlimited" && planId === "pro") return "Switch to Pro";
	return `Get ${planName}`;
}

function CurrentPlan({ entitlement }: { entitlement: Entitlement }) {
	const legacy = !isPaidPlan(entitlement.purchasedTier) && entitlement.purchasedTier !== "free";
	const statusText = {
		free: "Free plan",
		active: entitlement.expiresAt ? `Active until ${formatDate(entitlement.expiresAt)}` : "Active",
		grace: `Expired ${formatDate(entitlement.expiresAt)}, grace until ${formatDate(entitlement.graceEndsAt)}`,
		expired: `Ended ${formatDate(entitlement.expiresAt)}`,
	}[entitlement.status];

	return (
		<Panel className="mb-8">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="min-w-0">
					<p className="text-sm text-muted">Current plan</p>
					<p className="mt-1 font-display text-xl font-semibold">{entitlement.plan.name}</p>
					<div className="mt-2">
						<Status tone={planTone[entitlement.status]}>{statusText}</Status>
					</div>
					{legacy ? <p className="mt-2 text-sm text-muted">Legacy subscription, managed by your original billing provider.</p> : null}
				</div>
				{entitlement.daysLeft !== null && entitlement.daysLeft > 0 ? (
					<p className="text-sm text-muted">
						<span className="num font-display text-xl font-semibold text-ink">{entitlement.daysLeft}</span> day{entitlement.daysLeft === 1 ? "" : "s"} left
					</p>
				) : null}
			</div>
		</Panel>
	);
}

/** Pure view for Billing. */
export function BillingView({ data }: { data: Pick<BillingOverview, "entitlement" | "history"> }) {
	const { entitlement, history } = data;

	return (
		<>
			<PageHeader title="Billing" description="Prepaid plans. No auto-charge, no surprise renewals." />

			<CurrentPlan entitlement={entitlement} />

			<h2 className="mb-4 text-lg font-semibold">Plans</h2>
			<div className="mb-8 grid gap-4 md:grid-cols-3">
				{VISIBLE_PLANS.map((plan) => {
					const current = entitlement.tier === plan.id;
					const recommended = plan.id === RECOMMENDED_PLAN;
					return (
						<Panel key={plan.id} as="article" className={cn("flex flex-col", recommended && "border-border-strong")}>
							<div className="flex items-center justify-between gap-2">
								<h3 className="text-md font-semibold">{plan.name}</h3>
								{current ? <Badge>Current plan</Badge> : null}
							</div>
							<p className="mt-3">
								<span className="num font-display text-2xl font-semibold">${plan.priceUsd}</span>
								{plan.priceUsd > 0 ? <span className="text-sm text-muted"> per {PLAN_PERIOD_DAYS} days</span> : null}
							</p>
							<p className="mt-1 text-sm text-muted">{plan.tagline}</p>
							<ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
								{plan.features.map((feature) => (
									<li key={feature} className="flex gap-2">
										<Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
										{feature}
									</li>
								))}
							</ul>
							<div className="mt-5">
								{isPaidPlan(plan.id) ? (
									<RazorpayCheckout plan={plan.id} variant={recommended ? "primary" : "secondary"} label={checkoutLabel(entitlement, plan.id, plan.name)} />
								) : (
									<p className="flex min-h-10 items-center text-sm text-muted">{current ? "Your current plan" : "Free forever"}</p>
								)}
							</div>
						</Panel>
					);
				})}
			</div>

			<Panel className="mb-8" title="How plans work">
				<ul className="flex max-w-[75ch] list-disc flex-col gap-2 pl-5 text-sm text-ink-2 marker:text-muted">
					<li>Each payment gives {PLAN_PERIOD_DAYS} days. Renewing early adds time on top of what is left.</li>
					<li>Switching plan starts the new plan immediately.</li>
					<li>You get a reminder {RENEW_REMINDER_DAYS} days before the end. Nothing is charged automatically.</li>
					<li>After the end date you keep full access for a {PLAN_GRACE_DAYS}-day grace period.</li>
					<li>Then the account moves to Free: your oldest site keeps running daily, other sites pause. Nothing is deleted, and paying again resumes everything.</li>
				</ul>
			</Panel>

			<Panel padded={false} title="Payment history">
				{history.length === 0 ? (
					<EmptyState title="No payments yet">Payments you make on this page appear here with their period and status.</EmptyState>
				) : (
					<Table caption="Payment history" className={tableInPanel}>
						<thead>
							<tr>
								<Th>Date</Th>
								<Th>Plan</Th>
								<Th numeric>Amount</Th>
								<Th>Period</Th>
								<Th>Status</Th>
							</tr>
						</thead>
						<tbody>
							{history.map((payment) => (
								<tr key={payment.id}>
									<Td className="whitespace-nowrap">{formatDate(payment.createdAt)}</Td>
									<Td>{statusLabel(payment.plan)}</Td>
									<Td numeric>{formatMoney(payment.amount, payment.currency)}</Td>
									<Td className="whitespace-nowrap text-muted">{payment.periodStart ? `${formatDate(payment.periodStart)} to ${formatDate(payment.periodEnd)}` : "No period"}</Td>
									<Td>
										<Status tone={paymentTone[payment.status] ?? "neutral"}>{statusLabel(payment.status)}</Status>
									</Td>
								</tr>
							))}
						</tbody>
					</Table>
				)}
			</Panel>
		</>
	);
}
