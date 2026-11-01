/*
 * /resources: the hub for free, no-signup material (directories, engine APIs, third-party tools,
 * the agent skill, Google API guardrails, MCP setup). A ruled two-column index, not a card grid;
 * counts come from the resource data so the copy never drifts from what the pages list.
 */
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/ui";
import { getDirectoryStats } from "@/lib/resources/directories";
import { seoTools } from "@/lib/resources/tools";
import { ResourceHeader } from "./_components/ResourceHeader";
import type { Metadata } from "next";
import { SITE_URL, withPageSeo } from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";

export const metadata: Metadata = withPageSeo("/resources", {
	title: "Free SEO Resources, Directories, and Agent Tools",
	description:
		"Use IndexFast's free SEO resource hub for prioritized startup directories, third-party SEO tools, MCP setup, CLI workflows, and agent-ready indexing operations.",
});

export default function ResourcesPage() {
	const stats = getDirectoryStats();
	const cards = [
		{
			href: "/resources/directories",
			title: "100+ submission directories",
			desc: `${stats.total} startup, SaaS, AI, developer, review, and community channels sorted by priority.`,
		},
		{
			href: "/resources/search-engines",
			title: "Search engine submission APIs",
			desc: "Developer guide to IndexNow, Bing Webmaster API, Google Search Console, the gated Google Indexing API, Baidu, and Yandex.",
		},
		{
			href: "/resources/tools",
			title: "Third-party SEO tools",
			desc: `${seoTools.length} SEO tools for GSC, schema, crawls, performance, and research.`,
		},
		{
			href: "/resources/skill",
			title: "IndexFast agent skill",
			desc: "A compact SKILL.md that teaches AI IDEs how to use IndexFast safely.",
		},
		{
			href: "/resources/google-indexing-api",
			title: "Google Indexing API guardrails",
			desc: "When Google's Indexing API is eligible, and when sitemap and GSC workflows are the safer path.",
		},
		{
			href: "/compare",
			title: "IndexFast comparisons",
			desc: "How IndexFast differs from Rank Math Instant Indexing, the IndexNow plugin, IndexMeNow, Omega Indexer and Search Console.",
		},
		{
			href: "/dashboard/connect",
			title: "MCP setup",
			desc: "Connect IndexFast to Cursor, Codex, Claude Desktop, and agentic SEO harnesses.",
		},
	];

	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={[{ name: "Home", url: SITE_URL }, { name: "Resources", url: `${SITE_URL}/resources` }]} />
				<ResourceHeader
					title="Free SEO and indexing resources"
					lede="Prioritize launch submissions and wire IndexFast into AI IDEs and CLIs."
				/>
				<section aria-label="Resources" className="pb-(--section-gap)">
					<Container>
						<ul className="grid border-t border-border-strong md:grid-cols-2 md:gap-x-16">
							{cards.map((card) => (
								<li key={card.href} className="border-b border-border">
									<Link href={card.href} className="group block py-8">
										<h2 className="text-title font-medium text-ink underline decoration-transparent underline-offset-4 transition-colors duration-(--dur-short) group-hover:decoration-signal">
											{card.title}
										</h2>
										<p className="mt-2 max-w-[35em] text-md text-ink-2">{card.desc}</p>
									</Link>
								</li>
							))}
						</ul>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
