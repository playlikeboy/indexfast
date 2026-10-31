/*
 * /tools: the index of free, no-signup SEO tools. Index posture: the list is the reason to come,
 * so the head is short and the tools start on the first screen, grouped by what the visitor has
 * in hand (one URL, a whole site, or a setup job). The list comes from marketing-data so the
 * sitemap and this page stay in step; a tool missing from a group still shows, in the last one.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { Badge, Container } from "@/components/ui";
import { TOOL_LEADS } from "@/components/tools/tool-leads";
import { tools, type ToolDefinition } from "@/lib/marketing-data";

const SITE_URL = "https://indexfast.co";

export const metadata: Metadata = {
	title: "Free SEO Indexing & Diagnostics Tools",
	description:
		"Diagnose search index status, extract XML sitemaps, verify robots.txt, audit canonical tags, and check HTTP status codes. Free, no signup required.",
	keywords: [
		"free seo tools",
		"google index checker",
		"sitemap url extractor",
		"robots.txt checker",
		"indexnow key generator",
		"canonical tag checker",
	],
	alternates: {
		canonical: `${SITE_URL}/tools`,
	},
};

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
];

const GROUPS: Array<{ id: string; title: string; slugs: string[] }> = [
	{
		id: "one-url",
		title: "Check one URL",
		slugs: ["google-index-checker", "http-status-checker", "noindex-tag-checker", "canonical-checker"],
	},
	{
		id: "whole-site",
		title: "Check a whole site",
		slugs: ["bulk-index-checker", "sitemap-url-extractor", "robots-txt-checker", "ai-crawler-checker"],
	},
	{
		id: "set-up",
		title: "Generate files and submit URLs",
		slugs: ["indexnow-key-generator", "bing-indexnow-submitter", "llms-txt-generator"],
	},
];

function groupTools(): Array<{ id: string; title: string; items: ToolDefinition[] }> {
	const grouped = new Set(GROUPS.flatMap((g) => g.slugs));
	const ungrouped = tools.filter((t) => !grouped.has(t.slug));
	return GROUPS.map((g, i) => ({
		id: g.id,
		title: g.title,
		items: [
			...g.slugs.map((slug) => tools.find((t) => t.slug === slug)).filter((t): t is ToolDefinition => Boolean(t)),
			...(i === GROUPS.length - 1 ? ungrouped : []),
		],
	}));
}

function ToolRow({ tool }: { tool: ToolDefinition }) {
	return (
		<li>
			<Link
				href={`/tools/${tool.slug}`}
				className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-1 py-5 no-underline outline-offset-4"
			>
				<span className="flex min-w-0 flex-wrap items-center gap-3">
					<span className="font-display text-title font-medium text-ink decoration-signal underline-offset-4 group-hover:underline">
						{tool.title}
					</span>
					{tool.tag ? <Badge>{tool.tag}</Badge> : null}
				</span>
				<ArrowRight
					aria-hidden="true"
					className="row-span-2 mt-1.5 size-5 text-muted transition-transform duration-(--dur-short) ease-(--ease-out) group-hover:translate-x-1 group-hover:text-signal"
				/>
				<span className="max-w-[60ch] text-ink-2">{TOOL_LEADS[tool.slug] ?? tool.description}</span>
			</Link>
		</li>
	);
}

export default function ToolsPage() {
	const groups = groupTools();
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<section id="tools" aria-labelledby="tools-heading">
					<Container className="pt-16 pb-10 lg:pt-24 lg:pb-16">
						<h1 id="tools-heading" className="max-w-[16ch] text-display leading-[1.02]">
							Free tools to find indexing issues
						</h1>
						<p className="mt-6 max-w-[44ch] text-lead text-ink-2">
							Check status codes, sitemaps, robots.txt and canonicals. No signup required.
						</p>
					</Container>
				</section>
				<div className="pb-(--section-gap)">
					<Container>
						{groups.map((group) => (
							<section
								key={group.id}
								aria-labelledby={`group-${group.id}`}
								className="grid gap-y-4 border-t border-border-strong py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-16 lg:py-14"
							>
								<h2 id={`group-${group.id}`} className="text-3xl leading-[1.05] lg:text-section">
									{group.title}
								</h2>
								<ul className="min-w-0 divide-y divide-border">
									{group.items.map((tool) => (
										<ToolRow key={tool.slug} tool={tool} />
									))}
								</ul>
							</section>
						))}
					</Container>
				</div>
			</main>
			<Footer />
		</>
	);
}
