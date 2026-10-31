/*
 * Landing-page pricing: every plan, price and feature comes from VISIBLE_PLANS in
 * src/lib/platform/plans.ts so the site, dashboard and checkout cannot disagree. Checkout runs in
 * /dashboard/billing (Razorpay); the full terms live on /pricing. Plans sit in hairline columns
 * rather than cards, and only the hero carries the page's primary key. The landing shows only the
 * first three features of each plan (sites, URLs, sync cadence) to keep the screen scannable;
 * "Plan details" leads to the full lists.
 */
import Link from "next/link";
import { Check } from "lucide-react";
import { Container, buttonClass } from "@/components/ui";
import { VISIBLE_PLANS } from "@/lib/platform/plans";

const paidFrom = Math.min(...VISIBLE_PLANS.filter((plan) => plan.priceUsd > 0).map((plan) => plan.priceUsd));

export function HomePricing() {
	return (
		<section id="pricing" aria-labelledby="pricing-heading" className="border-t border-border py-(--section-gap)">
			<Container>
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h2 id="pricing-heading" className="text-section">
							Free to start. ${paidFrom} when you grow.
						</h2>
						<p className="mt-4 max-w-[52ch] text-lead text-ink-2">Pay for 30 days when you need more. No auto-renewal.</p>
					</div>
					<Link href="/pricing" className="text-md text-ink-2 underline decoration-border-strong underline-offset-4 hover:decoration-signal">
						Plan details
					</Link>
				</div>

				<div className="mt-16 grid gap-x-(--gap-columns) gap-y-12 md:grid-cols-3">
					{VISIBLE_PLANS.map((plan) => (
						<article key={plan.id} className="flex min-w-0 flex-col border-t border-border-strong pt-6">
							<h3 className="text-title">{plan.name}</h3>
							<p className="mt-6 flex items-baseline gap-2">
								<span className="num font-display text-display-s leading-none font-semibold tracking-display">${plan.priceUsd}</span>
								{plan.priceUsd > 0 ? <span className="text-muted">per 30 days</span> : null}
							</p>
							<p className="mt-4 text-ink-2">{plan.tagline}</p>
							<ul className="mt-6 flex-1 space-y-3">
								{plan.features.slice(0, 3).map((feature) => (
									<li key={feature} className="flex items-start gap-3 text-ink-2">
										<Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-ink" />
										{feature}
									</li>
								))}
							</ul>
							<Link href={plan.priceUsd > 0 ? "/dashboard/billing" : "/signup"} className={buttonClass({ size: "lg", className: "mt-8 self-start" })}>
								{plan.priceUsd > 0 ? `Get ${plan.name}` : "Start free"}
							</Link>
						</article>
					))}
				</div>
			</Container>
		</section>
	);
}
