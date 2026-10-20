/**
 * Marketing pricing. Plans and prices come from src/lib/platform/plans.ts (VISIBLE_PLANS)
 * so the site, dashboard and checkout can never disagree. Checkout happens in the
 * dashboard (/dashboard/billing) via Razorpay; signed-out visitors are sent to sign in first.
 */
import Link from "next/link";
import { PLAN_GRACE_DAYS, VISIBLE_PLANS } from "@/lib/platform/plans";

export function Pricing({ compact = false }: { compact?: boolean }) {
	return (
		<section className={`border-b border-border/40 ${compact ? "py-16 sm:py-20" : "bg-card/20 py-20 sm:py-24"}`} id="pricing" aria-labelledby="pricing-heading">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="label-mono">Pricing</p>
						<h2 id="pricing-heading" className={compact ? "mt-2 text-3xl font-bold tracking-tight" : "display mt-3 max-w-2xl text-4xl sm:text-5xl"}>
							{compact ? "Simple pricing." : <>Two plans. <span className="text-highlight">No surprises.</span></>}
						</h2>
						<p className="mt-3 max-w-2xl text-muted">Start free. Pay for 30 days when you need more. No auto-renewal, cancel by simply not renewing.</p>
					</div>
					{compact ? (
						<Link href="/pricing" className="text-sm font-medium text-ink underline underline-offset-4">
							Plan details
						</Link>
					) : null}
				</div>

				<div className="mt-10 grid gap-5 md:grid-cols-3">
					{VISIBLE_PLANS.map((plan) => {
						const highlight = plan.id === "unlimited";
						return (
							<article key={plan.id} className={`flex flex-col rounded-lg border p-6 ${highlight ? "border-accent bg-zinc-950 text-zinc-100 shadow-xl dark:bg-zinc-900" : "border-border/70 bg-card/40"}`}>
								<div className="flex items-center justify-between">
									<h3 className={`text-sm font-bold uppercase tracking-wide ${highlight ? "text-zinc-100" : "text-ink"}`}>{plan.name}</h3>
									{highlight ? <span className="rounded-sm bg-accent/15 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">Everything</span> : null}
								</div>
								<div className="mt-4 flex items-baseline gap-1">
									<span className={`stat text-4xl ${highlight ? "text-accent" : "text-ink"}`}>${plan.priceUsd}</span>
									{plan.priceUsd > 0 ? <span className={`text-xs ${highlight ? "text-zinc-400" : "text-muted"}`}>/month</span> : null}
								</div>
								<p className={`mt-2 text-sm ${highlight ? "text-zinc-400" : "text-muted"}`}>{plan.tagline}</p>
								<ul className="mt-5 flex-1 space-y-2.5">
									{plan.features.map((feature) => (
										<li key={feature} className={`flex items-start gap-2 text-sm ${highlight ? "text-zinc-300" : "text-muted"}`}>
											<svg width="12" height="12" viewBox="0 0 14 14" fill="none" className={`mt-1 shrink-0 ${highlight ? "text-accent" : "text-ink"}`} aria-hidden="true">
												<path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
											</svg>
											{feature}
										</li>
									))}
								</ul>
								<Link
									href={plan.priceUsd > 0 ? "/dashboard/billing" : "/dashboard"}
									className={`mt-6 inline-flex min-h-10 items-center justify-center rounded-sm px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wide transition ${
										highlight ? "bg-accent text-accent-foreground hover:bg-accent-dark" : "border border-border text-ink hover:border-ink"
									}`}
								>
									{plan.priceUsd > 0 ? `Get ${plan.name}` : "Start free"}
								</Link>
							</article>
						);
					})}
				</div>

				{compact ? null : (
					<div className="mt-10 grid gap-4 text-sm text-muted sm:grid-cols-3">
						<p>
							<strong className="text-ink">Prepaid, not subscribed.</strong> Each payment covers 30 days. Renew early and the time stacks.
						</p>
						<p>
							<strong className="text-ink">Gentle expiry.</strong> {PLAN_GRACE_DAYS} days of grace after the end date, then Free. Extra sites pause, nothing is deleted.
						</p>
						<p>
							<strong className="text-ink">Honest.</strong> We speed up discovery through IndexNow and Bing. No one can guarantee Google indexing.
						</p>
					</div>
				)}
			</div>
		</section>
	);
}
