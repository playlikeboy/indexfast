/**
 * IndexFast MCP server (JSON-RPC over Streamable HTTP, stateless). Designed for vibe coders:
 * an agent inside Claude Code / Cursor can add a site, write the verification key file
 * into the user's repo, verify, and submit URLs without the user touching the dashboard.
 *
 * Rules: tools are thin wrappers over src/lib/platform/operations.ts (no business logic here),
 * every `site` argument accepts a site id OR a domain, and tool results are JSON text.
 */
import type { AuthenticatedApiKey } from "@/lib/platform/api-keys";
import {
	addSitemapForApi,
	bulkSubmitUrlsForApi,
	createSiteForUser,
	discoverSitemapsForApi,
	getAccountStatus,
	getSiteDetailsForUser,
	listAlertsForUser,
	listDirectoryResources,
	listSeoToolResources,
	listSitesForUser,
	listSubmissionsForUser,
	listUrlsForUser,
	recommendSeoResources,
	runDiagnosticsForUser,
	submitPendingForApi,
	syncSitemapsForApi,
	verifySiteForApi,
	type UrlFilter,
} from "@/lib/platform/operations";

export type JsonRpcRequest = {
	jsonrpc?: "2.0";
	id?: string | number | null;
	method?: string;
	params?: Record<string, unknown>;
};

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const serverInfo = { name: "indexfast", title: "IndexFast", version: "1.0.0" };

const instructions = `IndexFast gets a website's pages discovered by search engines (IndexNow + Bing) automatically.
Typical flow for a project in the current repo:
1. add_site { domain } -> finds sitemaps and URLs, returns a key file to create.
2. Create that key file in the project's public/static folder (exact name and content), deploy.
3. verify_site { site } -> proves ownership and turns on auto-submit. Done: new pages are submitted hourly.
Use get_site to see status and issues. Every "site" argument accepts the domain or the site id.
IndexFast never guarantees Google indexing; it speeds up discovery.`;

const site = { type: "string", description: "Site domain (e.g. example.com) or site id" };

const tools = [
	{
		name: "account_status",
		title: "Account status",
		description: "Show the current plan, limits, expiry, and all sites with URL counts. Call this first.",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "add_site",
		title: "Add website",
		description: "Add a website by domain. Auto-discovers sitemaps, imports URLs, and returns the verification key file to create.",
		inputSchema: {
			type: "object",
			properties: {
				domain: { type: "string", description: "Exact host, e.g. example.com or www.example.com" },
				sitemapUrl: { type: "string", description: "Optional. Only if auto-discovery cannot find it." },
			},
			required: ["domain"],
		},
	},
	{
		name: "get_site",
		title: "Get site",
		description: "Status, setup instructions (key file), sitemaps, URL counts and open issues for one site.",
		inputSchema: { type: "object", properties: { site }, required: ["site"] },
	},
	{
		name: "verify_site",
		title: "Verify site",
		description: "Check the key file is live. On success, turns on automatic submission and submits all pending URLs.",
		inputSchema: { type: "object", properties: { site }, required: ["site"] },
	},
	{
		name: "add_sitemap",
		title: "Add sitemap",
		description: "Add a sitemap URL (must be on the site's exact host).",
		inputSchema: { type: "object", properties: { site, sitemapUrl: { type: "string" } }, required: ["site", "sitemapUrl"] },
	},
	{
		name: "discover_sitemaps",
		title: "Discover sitemaps",
		description: "Re-run sitemap discovery from robots.txt and common paths.",
		inputSchema: { type: "object", properties: { site }, required: ["site"] },
	},
	{
		name: "sync_now",
		title: "Sync now",
		description: "Crawl the site's sitemaps now, detect new/updated URLs, and submit them.",
		inputSchema: { type: "object", properties: { site }, required: ["site"] },
	},
	{
		name: "submit_urls",
		title: "Submit URLs",
		description: "Submit specific URLs right now (max 1000). Use after publishing or updating pages.",
		inputSchema: {
			type: "object",
			properties: { site, urls: { type: "array", items: { type: "string" } } },
			required: ["site", "urls"],
		},
	},
	{
		name: "submit_pending",
		title: "Submit pending",
		description: "Submit every tracked URL that has never been submitted.",
		inputSchema: { type: "object", properties: { site }, required: ["site"] },
	},
	{
		name: "list_urls",
		title: "List URLs",
		description: "List tracked URLs. filter: all | new (last 7 days) | pending | submitted | failed.",
		inputSchema: {
			type: "object",
			properties: {
				site,
				filter: { type: "string", enum: ["all", "new", "pending", "submitted", "failed"] },
				limit: { type: "number" },
			},
			required: ["site"],
		},
	},
	{
		name: "list_submissions",
		title: "Submission log",
		description: "Recent submission attempts with engine responses.",
		inputSchema: { type: "object", properties: { site, limit: { type: "number" } }, required: ["site"] },
	},
	{
		name: "check_url",
		title: "Check URL",
		description: "Live indexability check of a URL: HTTP status, noindex, canonical, title.",
		inputSchema: { type: "object", properties: { site, url: { type: "string" } }, required: ["site", "url"] },
	},
	{
		name: "list_issues",
		title: "List issues",
		description: "Recent alerts across all sites (sitemap failures, submission errors).",
		inputSchema: { type: "object", properties: { limit: { type: "number" } } },
	},
	{
		name: "recommend_seo_resources",
		title: "Recommend SEO resources",
		description: "Launch directories and SEO tools for a goal (e.g. 'launch an AI SaaS').",
		inputSchema: { type: "object", properties: { goal: { type: "string" } }, required: ["goal"] },
	},
	{
		name: "list_directories",
		title: "List directories",
		description: "Prioritized startup/SEO submission directories.",
		inputSchema: { type: "object", properties: { priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] } } },
	},
	{
		name: "list_seo_tools",
		title: "List SEO tools",
		description: "Prioritized third-party SEO tools.",
		inputSchema: { type: "object", properties: { priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] } } },
	},
];

