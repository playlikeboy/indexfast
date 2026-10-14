import type { AuthenticatedApiKey } from "@/lib/platform/api-keys";
import {
	bulkSubmitUrlsForApi,
	createSiteForUser,
	discoverSitemapsForApi,
	listAlertsForUser,
	listDirectoryResources,
	listSeoToolResources,
	listSitesForUser,
	listSubmissionsForUser,
	listUrlsForUser,
	recommendSeoResources,
	runDiagnosticsForUser,
	submitUrlForApi,
	syncSitemapsForApi,
} from "@/lib/platform/operations";

export type JsonRpcRequest = {
	jsonrpc?: "2.0";
	id?: string | number | null;
	method?: string;
	params?: Record<string, unknown>;
};

const serverInfo = {
	name: "indexfast",
	title: "IndexFast",
	version: "0.1.0",
};

const tools = [
	{
		name: "list_sites",
		title: "List Sites",
		description: "List connected IndexFast sites for the authenticated user.",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "add_site",
		title: "Add Site",
		description: "Connect a new site to IndexFast.",
		inputSchema: {
			type: "object",
			properties: {
				domain: { type: "string" },
				name: { type: "string" },
				sitemapUrl: { type: "string" },
			},
			required: ["domain"],
		},
	},
	{
		name: "discover_sitemaps",
		title: "Discover Sitemaps",
		description: "Probe robots.txt and common sitemap/feed paths for a site.",
		inputSchema: { type: "object", properties: { siteId: { type: "string" } }, required: ["siteId"] },
	},
	{
		name: "sync_sitemap",
		title: "Sync Sitemap",
		description: "Sync all active sitemap sources or a specific source.",
		inputSchema: {
			type: "object",
			properties: { siteId: { type: "string" }, sourceId: { type: "string" } },
			required: ["siteId"],
		},
	},
	{
		name: "submit_url",
		title: "Submit URL",
		description: "Queue and process a manual IndexNow/Bing submission for one URL.",
		inputSchema: {
			type: "object",
			properties: { siteId: { type: "string" }, url: { type: "string" } },
			required: ["siteId", "url"],
		},
	},
	{
		name: "bulk_submit_urls",
		title: "Bulk Submit URLs",
		description: "Submit up to 50 URLs for a site.",
		inputSchema: {
			type: "object",
			properties: { siteId: { type: "string" }, urls: { type: "array", items: { type: "string" } } },
			required: ["siteId", "urls"],
		},
	},
	{
		name: "run_diagnostics",
		title: "Run Diagnostics",
		description: "Run a live indexability diagnostic check for a URL.",
		inputSchema: {
			type: "object",
			properties: { siteId: { type: "string" }, urlId: { type: "string" }, url: { type: "string" } },
			required: ["siteId"],
		},
	},
	{
		name: "list_alerts",
		title: "List Alerts",
		description: "List recent IndexFast alerts.",
		inputSchema: { type: "object", properties: { limit: { type: "number" } } },
	},
	{
		name: "list_submissions",
		title: "List Submissions",
		description: "List recent submission events for a site.",
		inputSchema: {
			type: "object",
			properties: { siteId: { type: "string" }, limit: { type: "number" } },
			required: ["siteId"],
		},
	},
	{
		name: "list_urls",
		title: "List URLs",
		description: "List ingested URLs and their indexing/crawling status for a site.",
		inputSchema: {
			type: "object",
			properties: { siteId: { type: "string" }, limit: { type: "number" } },
			required: ["siteId"],
		},
	},
	{
		name: "list_seo_tools",
		title: "List SEO Tools",
		description: "List prioritized third-party SEO tools.",
		inputSchema: {
			type: "object",
			properties: { priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] } },
		},
	},
	{
		name: "list_directories",
		title: "List Directories",
		description: "List prioritized SEO and launch submission directories.",
		inputSchema: { type: "object", properties: { priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] } } },
	},
	{
		name: "recommend_seo_resources",
		title: "Recommend SEO Resources",
		description: "Recommend directories and tools for a launch, AI visibility, or indexing goal.",
		inputSchema: { type: "object", properties: { goal: { type: "string" } }, required: ["goal"] },
	},
];

const prompts = [
	{
		name: "pseo_launch_audit",
		title: "pSEO Launch Audit",
		description: "Audit a programmatic SEO launch for sitemap, indexing, and submission readiness.",
	},
	{
		name: "indexing_recovery_plan",
		title: "Indexing Recovery Plan",
		description: "Create a recovery plan for pages that are missing, blocked, or dropped.",
	},
	{
		name: "directory_submission_plan",
		title: "Directory Submission Plan",
		description: "Prioritize directories and third-party resources for startup launch distribution.",
	},
	{
		name: "agentic_seo_audit",
		title: "Agentic SEO Audit",
		description: "Tell an AI IDE how to inspect code, sitemaps, robots rules, and IndexFast data together.",
	},
];

function asString(value: unknown) {
	return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback = 100) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function textContent(value: unknown) {
	return {
		content: [
			{
				type: "text",
				text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
			},
		],
		isError: false,
	};
}

function jsonRpcResult(id: JsonRpcRequest["id"], result: unknown) {
	return { jsonrpc: "2.0", id: id ?? null, result };
}

