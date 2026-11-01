/*
 * /compare/<slug>: one "IndexFast vs <tool>" page per entry in `comparisons` (marketing-data.ts).
 * Rules: the answer comes first (summary), every competitor fact is something readable on the
 * linked public page as of `checked`, competitor prices are never stated, IndexFast prices come
 * from plans.ts, and the visible FAQ and its FAQPage markup are built from the same array.
 * Only listed slugs render (unknown ids return notFound()).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { Container, Table, Td, Th, buttonClass } from "@/components/ui";
import { comparisons, getComparisonBySlug } from "@/lib/marketing-data";
import { PLANS, PLAN_PERIOD_DAYS } from "@/lib/platform/plans";
import { SITE_URL, withPageSeo } from "@/lib/seo";

type Params = Promise<{ slug: string }>;

// dynamicParams stays on: without an OpenNext incremental cache the Worker cannot serve
// prerendered params, so with it off every page 404s in production. Unknown ids hit notFound().

export function generateStaticParams() {
	return comparisons.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { slug } = await params;
	const item = getComparisonBySlug(slug);
	if (!item) return {};
	return withPageSeo(`/compare/${item.slug}`, {
		title: `IndexFast vs ${item.competitor}: Honest Comparison`,
		description: item.summary.length > 160 ? `${item.summary.slice(0, item.summary.lastIndexOf(" ", 157))}...` : item.summary,
	});
}

function formatDate(iso: string) {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

const indexFastPricing = `Free, Pro $${PLANS.pro.priceUsd} or Unlimited $${PLANS.unlimited.priceUsd}, each prepaid for ${PLAN_PERIOD_DAYS} days with no auto-renewal`;

export default async function ComparisonPage({ params }: { params: Params }) {
	const { slug } = await params;
	const item = getComparisonBySlug(slug);
	if (!item) notFound();
	const url = `${SITE_URL}/compare/${item.slug}`;
	const rows = [...item.rows, { label: "Pricing", indexfast: indexFastPricing, competitor: item.competitorPricing }];
	const others = comparisons.filter((other) => other.slug !== item.slug);

	const faqJsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: item.faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })),
	};

	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd
					items={[
						{ name: "Home", url: SITE_URL },
						{ name: "Compare", url: `${SITE_URL}/compare` },
						{ name: `IndexFast vs ${item.competitor}`, url },
					]}
				/>
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
				<header className="pt-16 pb-16">
					<Container>
						<div className="max-w-3xl">
							<h1 className="text-display-s">IndexFast vs {item.competitor}</h1>
							<p className="mt-6 max-w-2xl text-lead text-ink-2">{item.summary}</p>
							<p className="mt-6 text-sm text-muted">
								{item.category}. Facts checked on <time dateTime={item.checked}>{formatDate(item.checked)}</time> against{" "}
								<a href={item.competitorUrl} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-border-strong underline-offset-4 hover:decoration-signal">
									{item.competitor}&apos;s public page
								</a>
								. Products change; confirm current details there.
							</p>
						</div>
					</Container>
				</header>

				<section aria-labelledby="table-heading" className="pb-(--section-gap-s)">
					<Container>
						<h2 id="table-heading" className="text-section">
							Side by side
						</h2>
						<Table caption={`IndexFast compared with ${item.competitor}`} className="mt-8">
							<thead>
								<tr>
									<Th className="w-44">Feature</Th>
									<Th>IndexFast</Th>
									<Th>{item.competitor}</Th>
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr key={row.label}>
										<Td className="font-display font-medium text-ink">{row.label}</Td>
										<Td className="min-w-56 text-ink-2">{row.indexfast}</Td>
										<Td className="min-w-56 text-ink-2">{row.competitor}</Td>
									</tr>
								))}
							</tbody>
						</Table>
					</Container>
				</section>

				<section aria-label="Which to choose" className="pb-(--section-gap-s)">
					<Container className="grid gap-12 md:grid-cols-2 md:gap-16">
						<div className="min-w-0">
							<h2 className="text-title">Choose {item.competitor} if</h2>
							<ul className="mt-4 list-disc space-y-2 pl-5 text-md text-ink-2 marker:text-muted">
								{item.chooseCompetitor.map((line) => (
									<li key={line} className="pl-1">
										{line}
									</li>
								))}
							</ul>
						</div>
						<div className="min-w-0">
							<h2 className="text-title">Choose IndexFast if</h2>
							<ul className="mt-4 list-disc space-y-2 pl-5 text-md text-ink-2 marker:text-muted">
								{item.chooseIndexFast.map((line) => (
									<li key={line} className="pl-1">
										{line}
									</li>
								))}
							</ul>
						</div>
					</Container>
				</section>

				<section aria-labelledby="faq-heading" className="border-t border-border py-(--section-gap-s)">
					<Container>
						<h2 id="faq-heading" className="text-section">
							Frequently asked questions
						</h2>
						<dl className="mt-8 max-w-3xl divide-y divide-border border-y border-border">
							{item.faqs.map((faq) => (
								<div key={faq.question} className="py-6">
									<dt className="font-display text-lg font-medium text-ink">{faq.question}</dt>
									<dd className="mt-3 text-md text-ink-2">{faq.answer}</dd>
								</div>
							))}
						</dl>
					</Container>
				</section>

				<section aria-labelledby="more-heading" className="pb-(--section-gap)">
					<Container>
						<h2 id="more-heading" className="text-title">
							More comparisons
						</h2>
						<ul className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-2">
							{others.map((other) => (
								<li key={other.slug}>
									<Link href={`/compare/${other.slug}`} className="text-md text-ink underline decoration-border-strong underline-offset-4 hover:decoration-signal">
										IndexFast vs {other.competitor}
									</Link>
								</li>
							))}
						</ul>
						<div className="mt-12 flex flex-wrap gap-3">
							<Link href="/dashboard" className={buttonClass({ variant: "primary", size: "lg" })}>
								Start free
							</Link>
							<Link href="/pricing" className={buttonClass({ variant: "secondary", size: "lg" })}>
								See pricing
							</Link>
						</div>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
