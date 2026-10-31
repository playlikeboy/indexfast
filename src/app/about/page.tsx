/*
 * /about: why IndexFast exists, in three screens (the claim, the belief, the values), then the
 * shared close. The first action sends visitors to the free tools, which run a check without signup.
 * Copy is the page's own; nothing here may promise indexing.
 */
import { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { FinalCTA, Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { Container, buttonClass } from "@/components/ui";

const SITE_URL = "https://indexfast.co";

export const metadata: Metadata = {
	title: "About | IndexFast",
	description:
		"IndexFast is built for programmatic SEO teams. We turn invisible pages into actionable signals for indexing health and visibility.",
};

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "About", url: `${SITE_URL}/about` },
];

const values = [
	{ title: "Transparency first", line: "No fake guarantees, no backlink spam." },
	{ title: "Technical honesty", line: "We tell you what is broken and why." },
	{ title: "Speed and scale", line: "Built for high-volume, fast-moving teams." },
	{ title: "Privacy-respecting", line: "Your data is never sold or used for ads." },
];

export default function AboutPage() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<section className="pt-(--section-gap-s) pb-(--section-gap)" id="about" aria-labelledby="about-heading">
					<Container>
						<h1 id="about-heading" className="max-w-[16ch] font-display text-display text-ink">
							For teams that ship pages fast.
						</h1>
						<p className="mt-6 max-w-[44ch] text-lead text-ink-2">
							IndexFast exists because too many great pages disappear into search-engine black holes.
						</p>
						<div className="mt-10 flex flex-wrap gap-3">
							<Link href="/tools" className={buttonClass({ variant: "primary", size: "lg" })}>
								Run a free check
							</Link>
							<Link href="/contact" className={buttonClass({ size: "lg" })}>
								Contact us
							</Link>
						</div>
					</Container>
				</section>

				<section className="border-t border-border py-(--section-gap-l)" aria-labelledby="about-belief">
					<Container>
						<h2 id="about-belief" className="max-w-[26ch] font-display text-section text-ink">
							Indexing health should be as visible as uptime, conversion rate, or churn.
						</h2>
						<div className="mt-16 grid gap-6 lg:grid-cols-12 lg:gap-8">
							<p className="max-w-[60ch] text-ink-2 lg:col-span-5">
								Programmatic SEO builders, agencies, and content teams launch hundreds or thousands of pages
								every week, and many of them are never indexed.
							</p>
							<p className="max-w-[60ch] text-ink-2 lg:col-span-5 lg:col-start-7">
								IndexFast turns invisible pages into actionable signals: sitemap coverage, indexability
								diagnostics, deindexing alerts, and safe discovery workflows through IndexNow and Google
								Search Console.
							</p>
						</div>
					</Container>
				</section>

				<section className="bg-well py-(--section-gap-s)" aria-labelledby="about-values">
					<Container>
						<div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
							<div className="lg:col-span-4">
								<h2 id="about-values" className="font-display text-section text-ink">
									Our values
								</h2>
								<p className="mt-6 max-w-[40ch] text-ink-2">
									Help search engines discover your pages, detect what is blocking them, and give you the
									data to fix it.
								</p>
							</div>
							<dl className="border-t border-border-strong lg:col-span-7 lg:col-start-6">
								{values.map((value) => (
									<div key={value.title} className="grid gap-1 border-b border-border py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8">
										<dt className="font-display text-title font-medium text-ink">{value.title}</dt>
										<dd className="text-ink-2 sm:pt-1">{value.line}</dd>
									</div>
								))}
							</dl>
						</div>
					</Container>
				</section>

				<FinalCTA />
			</main>
			<Footer />
		</>
	);
}
