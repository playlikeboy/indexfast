/*
 * Agent-native section: the same job done from an AI editor, the CLI or the REST API. Every snippet
 * is a working command against the real endpoints (MCP at /api/mcp, REST under /api/v1, the
 * published `indexfast` CLI); example.com and idxf_YOUR_KEY are the only placeholders, so nothing
 * here reads as a claim about a real customer. Keep these in sync with McpSetup and the CLI.
 */
import Link from "next/link";
import { CodeBlock, Container, Tabs, buttonClass } from "@/components/ui";

const MCP_ENDPOINT = "https://indexfast.co/api/mcp";
const KEY = "idxf_YOUR_KEY";

const snippets = [
	{
		id: "claude",
		label: "Claude Code",
		title: "Terminal",
		code: `claude mcp add --transport http indexfast \\\n  ${MCP_ENDPOINT} \\\n  --header "Authorization: Bearer ${KEY}"`,
	},
	{
		id: "cursor",
		label: "Cursor",
		title: "~/.cursor/mcp.json",
		code: JSON.stringify({ mcpServers: { indexfast: { url: MCP_ENDPOINT, headers: { Authorization: `Bearer ${KEY}` } } } }, null, 2),
	},
	{
		id: "cli",
		label: "CLI",
		title: "Terminal",
		code: `npx indexfast login --api-key ${KEY}\nnpx indexfast submit example.com https://example.com/blog/new-post`,
	},
	{
		id: "rest",
		label: "REST",
		title: "curl",
		code: `curl -X POST https://indexfast.co/api/v1/sites/example.com/submissions \\\n  -H "Authorization: Bearer ${KEY}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"https://example.com/blog/new-post"}'`,
	},
];

export function AgentSection() {
	return (
		<section id="agents" aria-labelledby="agents-heading" className="bg-well py-(--section-gap-s)">
			<Container className="grid items-start gap-y-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-x-16">
				<div className="min-w-0 lg:order-2">
					<h2 id="agents-heading" className="max-w-[14ch] text-section">
						Your AI editor can run it.
					</h2>
					<p className="mt-6 max-w-[40ch] text-lead text-ink-2">An MCP server on every plan, a REST API with scoped keys, a CLI and a SKILL.md.</p>
					<div className="mt-10 flex flex-col gap-3 sm:flex-row">
						<Link href="/dashboard/connect" className={buttonClass({ size: "lg" })}>
							Connect MCP
						</Link>
						<Link href="/resources/skill" className={buttonClass({ variant: "ghost", size: "lg" })}>
							Get SKILL.md
						</Link>
					</div>
				</div>
				<Tabs
					label="Ways to connect"
					className="min-w-0 lg:order-1"
					items={snippets.map((snippet) => ({
						id: snippet.id,
						label: snippet.label,
						content: <CodeBlock title={snippet.title} code={snippet.code} className="lg:min-h-80" />,
					}))}
				/>
			</Container>
		</section>
	);
}
