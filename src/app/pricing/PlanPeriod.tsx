/**
 * How a prepaid period runs out, drawn as a ruler of three stops (pay, period ends, grace ends).
 * Every day count comes from src/lib/platform/plans.ts so the page can never promise a longer
 * period or grace than the cron enforces. Followed by the one honesty statement the pricing page
 * owes: discovery is sped up, Google indexing is never guaranteed.
 */
import { PLAN_GRACE_DAYS, PLAN_PERIOD_DAYS } from "@/lib/platform/plans";
import { Container } from "@/components/ui";

const stops = [
	{
		day: 0,
		title: "Prepaid, not subscribed",
		line: `Each payment covers ${PLAN_PERIOD_DAYS} days. No auto-renewal.`,
	},
	{
		day: PLAN_PERIOD_DAYS,
		title: "The period ends",
		line: "Renew early and the time stacks.",
	},
	{
		day: PLAN_PERIOD_DAYS + PLAN_GRACE_DAYS,
		title: "Back to Free",
		line: `${PLAN_GRACE_DAYS} days of grace end. Extra sites pause, nothing is deleted.`,
	},
];

export function PlanPeriod() {
	return (
		<>
			<section className="bg-well py-(--section-gap-s)" aria-labelledby="plan-period-heading">
				<Container>
					<h2 id="plan-period-heading" className="max-w-[20ch] font-display text-section text-ink">
						How a paid period ends
					</h2>
					<ol className="mt-16 grid gap-10 border-l border-border-strong pl-6 lg:grid-cols-3 lg:gap-8 lg:border-t lg:border-l-0 lg:pl-0">
						{stops.map((stop) => (
							<li
								key={stop.day}
								className="relative flex min-w-0 flex-col gap-2 before:absolute before:top-3 before:-left-6 before:h-px before:w-4 before:bg-ink before:content-[''] lg:pt-8 lg:before:top-0 lg:before:left-0 lg:before:h-4 lg:before:w-px"
							>
								<p className="num font-display text-display-s leading-none font-semibold tracking-display text-ink">Day {stop.day}</p>
								<h3 className="mt-2 font-display text-title text-ink">{stop.title}</h3>
								<p className="max-w-[36ch] text-ink-2">{stop.line}</p>
							</li>
						))}
					</ol>
				</Container>
			</section>
			<section className="py-(--section-gap)" aria-label="What a plan can promise">
				<Container>
					<p className="max-w-[30ch] font-display text-section leading-[1.1] font-semibold tracking-display text-ink">
						We speed up discovery through IndexNow and Bing. No one can guarantee Google indexing.
					</p>
				</Container>
			</section>
		</>
	);
}
