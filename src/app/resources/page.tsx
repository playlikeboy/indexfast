import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { getDirectoryStats } from "@/lib/resources/directories";
import { seoTools } from "@/lib/resources/tools";

export const metadata = {
	title: "Free SEO Resources, Directories, and Agent Tools",
	description:
		"Use IndexFast's free SEO resource hub for prioritized startup directories, third-party SEO tools, MCP setup, CLI workflows, and agent-ready indexing operations.",
};

export default function ResourcesPage() {
	const stats = getDirectoryStats();
	const cards = [
		{
			href: "/resources/directories",
			title: "100+ submission directories",
			desc: `${stats.total} startup, SaaS, AI, developer, review, and community channels sorted by priority.`,
		},
		{
			href: "/resources/tools",
			title: "Third-party SEO tools",
			desc: `${seoTools.length} high-quality SEO tools for GSC, schema, crawls, performance, and research.`,
		},
		{
			href: "/resources/skill",
			title: "IndexFast agent skill",
			desc: "A compact SKILL.md that teaches AI IDEs how to use IndexFast safely.",
		},
		{
			href: "/resources/google-indexing-api",
			title: "Google Indexing API guardrails",
			desc: "Understand when Google Indexing API is eligible and when sitemap/GSC workflows are safer.",
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
				<section className="py-20 sm:py-28">
					<div className="mx-auto max-w-6xl px-4 sm:px-6">
						<p className="label-mono">Free resources</p>
						<h1 className="display mt-3 max-w-3xl text-4xl sm:text-5xl">
							SEO distribution and indexing resources for{" "}
							<span className="text-highlight">agentic teams.</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Use these free resources to improve discoverability, prioritize launch submissions, and wire IndexFast into AI IDEs, CLIs, and SEO workflows.
						</p>
						<div className="mt-12 grid gap-px bg-ink/10 sm:grid-cols-2">
							{cards.map((card) => (
								<Link key={card.href} href={card.href} className="group bg-surface p-6 transition-colors hover:bg-accent">
									<h2 className="text-base font-bold group-hover:text-accent-foreground">{card.title}</h2>
									<p className="mt-2 text-sm leading-relaxed text-muted group-hover:text-accent-foreground/70">{card.desc}</p>
									<span className="mt-5 inline-flex font-mono text-xs font-bold uppercase text-ink group-hover:text-accent-foreground">
										Open resource
									</span>
								</Link>
							))}
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
