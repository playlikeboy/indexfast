/**
 * Marketing pricing. Plans and prices come from src/lib/platform/plans.ts (VISIBLE_PLANS)
 * so the site, dashboard and checkout can never disagree. Checkout happens in the
 * dashboard (/dashboard/billing) via Razorpay; signed-out visitors are sent to sign in first.
 *
 * Rendered only on /pricing, where this block is the page's hero and owns its h1 (the landing page
 * has its own HomePricing). The plans are columns parted by hairlines, not cards:
 * a tier is emphasised only by its key and one word, never by a different card colour.
 */
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge, Container, buttonClass } from "@/components/ui";
import { PLAN_PERIOD_DAYS, VISIBLE_PLANS } from "@/lib/platform/plans";

// The tier sold as "everything" carries the screen's one primary key; the others are secondary.
const FEATURED_PLAN_ID = "unlimited";

export function Pricing() {
	return (
		<section className="pt-16 pb-(--section-gap-s)" id="pricing" aria-labelledby="pricing-heading">
			<Container>
				{/* A header of its own: on /pricing it is the banner hero (head and one line), the plans sit under it. */}
				<header className="grid gap-4 lg:grid-cols-12 lg:items-end lg:gap-8">
					<h1 id="pricing-heading" className="font-display text-display-s text-ink lg:col-span-7">
						Two paid plans. No surprises.
					</h1>
					<p className="text-lead text-ink-2 lg:col-span-4 lg:col-start-9">
						Start free. Pay for {PLAN_PERIOD_DAYS} days when you need more.
					</p>
				</header>

				<div className="mt-10 grid border-t border-border-strong lg:grid-cols-3">
					{VISIBLE_PLANS.map((plan) => {
						const featured = plan.id === FEATURED_PLAN_ID;
						const paid = plan.priceUsd > 0;
						return (
							<article
								key={plan.id}
								aria-labelledby={`plan-${plan.id}`}
								className="flex min-w-0 flex-col gap-4 border-b border-border py-8 lg:border-b-0 lg:border-l lg:px-8 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0"
							>
								<div className="flex items-center justify-between gap-3">
									<h2 id={`plan-${plan.id}`} className="font-display text-title font-medium text-ink">
										{plan.name}
									</h2>
									{featured ? <Badge>Everything</Badge> : null}
								</div>
								<p className="flex items-baseline gap-1">
									<span className="num font-display text-display-s leading-none font-semibold tracking-display text-ink">${plan.priceUsd}</span>
									{paid ? <span className="text-sm text-muted">/{PLAN_PERIOD_DAYS} days</span> : null}
								</p>
								<p className="text-ink-2">{plan.tagline}</p>
								<ul className="flex flex-1 flex-col gap-2 border-t border-border pt-4">
									{plan.features.map((feature) => (
										<li key={feature} className="flex items-start gap-2 text-ink-2">
											<Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted" />
											{feature}
										</li>
									))}
								</ul>
								<Link
									href={paid ? "/dashboard/billing" : "/dashboard"}
									className={buttonClass({ variant: featured ? "primary" : "secondary", size: "lg", className: "mt-2 w-full" })}
								>
									{paid ? `Get ${plan.name}` : "Start free"}
								</Link>
							</article>
						);
					})}
				</div>
			</Container>
		</section>
	);
}
