import Link from "next/link";
import { listApiKeysForUser } from "@/lib/platform/api-keys";
import { PLAN_LIMITS, normalizeBillingTier } from "@/lib/platform/plans";
import { getCurrentBilling } from "@/lib/platform/billing";
import { syncUser } from "@/app/actions";
import { stack } from "@/stack";
import { McpKeyManager } from "@/components/dashboard/McpKeyManager";

const endpoint = "https://indexfast.co/api/mcp";

function CodeBlock({ children }: { children: string }) {
	return (
		<pre className="overflow-x-auto rounded-md border border-border bg-surface p-4 font-mono text-xs text-ink">
			<code>{children}</code>
		</pre>
	);
}

export default async function McpPage() {
	const user = await stack.getUser();
	if (!user) return null;

	await syncUser();
	const [keys, billing] = await Promise.all([listApiKeysForUser(user.id), getCurrentBilling(user.id)]);
	const tier = normalizeBillingTier(billing.billingTier);
	const mcpEnabled = PLAN_LIMITS[tier].mcpEnabled;
	const activeKey = keys.find((key) => key.status === "active" && key.scopes.includes("mcp:use"));

	return (
		<div className="space-y-6">
			<div className="rounded-md border border-border bg-card p-5">
				<p className="font-mono text-xs font-bold uppercase text-muted">Agentic SEO operations</p>
				<h1 className="mt-2 text-3xl font-black uppercase tracking-tight">IndexFast MCP</h1>
				<p className="mt-2 max-w-2xl text-sm text-muted">
					Connect IndexFast to Cursor, Claude Desktop, Codex, Windsurf, or any AI harness that supports remote MCP over HTTP.
				</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				<section className="rounded-md border border-border bg-card p-5 lg:col-span-2">
					<h2 className="text-xl font-black uppercase tracking-tight">Remote Server</h2>
					<div className="mt-4 grid gap-3 sm:grid-cols-2">
						<div className="rounded-md border border-border bg-surface p-4">
							<p className="font-mono text-xs font-bold uppercase text-muted">Endpoint</p>
							<p className="mt-2 break-all font-mono text-sm">{endpoint}</p>
						</div>
						<div className="rounded-md border border-border bg-surface p-4">
							<p className="font-mono text-xs font-bold uppercase text-muted">Auth</p>
							<p className="mt-2 font-mono text-sm">Authorization: Bearer API_KEY</p>
						</div>
					</div>

					<div className="mt-5 rounded-md border border-border bg-surface p-4">
						<p className="font-mono text-xs font-bold uppercase text-muted">Status</p>
						<p className="mt-2 text-sm text-muted">
							Current plan: <span className="font-bold text-ink">{tier}</span>. MCP access is{" "}
							<span className="font-bold text-ink">
								{mcpEnabled ? (
									"enabled"
								) : (
									<Link href="/dashboard/billing" className="underline hover:text-accent">
										available on Growth and above (Upgrade)
									</Link>
								)}
							</span>.
						</p>
					</div>

					<div className="mt-6">
						<McpKeyManager activeKey={activeKey || null} endpoint={endpoint} />
					</div>

					<h3 className="mt-6 text-base font-black uppercase tracking-tight">Install CLI</h3>
					<CodeBlock>{`npx indexfast login --api-key YOUR_INDEXFAST_API_KEY
npx indexfast mcp install`}</CodeBlock>

					<h3 className="mt-6 text-base font-black uppercase tracking-tight">Install agent skill</h3>
					<CodeBlock>{`curl -fsSL https://indexfast.co/resources/skill/SKILL.md -o ~/.codex/skills/indexfast/SKILL.md`}</CodeBlock>
				</section>

				<aside className="space-y-6">
					<div className="rounded-md border border-border bg-card p-5">
						<h2 className="text-lg font-black uppercase tracking-tight">Tools</h2>
						<ul className="mt-4 space-y-2 font-mono text-xs text-muted">
							<li>list_sites</li>
							<li>add_site</li>
							<li>discover_sitemaps</li>
							<li>sync_sitemap</li>
							<li>submit_url</li>
							<li>bulk_submit_urls</li>
							<li>run_diagnostics</li>
							<li>list_directories</li>
						</ul>
					</div>
					<div className="rounded-md border border-border bg-card p-5">
						<h2 className="text-lg font-black uppercase tracking-tight">Prompts</h2>
						<ul className="mt-4 space-y-2 font-mono text-xs text-muted">
							<li>pSEO launch audit</li>
							<li>Indexing recovery plan</li>
							<li>Directory submission plan</li>
							<li>Agentic SEO audit</li>
						</ul>
					</div>
				</aside>
			</div>
		</div>
	);
}
