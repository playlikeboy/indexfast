/*
 * Landing hero (Stage posture): the promise, one sentence, the sign-up action, and beside it the
 * submission pipeline drawn as the Cobalt ASCII field. Headline, sentence and primary action must
 * stay visible at 1280 x 800, so nothing else goes above the actions.
 */
import Link from "next/link";
import { Container, buttonClass } from "@/components/ui";
import { EngineField } from "./landing/EngineField";

export function Hero() {
	return (
		<section aria-labelledby="hero-heading" className="border-b border-border">
			<Container className="grid min-h-[calc(100svh-4rem)] items-center gap-y-10 py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-16 lg:py-10">
				<div className="min-w-0">
					<h1 id="hero-heading" className="max-w-[12ch] text-display leading-[1.02]">
						You ship pages. We get them found.
					</h1>
					<p className="mt-6 max-w-[34ch] text-lead text-ink-2">It watches your sitemap and sends new pages to every IndexNow engine.</p>
					<div className="mt-10 flex flex-col gap-3 sm:flex-row">
						<Link href="/signup" className={buttonClass({ variant: "primary", size: "lg" })}>
							Add your site free
						</Link>
						<Link href="#workflow" className={buttonClass({ size: "lg" })}>
							See how it works
						</Link>
					</div>
					<p className="mt-4 text-sm text-muted">Free for one site, forever. No credit card.</p>
				</div>
				<EngineField />
			</Container>
		</section>
	);
}