// Old tool names from v0 of the MCP server, kept so existing agent configs keep working.
const toolAliases: Record<string, string> = {
	list_sites: "account_status",
	sync_sitemap: "sync_now",
	submit_url: "submit_urls",
	bulk_submit_urls: "submit_urls",
	run_diagnostics: "check_url",
	list_alerts: "list_issues",
};

const prompts = [
	{
		name: "setup_indexing",
		title: "Set up indexing for this project",
		description: "Add this project's website to IndexFast, install the key file in the repo, and verify.",
		arguments: [{ name: "domain", description: "Production domain of this project", required: true }],
	},
	{
		name: "indexing_recovery_plan",
		title: "Indexing recovery plan",
		description: "Diagnose why pages are not getting discovered and produce fixes.",
		arguments: [{ name: "domain", description: "Site domain", required: true }],
	},
	{
		name: "launch_distribution_plan",
		title: "Launch distribution plan",
		description: "Prioritized directories and resources for launching this product.",
	},
];

function asString(value: unknown) {
	return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback = 100) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
	if (typeof value === "string") return [value];
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function textContent(value: unknown, isError = false) {
	return {
		content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
		isError,
	};
}

function jsonRpcResult(id: JsonRpcRequest["id"], result: unknown) {
	return { jsonrpc: "2.0" as const, id: id ?? null, result };
}

function jsonRpcError(id: JsonRpcRequest["id"], code: number, message: string) {
	return { jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } };
}

async function callTool(auth: AuthenticatedApiKey, rawName: string, args: Record<string, unknown>) {
	const name = toolAliases[rawName] ?? rawName;
	const siteRef = asString(args.site) || asString(args.siteId) || asString(args.domain);

	switch (name) {
		case "account_status":
			return getAccountStatus(auth.userId);
		case "add_site":
			return createSiteForUser({
				userId: auth.userId,
				domain: asString(args.domain),
				sitemapUrl: asString(args.sitemapUrl) || undefined,
			});
		case "get_site":
			return getSiteDetailsForUser(auth.userId, siteRef);
		case "verify_site":
			return verifySiteForApi(auth.userId, siteRef);
		case "add_sitemap":
			return addSitemapForApi(auth.userId, siteRef, asString(args.sitemapUrl));
		case "discover_sitemaps":
			return { sitemaps: await discoverSitemapsForApi(auth.userId, siteRef) };
		case "sync_now":
			return syncSitemapsForApi(auth.userId, siteRef);
		case "submit_urls":
			return bulkSubmitUrlsForApi(auth.userId, siteRef, [...asStringArray(args.urls), ...asStringArray(args.url)]);
		case "submit_pending":
			return submitPendingForApi(auth.userId, siteRef);
		case "list_urls":
			return listUrlsForUser(auth.userId, siteRef, asNumber(args.limit), (asString(args.filter) || "all") as UrlFilter);
		case "list_submissions":
			return listSubmissionsForUser(auth.userId, siteRef, asNumber(args.limit, 50));
		case "check_url":
			return runDiagnosticsForUser({ userId: auth.userId, siteId: siteRef, url: asString(args.url), urlId: asString(args.urlId) || undefined });
		case "list_issues":
			return listAlertsForUser(auth.userId, asNumber(args.limit, 50));
		case "recommend_seo_resources":
			return recommendSeoResources(asString(args.goal));
		case "list_directories":
			return listDirectoryResources((asString(args.priority) || undefined) as "P0" | "P1" | "P2" | "P3" | undefined);
		case "list_seo_tools":
			return listSeoToolResources((asString(args.priority) || undefined) as "P0" | "P1" | "P2" | "P3" | undefined);
		default:
			throw new Error(`Unknown tool: ${rawName}`);
	}
}

