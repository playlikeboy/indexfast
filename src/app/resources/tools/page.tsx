/*
 * /resources/tools: curated third-party SEO tools, ordered by priority, as one ruled table so the
 * category, cost and priority columns compare at a glance. Links go straight to each tool.
 */
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { Badge, Container, Table, Td, Th } from "@/components/ui";
import { getToolsByPriority } from "@/lib/resources/tools";
import { ResourceHeader } from "../_components/ResourceHeader";
import type { Metadata } from "next";
import { SITE_URL, withPageSeo } from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";

export const metadata: Metadata = withPageSeo("/resources/tools", {
	title: "Best Free and Paid SEO Tools for Indexing, Sitemaps, and AI Visibility",
	description:
		"Curated third-party SEO tools for Google Search Console, Bing Webmaster, structured data, performance, technical crawls, and AI visibility.",
});

export default function ResourceToolsPage() {
	const tools = getToolsByPriority();

	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={[{ name: "Home", url: SITE_URL }, { name: "Resources", url: `${SITE_URL}/resources` }, { name: "SEO tools", url: `${SITE_URL}/resources/tools` }]} />
				<ResourceHeader
					title="SEO tools to use alongside IndexFast"
					lede="Official search data, structured-data checks, performance traces and research, in one list."
				/>
				<section aria-label="SEO tools" className="pb-(--section-gap)">
					<Container>
						<Table caption="Third-party SEO tools">
							<thead>
								<tr>
									<Th className="sticky left-0 z-(--z-raised) bg-background">Tool</Th>
									<Th>Priority</Th>
									<Th>Category</Th>
									<Th>Cost</Th>
									<Th>Notes</Th>
								</tr>
							</thead>
							<tbody>
								{tools.map((tool) => (
									<tr key={`${tool.name}-${tool.url}`}>
										<Td className="sticky left-0 z-(--z-raised) bg-background min-w-48 md:min-w-64">
											<a
												href={tool.url}
												className="font-display font-medium text-ink underline decoration-border-strong underline-offset-4 hover:decoration-signal"
											>
												{tool.name}
											</a>
											<span className="mt-1 block text-ink-2">{tool.bestFor}</span>
										</Td>
										<Td>
											<Badge>{tool.priority}</Badge>
										</Td>
										<Td className="text-ink-2">{tool.category}</Td>
										<Td className="text-ink-2">{tool.cost}</Td>
										<Td className="min-w-64 text-muted">{tool.notes}</Td>
									</tr>
								))}
							</tbody>
						</Table>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