function jsonRpcError(id: JsonRpcRequest["id"], code: number, message: string) {
	return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function callTool(auth: AuthenticatedApiKey, name: string, args: Record<string, unknown>) {
	switch (name) {
		case "list_sites":
			return textContent(await listSitesForUser(auth.userId));
		case "add_site":
			return textContent(
				await createSiteForUser({
					userId: auth.userId,
					domain: asString(args.domain),
					name: asString(args.name) || asString(args.domain),
					sitemapUrl: asString(args.sitemapUrl) || undefined,
				}),
			);
		case "discover_sitemaps":
			return textContent(await discoverSitemapsForApi(auth.userId, asString(args.siteId)));
		case "sync_sitemap":
			return textContent(await syncSitemapsForApi(auth.userId, asString(args.siteId), asString(args.sourceId) || undefined));
		case "submit_url":
			return textContent(await submitUrlForApi(auth.userId, asString(args.siteId), asString(args.url)));
		case "bulk_submit_urls":
			return textContent(await bulkSubmitUrlsForApi(auth.userId, asString(args.siteId), asStringArray(args.urls)));
		case "run_diagnostics":
			return textContent(
				await runDiagnosticsForUser({
					userId: auth.userId,
					siteId: asString(args.siteId),
					urlId: asString(args.urlId) || undefined,
					url: asString(args.url) || undefined,
				}),
			);
		case "list_alerts":
			return textContent(await listAlertsForUser(auth.userId, asNumber(args.limit)));
		case "list_submissions":
			return textContent(await listSubmissionsForUser(auth.userId, asString(args.siteId), asNumber(args.limit)));
		case "list_urls":
			return textContent(await listUrlsForUser(auth.userId, asString(args.siteId), asNumber(args.limit)));
		case "list_seo_tools":
			return textContent(listSeoToolResources(asString(args.priority) as "P0" | "P1" | "P2" | "P3" | undefined));
		case "list_directories":
			return textContent(listDirectoryResources(asString(args.priority) as "P0" | "P1" | "P2" | "P3" | undefined));
		case "recommend_seo_resources":
			return textContent(recommendSeoResources(asString(args.goal)));
		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}

async function readResource(auth: AuthenticatedApiKey, uri: string) {
	if (uri === "indexfast://sites") {
		return listSitesForUser(auth.userId);
	}
	if (uri === "indexfast://alerts") {
		return listAlertsForUser(auth.userId);
	}
	if (uri === "indexfast://resources/directories") {
		return listDirectoryResources();
	}
	if (uri === "indexfast://resources/tools") {
		return listSeoToolResources();
	}

	const siteUrlsMatch = /^indexfast:\/\/sites\/([^/]+)\/urls$/.exec(uri);
	if (siteUrlsMatch) {
		return listUrlsForUser(auth.userId, siteUrlsMatch[1]);
	}

	throw new Error(`Unknown resource: ${uri}`);
}

function getPrompt(name: string) {
	const prompt = prompts.find((item) => item.name === name);
	if (!prompt) {
		throw new Error(`Unknown prompt: ${name}`);
	}

	const promptMap: Record<string, string> = {
		pseo_launch_audit:
			"Audit this pSEO launch with IndexFast. Check sitemap coverage, URL count, indexability blockers, IndexNow readiness, Bing setup, AI crawler access, and launch directory opportunities. Return prioritized fixes.",
		indexing_recovery_plan:
			"Use IndexFast data to build an indexing recovery plan. Separate technical blockers, sitemap issues, search-engine submission gaps, and content-quality risks. Do not promise guaranteed Google indexing.",
		directory_submission_plan:
			"Create a directory submission plan using IndexFast resources. Prioritize P0/P1 listings, explain effort, and separate launch, SaaS review, AI, developer, and community channels.",
		agentic_seo_audit:
			"Act as an agentic SEO engineer. Inspect code, robots.txt, sitemap routes, metadata, structured data, IndexFast diagnostics, API/MCP setup, and CLI workflows. Produce concise implementation tasks.",
	};

	const text = promptMap[name] || "";

	return {
		description: prompt.description,
		messages: [
			{
				role: "user",
				content: { type: "text", text },
			},
		],
	};
}

export async function handleMcpRequest(auth: AuthenticatedApiKey, request: JsonRpcRequest) {
	const method = request.method || "";
	const params = request.params || {};

	try {
		switch (method) {
			case "initialize":
				return jsonRpcResult(request.id, {
					protocolVersion: "2025-11-25",
					serverInfo,
					capabilities: {
						tools: { listChanged: false },
						resources: { listChanged: false },
						prompts: { listChanged: false },
					},
				});
			case "tools/list":
				return jsonRpcResult(request.id, { tools });
			case "tools/call":
				return jsonRpcResult(request.id, await callTool(auth, asString(params.name), (params.arguments as Record<string, unknown>) || {}));
			case "resources/list":
				return jsonRpcResult(request.id, {
					resources: [
						{ uri: "indexfast://sites", name: "sites", title: "Connected Sites", mimeType: "application/json" },
						{ uri: "indexfast://alerts", name: "alerts", title: "Recent Alerts", mimeType: "application/json" },
						{ uri: "indexfast://resources/directories", name: "directories", title: "SEO Directories", mimeType: "application/json" },
						{ uri: "indexfast://resources/tools", name: "tools", title: "SEO Tools", mimeType: "application/json" },
					],
				});
			case "resources/read": {
				const uri = asString(params.uri);
				return jsonRpcResult(request.id, {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(await readResource(auth, uri), null, 2),
						},
					],
				});
			}
			case "prompts/list":
				return jsonRpcResult(request.id, { prompts });
			case "prompts/get":
				return jsonRpcResult(request.id, getPrompt(asString(params.name)));
			default:
				return jsonRpcError(request.id, -32601, `Unknown MCP method: ${method}`);
		}
	} catch (error) {
		return jsonRpcError(request.id, -32000, error instanceof Error ? error.message : "Unknown MCP error");
	}
}
