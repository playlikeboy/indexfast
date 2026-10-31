/*
 * Shell for every free tool page (/tools/<slug>). Counter posture: the working tool is the hero's
 * visual, so the headline, one sentence and the form's primary action are all on the first
 * screen at 1280 x 800. The head column stays put while long results scroll beside it.
 * Each page keeps ownership of its metadata, JSON-LD and guide copy; this only lays them out.
 */
import type { ReactNode } from "react";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { Container } from "@/components/ui";

type Crumb = { name: string; url: string };

export function ToolPage({
	breadcrumbs,
	jsonLd,
	title,
	lead,
	tool,
	children,
}: {
	breadcrumbs: Crumb[];
	jsonLd: object[];
	title: string;
	lead: string;
	tool: ReactNode;
	children: ReactNode;
}) {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				{jsonLd.map((data, i) => (
					<script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
				))}
				<section aria-labelledby="tool-heading">
					<Container className="grid items-start gap-y-10 pt-16 pb-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-16 lg:pt-24 lg:pb-16">
						<div className="min-w-0 lg:sticky lg:top-24">
							<h1 id="tool-heading" className="max-w-[12ch] text-display-s leading-[1.02]">
								{title}
							</h1>
							<p className="mt-6 max-w-[36ch] text-lead text-ink-2">{lead}</p>
						</div>
						<div className="min-w-0">{tool}</div>
					</Container>
				</section>
				<section aria-label={`About the ${title}`} className="pb-(--section-gap)">
					<Container>
						<div className="divide-y divide-border border-y border-border">{children}</div>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}

/*
 * One topic of a tool's guide: the question as the head on the left, the answer on the right,
 * rows parted by hairlines. Lists and inline code inside the answer are styled here so pages pass
 * plain markup.
 */
export function GuideTopic({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="grid gap-y-6 py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-16 lg:py-16">
			{/* text-title keeps the h1 the largest head at every width; these are doc rows, not heroes. */}
			<h2 className="text-title leading-tight">{title}</h2>
			<div className="min-w-0 max-w-[65ch] space-y-4 text-ink-2 [&_code]:font-mono [&_code]:text-sm [&_code]:text-ink [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
				{children}
			</div>
		</div>
	);
}

/* A term and its meaning, for guide lists that pair a name with what it does. */
export function GuideTerms({ items }: { items: Array<{ term: ReactNode; meaning: ReactNode }> }) {
	return (
		<dl className="divide-y divide-border border-y border-border">
			{items.map((item, i) => (
				<div key={i} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-6">
					<dt className="font-display font-medium text-ink">{item.term}</dt>
					<dd className="min-w-0">{item.meaning}</dd>
				</div>
			))}
		</dl>
	);
}
