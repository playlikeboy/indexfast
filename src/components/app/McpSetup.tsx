"use client";

/**
 * MCP onboarding: create a key, and every editor snippet below is instantly filled with it.
 * The plaintext key only exists in this component's state (it is never stored server side).
 */
import { useState } from "react";
import { createApiKeyAction } from "@/app/actions";
import { ActionForm, CodeBlock, Tabs } from "./client";
import { inputClass } from "./ui";

const ENDPOINT = "https://indexfast.co/api/mcp";

export function McpSetup({ exampleDomain }: { exampleDomain: string | null }) {
	const [key, setKey] = useState<string | null>(null);
	const token = key ?? "YOUR_INDEXFAST_KEY";
	const domain = exampleDomain ?? "yourwebsite.com";

	const json = (root: string, server: Record<string, unknown>) => JSON.stringify({ [root]: { indexfast: server } }, null, 2);
	const headers = { Authorization: `Bearer ${token}` };

	return (
		<div className="space-y-8">
			<section className="space-y-3">
				<h3 className="text-sm font-medium">1. Create a key</h3>
				{key ? (
					<div className="space-y-2">
						<CodeBlock label="Your key (shown once, copy it now)" code={key} />
						<p className="text-xs text-[var(--app-muted)]">The snippets below already include it.</p>
					</div>
				) : (
					<ActionForm
						action={async (prev, formData) => {
							const result = await createApiKeyAction(prev, formData);
							if (result?.ok && typeof result.data?.plainKey === "string") setKey(result.data.plainKey);
							return result;
						}}
						submitLabel="Create key"
						pendingLabel="Creating..."
						inline
					>
						<input name="name" placeholder="Key name, e.g. Cursor on laptop" className={`${inputClass} min-w-0 flex-1 sm:max-w-xs`} aria-label="Key name" />
					</ActionForm>
				)}
			</section>

			<section className="space-y-3">
				<h3 className="text-sm font-medium">2. Add IndexFast to your editor</h3>
				<Tabs
					tabs={[
						{
							id: "claude",
							label: "Claude Code",
							content: <CodeBlock label="Run in your terminal" code={`claude mcp add --transport http indexfast ${ENDPOINT} --header "Authorization: Bearer ${token}"`} />,
						},
						{
							id: "cursor",
							label: "Cursor",
							content: <CodeBlock label="~/.cursor/mcp.json" code={json("mcpServers", { url: ENDPOINT, headers })} />,
						},
						{
							id: "vscode",
							label: "VS Code",
							content: <CodeBlock label=".vscode/mcp.json" code={json("servers", { type: "http", url: ENDPOINT, headers })} />,
						},
						{
							id: "windsurf",
							label: "Windsurf",
							content: <CodeBlock label="~/.codeium/windsurf/mcp_config.json" code={json("mcpServers", { serverUrl: ENDPOINT, headers })} />,
						},
						{
							id: "other",
							label: "Other / test",
							content: (
								<div className="space-y-3">
									<p className="text-sm text-[var(--app-muted)]">Any MCP client that supports Streamable HTTP with a custom header works. Endpoint and header:</p>
									<CodeBlock label="Connection" code={`URL:    ${ENDPOINT}\nHeader: Authorization: Bearer ${token}`} />
									<CodeBlock
										label="Test with curl"
										code={`curl -s ${ENDPOINT} \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"account_status","arguments":{}}}'`}
									/>
								</div>
							),
						},
					]}
				/>
			</section>

			<section className="space-y-3">
				<h3 className="text-sm font-medium">3. Ask your AI</h3>
				<CodeBlock
					label="Paste into your AI chat"
					code={`Use the IndexFast MCP to set up indexing for ${domain}: add the site, create the key file it gives you in this project's public folder, then tell me to deploy and verify the site.`}
				/>
				<p className="text-xs text-[var(--app-muted)]">
					After that, try: &ldquo;I just published a new blog post, submit it to IndexFast&rdquo; or &ldquo;Which of my pages failed to submit?&rdquo;
				</p>
			</section>
		</div>
	);
}
