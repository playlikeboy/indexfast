/**
 * Connect AI: the shortest path from "I use Cursor/Claude Code" to an agent that manages
 * indexing. Also lists existing keys (masked) with revoke, and this month's usage.
 */
import { revokeApiKeyAction } from "@/app/actions";
import { ActionButton, CodeBlock } from "@/components/app/client";
import { McpSetup } from "@/components/app/McpSetup";
import { Card, EmptyState, PageHeader, timeAgo } from "@/components/app/ui";
import type { ConnectPageData } from "@/db/app-queries";
import { formatLimit } from "@/lib/platform/plans";


/** Pure view for Connect AI. */
export function ConnectView({ data }: { data: ConnectPageData }) {
	const { keys, usage, entitlement, exampleDomain } = data;


	return (
		<>
			<PageHeader
				title="Connect your AI"
				description="Let Claude Code, Cursor, VS Code or Windsurf add sites, install the key file and submit pages for you."
			/>

			<Card className="mb-6">
				<div className="p-5">
					<McpSetup exampleDomain={exampleDomain} />
				</div>
			</Card>

			<Card
				className="mb-6"
				title="Your keys"
				description={`${usage.toLocaleString()} of ${formatLimit(entitlement.limits.monthlyApiRequests)} requests used this month · ${keys.length} of ${formatLimit(entitlement.limits.apiKeys)} keys`}
			>
				{keys.length === 0 ? (
					<EmptyState title="No keys yet" />
				) : (
					<ul className="divide-y divide-[var(--app-border)]">
						{keys.map((key) => (
							<li key={key.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
								<div className="min-w-0 flex-1">
									<p className="font-medium">{key.name}</p>
									<p className="font-mono text-xs text-[var(--app-muted)]">
										{key.masked} · created {timeAgo(key.createdAt)} · last used {timeAgo(key.lastUsedAt)}
									</p>
								</div>
								<ActionButton action={revokeApiKeyAction.bind(null, key.id)} variant="ghost" confirm={`Revoke "${key.name}"? Tools using it will stop working.`}>
									Revoke
								</ActionButton>
							</li>
						))}
					</ul>
				)}
			</Card>

			<Card title="REST API" description="Same key, plain HTTP. Every site parameter accepts the site id or the domain.">
				<div className="space-y-3 p-5">
					<CodeBlock
						label="Add a site, then submit a URL"
						code={`curl -X POST https://indexfast.co/api/v1/sites \\\n  -H "Authorization: Bearer $INDEXFAST_KEY" -H "Content-Type: application/json" \\\n  -d '{"domain":"${exampleDomain ?? "yourwebsite.com"}"}'\n\ncurl -X POST https://indexfast.co/api/v1/sites/${exampleDomain ?? "yourwebsite.com"}/submissions \\\n  -H "Authorization: Bearer $INDEXFAST_KEY" -H "Content-Type: application/json" \\\n  -d '{"urls":["https://${exampleDomain ?? "yourwebsite.com"}/new-page"]}'`}
					/>
					<p className="text-xs text-[var(--app-muted)]">
						Endpoints: <code className="font-mono">/api/v1/sites</code>, <code className="font-mono">/sites/:site/verify</code>, <code className="font-mono">/sitemaps</code>,{" "}
						<code className="font-mono">/urls?filter=new</code>, <code className="font-mono">/submissions</code>, <code className="font-mono">/diagnostics</code>.
					</p>
				</div>
			</Card>
		</>
	);
}
