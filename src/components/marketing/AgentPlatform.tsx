import Link from "next/link";

const platformCards = [
	{
		label: "MCP",
		title: "Connect AI IDEs",
		desc: "Integrate a secure, remote MCP server with Bearer API tokens so agents can inspect site health, sync sitemaps, and check alerts.",
		fileName: "mcp-config.json",
		code: `{
  "mcpServers": {
    "indexfast": {
      "url": "https://indexfast.co/api/mcp",
      "headers": { 
        "Authorization": "Bearer if_live_..." 
      }
    }
  }
}`,
	},
	{
		label: "CLI",
		title: "Run from Terminals",
		desc: "Deploy the IndexFast CLI for shell scripts, continuous integration checks, and local publishing terminal workflows.",
		fileName: "install.sh",
		code: `curl -fsSL https://indexfast.co/install.sh | sh

indexfast site add https://example.com
indexfast sitemap sync --site example.com`,
	},
	{
		label: "API",
		title: "Build Custom Integrations",
		desc: "Leverage scoped, hashed API keys to connect IndexFast monitoring directly into CMS pipelines and pSEO frameworks.",
		fileName: "curl-request.sh",
		code: `curl https://indexfast.co/api/v1/sites \\
  -H "Authorization: Bearer if_live_..."`,
	},
];

export function AgentPlatform() {
	return (
		<section className="py-20 sm:py-24" aria-labelledby="agent-platform-heading">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
					<div>
						<p className="label-mono">Built for AI operators</p>
						<h2 id="agent-platform-heading" className="display mt-3 text-4xl sm:text-5xl">
							Every workflow is{" "}
							<span className="text-highlight">agent accessible.</span>
						</h2>
						<p className="mt-5 text-lg leading-relaxed text-muted">
							Modern search engine optimization requires machine speed. While humans check results on the web console, publishing agents and code assistants query our API, CLI, and remote Model Context Protocol (MCP) server.
						</p>
						<div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
							<Link
								href="/dashboard/connect"
								className="inline-flex items-center justify-center rounded-sm bg-ink px-6 py-3 font-mono text-xs font-bold uppercase text-surface transition-all hover:bg-ink/90 hover:shadow-md"
							>
								Configure MCP
							</Link>
							<Link
								href="/resources/skill"
								className="inline-flex items-center justify-center rounded-sm border border-ink px-6 py-3 font-mono text-xs font-bold uppercase text-ink transition-all hover:bg-ink hover:text-surface hover:shadow-md"
							>
								Download SKILL.md
							</Link>
						</div>
					</div>
					<div className="grid gap-6 md:grid-cols-3">
						{platformCards.map((card) => (
							<article 
								key={card.label} 
								className="flex flex-col justify-between border border-border/50 bg-card/30 p-5 rounded-sm hover:bg-card hover:border-border transition-all duration-300"
							>
								<div>
									<span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted bg-border/40 px-2 py-0.5 rounded-sm w-fit block">
										{card.label}
									</span>
									<h3 className="mt-4 text-base font-bold text-ink">{card.title}</h3>
									<p className="mt-2 text-xs leading-relaxed text-muted">{card.desc}</p>
								</div>
								
								<div className="mt-6 overflow-hidden rounded-sm border border-border/40">
									<div className="flex items-center justify-between bg-surface px-3 py-1.5 border-b border-border/40">
										<span className="font-mono text-[9px] text-muted">{card.fileName}</span>
										<span className="h-1.5 w-1.5 rounded-full bg-accent" />
									</div>
									<pre className="bg-[#0b0b0a] p-3 font-mono text-[10px] leading-relaxed text-zinc-300 overflow-x-auto min-h-[120px]">
										<code>{card.code}</code>
									</pre>
								</div>
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
