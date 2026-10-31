"use client";

/**
 * MCP onboarding: create a key, and every editor snippet below is instantly filled with it.
 * The plaintext key only exists in this component's state (it is never stored server side).
 * The three steps are numbered because the order matters: no key, no working config.
 */
import { useState, type ReactNode } from "react";
import { createApiKeyAction } from "@/app/actions";
import { Input } from "@/components/ui";
import { ActionForm, CodeBlock, Tabs } from "./client";

const ENDPOINT = "https://indexfast.co/api/mcp";

function Step({ index, title, children }: { index: number; title: string; children: ReactNode }) {
	return (
		<li className="flex min-w-0 flex-col gap-3">
			<h3 className="text-md">
				<span className="num text-muted">{index}.</span> {title}
			</h3>
			{children}
		</li>
	);
}

export function McpSetup({ exampleDomain }: { exampleDomain: string | null }) {
	const [key, setKey] = useState<string | null>(null);
	const token = key ?? "YOUR_INDEXFAST_KEY";
	const domain = exampleDomain ?? "example.com";

	const json = (root: string, server: Record<string, unknown>) => JSON.stringify({ [root]: { indexfast: server } }, null, 2);
	const headers = { Authorization: `Bearer ${token}` };

	return (
		<ol className="flex flex-col gap-8">
			<Step index={1} title="Create a key">
				{key ? (
					<div className="flex flex-col gap-2">
						<CodeBlock label="Your key, shown once: copy it now" code={key} wrap />
						<p className="text-sm text-muted">The snippets below already include it.</p>
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
						<label htmlFor="mcp-key-name" className="sr-only">
							Key name
						</label>
						<Input id="mcp-key-name" name="name" placeholder="Key name, e.g. Cursor on laptop" className="min-w-0 flex-1 sm:max-w-xs" />
					</ActionForm>
				)}
			</Step>

			<Step index={2} title="Add IndexFast to your editor">
				<Tabs
					label="Editor"
					tabs={[
						{
							id: "claude",
							label: "Claude Code",
							content: <CodeBlock label="Terminal" code={`claude mcp add --transport http indexfast ${ENDPOINT} --header "Authorization: Bearer ${token}"`} />,
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
							label: "Other client",
							content: (
								<div className="flex flex-col gap-3">
									<p className="text-sm text-muted">Any MCP client that supports Streamable HTTP with a custom header works.</p>
									<CodeBlock label="Connection" code={`URL:    ${ENDPOINT}\nHeader: Authorization: Bearer ${token}`} />
									<CodeBlock
										label="curl"
										code={`curl -s ${ENDPOINT} \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"account_status","arguments":{}}}'`}
									/>
								</div>
							),
						},
					]}
				/>
			</Step>

			<Step index={3} title="Ask your AI">
				<CodeBlock
					wrap
					label="Prompt"
					code={`Use the IndexFast MCP to set up indexing for ${domain}: add the site, create the key file it gives you in this project's public folder, then tell me to deploy and verify the site.`}
				/>
				<p className="text-sm text-muted">
					After that, try &ldquo;I just published a new blog post, submit it to IndexFast&rdquo; or &ldquo;Which of my pages failed to submit?&rdquo;
				</p>
			</Step>
		</ol>
	);
}
