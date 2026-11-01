/*
 * /resources/skill: how an AI coding agent installs the IndexFast SKILL.md and connects to the
 * MCP server. The download is the page's one primary action and sits on the first screen; the
 * commands use the shared CodeBlock so copy works and reports its result.
 */
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { CodeBlock, Container, buttonClass } from "@/components/ui";
import { ResourceHeader } from "../_components/ResourceHeader";
import type { Metadata } from "next";
import { SITE_URL, withPageSeo } from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";

export const metadata: Metadata = withPageSeo("/resources/skill", {
	title: "IndexFast SKILL.md for AI Coding Agents",
	description:
		"Install the IndexFast SKILL.md file so AI IDEs and coding agents can operate indexing, sitemap, MCP, CLI, and SEO workflows safely.",
});

// --create-dirs: on a first install the skills folder does not exist and curl would exit 23.
const downloadCommand = `curl -fsSL --create-dirs -o ~/.codex/skills/indexfast/SKILL.md \\
  https://indexfast.co/resources/skill/SKILL.md`;

const mcpConfig = `{
  "mcpServers": {
    "indexfast": {
      "type": "streamable-http",
      "url": "https://indexfast.co/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_INDEXFAST_API_KEY"
      }
    }
  }
}`;

export default function SkillPage() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={[{ name: "Home", url: SITE_URL }, { name: "Resources", url: `${SITE_URL}/resources` }, { name: "SKILL.md for agents", url: `${SITE_URL}/resources/skill` }]} />
				<ResourceHeader
					title="Install IndexFast into your coding agent"
					lede="The skill teaches AI IDEs the dashboard, API, MCP server and CLI."
					actions={
						<a href="/resources/skill/SKILL.md" className={buttonClass({ variant: "primary", size: "lg" })}>
							Open SKILL.md
						</a>
					}
				/>
				<section aria-label="Setup" className="pb-(--section-gap)">
					<Container>
						<div className="grid gap-10 border-t border-border pt-10 lg:grid-cols-2 lg:gap-16">
							<div className="min-w-0">
								<h2 className="text-section">Download</h2>
								<p className="mt-3 max-w-[35em] text-md text-ink-2">Save the skill where your agent loads skills from.</p>
								<CodeBlock title="shell" code={downloadCommand} className="mt-6" />
							</div>
							<div className="min-w-0">
								<h2 className="text-section">Use with MCP</h2>
								<p className="mt-3 max-w-[35em] text-md text-ink-2">Add the server to your MCP client config with an IndexFast API key.</p>
								<CodeBlock title="mcp.json" code={mcpConfig} className="mt-6" />
							</div>
						</div>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