async function readResource(auth: AuthenticatedApiKey, uri: string) {
	if (uri === "indexfast://account") return getAccountStatus(auth.userId);
	if (uri === "indexfast://sites") return listSitesForUser(auth.userId);
	if (uri === "indexfast://issues" || uri === "indexfast://alerts") return listAlertsForUser(auth.userId);
	if (uri === "indexfast://resources/directories") return listDirectoryResources();
	if (uri === "indexfast://resources/tools") return listSeoToolResources();
	const siteMatch = /^indexfast:\/\/sites\/([^/]+)(\/urls)?$/.exec(uri);
	if (siteMatch) {
		return siteMatch[2] ? listUrlsForUser(auth.userId, decodeURIComponent(siteMatch[1])) : getSiteDetailsForUser(auth.userId, decodeURIComponent(siteMatch[1]));
	}
	throw new Error(`Unknown resource: ${uri}`);
}

function getPrompt(name: string, args: Record<string, unknown>) {
	const domain = asString(args.domain) || "<your production domain>";
	const texts: Record<string, string> = {
		setup_indexing: `Set up IndexFast for ${domain}. Steps: call add_site with domain "${domain}". Create the returned key file in this repo's public/static folder with the exact name and content (no newline or extra text). Tell me to deploy, then call verify_site. Finally call get_site and summarise sitemaps, URL counts and any issues.`,
		indexing_recovery_plan: `Use IndexFast to diagnose ${domain}: get_site, list_urls with filter "failed" and "pending", list_issues, and check_url on 3-5 important pages. Then inspect this codebase's robots.txt, sitemap generation, canonical and noindex logic. Output a prioritised fix list. Do not promise guaranteed Google indexing.`,
		launch_distribution_plan:
			"Call recommend_seo_resources with this product's category, then produce a launch plan: P0 directories first, effort per listing, and what copy/assets to prepare.",
	};
	const prompt = prompts.find((item) => item.name === name);
	if (!prompt) throw new Error(`Unknown prompt: ${name}`);
	return { description: prompt.description, messages: [{ role: "user", content: { type: "text", text: texts[name] } }] };
}

/** Returns null for JSON-RPC notifications (no id): the HTTP layer answers 202 with no body. */
export async function handleMcpRequest(auth: AuthenticatedApiKey, request: JsonRpcRequest) {
	const method = request.method || "";
	const params = request.params || {};
	const isNotification = request.id === undefined || method.startsWith("notifications/");

	if (isNotification) {
		return null;
	}

	try {
		switch (method) {
			case "initialize": {
				const requested = asString(params.protocolVersion);
				return jsonRpcResult(request.id, {
					protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0],
					serverInfo,
					instructions,
					capabilities: { tools: { listChanged: false }, resources: { listChanged: false }, prompts: { listChanged: false } },
				});
			}
			case "ping":
				return jsonRpcResult(request.id, {});
			case "tools/list":
				return jsonRpcResult(request.id, { tools });
			case "tools/call": {
				// Tool failures are returned as isError results (not protocol errors) so the agent sees the message.
				try {
					const value = await callTool(auth, asString(params.name), (params.arguments as Record<string, unknown>) || {});
					return jsonRpcResult(request.id, textContent(value));
				} catch (error) {
					return jsonRpcResult(request.id, textContent(error instanceof Error ? error.message : "Tool failed", true));
				}
			}
			case "resources/list":
				return jsonRpcResult(request.id, {
					resources: [
						{ uri: "indexfast://account", name: "account", title: "Plan and sites", mimeType: "application/json" },
						{ uri: "indexfast://sites", name: "sites", title: "Sites", mimeType: "application/json" },
						{ uri: "indexfast://issues", name: "issues", title: "Open issues", mimeType: "application/json" },
						{ uri: "indexfast://resources/directories", name: "directories", title: "Launch directories", mimeType: "application/json" },
						{ uri: "indexfast://resources/tools", name: "tools", title: "SEO tools", mimeType: "application/json" },
					],
				});
			case "resources/templates/list":
				return jsonRpcResult(request.id, {
					resourceTemplates: [
						{ uriTemplate: "indexfast://sites/{site}", name: "site", title: "Site details", mimeType: "application/json" },
						{ uriTemplate: "indexfast://sites/{site}/urls", name: "site-urls", title: "Site URLs", mimeType: "application/json" },
					],
				});
			case "resources/read": {
				const uri = asString(params.uri);
				return jsonRpcResult(request.id, {
					contents: [{ uri, mimeType: "application/json", text: JSON.stringify(await readResource(auth, uri), null, 2) }],
				});
			}
			case "prompts/list":
				return jsonRpcResult(request.id, { prompts });
			case "prompts/get":
				return jsonRpcResult(request.id, getPrompt(asString(params.name), (params.arguments as Record<string, unknown>) || {}));
			default:
				return jsonRpcError(request.id, -32601, `Method not found: ${method}`);
		}
	} catch (error) {
		return jsonRpcError(request.id, -32000, error instanceof Error ? error.message : "Unknown MCP error");
	}
}
