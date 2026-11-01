/*
 * Builds /llms.txt and /llms-full.txt: the plain-text briefs AI assistants and agents read to
 * describe IndexFast accurately. Generated, not static, so plan prices and limits come from
 * plans.ts and the tool, guide, comparison and engine lists come from their data files; a change
 * there can never leave the AI-facing summary stale. Rules: no indexing guarantees, no customer
 * counts, testimonials or third-party listings we cannot verify.
 */
import { blogPosts, comparisons, tools } from "@/lib/marketing-data";
import { PLANS, PLAN_PERIOD_DAYS, PLAN_GRACE_DAYS, formatLimit } from "@/lib/platform/plans";
import { getAllSearchEngines } from "@/lib/resources/search-engines";
import { SITE_URL } from "@/lib/seo";

const MCP_TOOLS = [
	"list_engines", "add_site", "verify_site", "get_site", "discover_sitemaps", "add_sitemap", "sync_now",
	"list_urls", "submit_urls", "submit_pending", "process_submission_queue", "get_submission_queue", "list_submissions",
	"check_url", "list_issues", "inspect_url", "get_google_connection", "submit_sitemap_to_gsc",
	"set_bing_api_key", "set_bing_auto_submit", "get_bing_status", "remove_bing_api_key",
	"set_yandex_token", "set_baidu_token", "set_engine_auto_submit", "remove_engine",
	"account_status", "list_directories", "list_seo_tools", "list_search_engines", "recommend_seo_resources",
];

function planLine(id: "free" | "pro" | "unlimited") {
	const plan = PLANS[id];
	const price = plan.priceUsd === 0 ? "$0" : `$${plan.priceUsd} per ${PLAN_PERIOD_DAYS} days, prepaid, no auto-renewal`;
	return `- ${plan.name} (${price}): ${plan.features.join("; ")}.`;
}

function header() {
	return `# IndexFast

> IndexFast is an agent-ready indexing service for websites. Add a domain and host one IndexNow key file; IndexFast then reads your sitemaps, finds new and changed URLs, and submits them through official search engine channels: IndexNow (Bing, Yandex, Seznam, Naver and others) on every plan, plus the Bing Webmaster API, Yandex, Baidu and Google Search Console (URL inspection and sitemap submission) on paid plans. AI agents can run all of it through an MCP server, a REST API, a CLI and a SKILL.md file.

IndexFast does not guarantee Google indexing; no tool can. It speeds up discovery on engines that accept push submissions, reports what each engine answered, and finds the technical blockers (HTTP errors, redirects, noindex, canonical mismatches) that keep pages out of the index. Google's Indexing API is used only for JobPosting and livestream BroadcastEvent pages, as Google's policy requires. Nothing is submitted for a site whose ownership is not verified.
`;
}

function pricing() {
	return `## Pricing

${planLine("free")}
${planLine("pro")}
${planLine("unlimited")}
- After a paid period ends there is a ${PLAN_GRACE_DAYS}-day grace period, then Free limits apply. Nothing is deleted; sites beyond the Free limit are paused.
- Details: [Pricing](${SITE_URL}/pricing)
`;
}

function agents() {
	return `## For AI agents and developers

- MCP endpoint: ${SITE_URL}/api/mcp (streamable HTTP, \`Authorization: Bearer idxf_...\`, available on every plan). Create a key at ${SITE_URL}/dashboard/connect.
- REST API base: ${SITE_URL}/api/v1 (Bearer API key with scopes). Main resources: /sites, /sites/{site}/verify, /sitemaps, /urls, /submissions, /queue, /diagnostics, /inspect, /engines, /bing, /yandex, /baidu, /gsc, /resources/directories, /resources/tools. {site} accepts a site id or a domain.
- CLI: \`npx indexfast login --api-key idxf_...\`, then \`npx indexfast sites\`, \`sitemaps:sync\`, \`submit\`, \`diagnostics\`. Installer: ${SITE_URL}/install.sh
- [SKILL.md for coding agents](${SITE_URL}/resources/skill): install instructions and the raw file at ${SITE_URL}/resources/skill/SKILL.md
`;
}

export function buildLlmsTxt() {
	return `${header()}
## Product

- [Home](${SITE_URL}/): what IndexFast does and how setup works.
- [Pricing](${SITE_URL}/pricing): Free, Pro and Unlimited plans.
- [Search engine submission APIs](${SITE_URL}/resources/search-engines): IndexNow, Bing, Google, Yandex, Baidu, Naver and Seznam methods, quotas and auth.
- [Google Indexing API guardrails](${SITE_URL}/resources/google-indexing-api): when Google's Indexing API is allowed.
- [Comparisons](${SITE_URL}/compare): IndexFast vs other indexing tools.
- [About](${SITE_URL}/about)

${pricing()}
${agents()}
## Free tools (no signup)

${tools.map((tool) => `- [${tool.title}](${SITE_URL}/tools/${tool.slug}): ${tool.description}`).join("\n")}

## Guides

${blogPosts.map((post) => `- [${post.title}](${SITE_URL}/blog/${post.slug}): ${post.description}`).join("\n")}

## Optional

- [Full brief for LLMs](${SITE_URL}/llms-full.txt)
- [100+ launch and submission directories](${SITE_URL}/resources/directories)
- [Third-party SEO tools](${SITE_URL}/resources/tools)
- [Contact](${SITE_URL}/contact)
`;
}

export function buildLlmsFullTxt() {
	const engines = getAllSearchEngines();
	const limits = (id: "free" | "pro" | "unlimited") => {
		const l = PLANS[id].limits;
		return `- ${PLANS[id].name}: ${formatLimit(l.sites)} sites, ${formatLimit(l.urlsPerSite)} URLs per site, sitemap sync every ${l.syncIntervalMinutes >= 1440 ? `${l.syncIntervalMinutes / 1440} day` : `${l.syncIntervalMinutes} minutes`}, ${formatLimit(l.apiKeys)} API keys, ${formatLimit(l.monthlyApiRequests)} API/MCP calls per month, ${l.gscInspectionsPerDay} Search Console inspections per site per day, Bing API ${l.bing ? "yes" : "no"}, Yandex ${l.yandex ? "yes" : "no"}, Baidu ${l.baidu ? "yes" : "no"}, Google Indexing API (eligible pages only) ${l.googleIndexingApi ? "yes" : "no"}.`;
	};
	return `${header()}
## How it works

1. Add a domain. IndexFast generates an IndexNow key and discovers your sitemaps (robots.txt first, then common paths).
2. Host the key at https://<your-host>/<key>.txt. IndexFast fetches it without following redirects to another URL; a match is the ownership proof and turns on automation.
3. An hourly background job syncs due sitemaps (Free daily, paid hourly), dedupes URLs, and queues new URLs and URLs whose lastmod changed. Changed URLs are not resubmitted within 24 hours.
4. The queue sends IndexNow batches of up to 1,000 URLs and Bing batches of up to 100. A rate limit (HTTP 429) pauses that engine for the site with backoff from 1 hour up to 24 hours instead of failing jobs; network and 5xx errors get 3 attempts.
5. With Google connected over OAuth, IndexFast inspects URLs through the Search Console URL Inspection API within Google's quota and can submit sitemaps to Search Console. It does not request indexing: Google offers no public API for that on normal pages.
6. Every submission is logged with the engine, status and response, visible in the dashboard and over the API and MCP.

## Who it is for

- Indie developers and builders shipping Next.js, AI-built or programmatic SEO sites whose new pages are slow to be discovered.
- AI coding agents (Claude Code, Cursor, Codex and similar) running indexing work on a person's behalf through MCP, the REST API, the CLI or SKILL.md.
- SEO operators managing several sites who need queue visibility and diagnostics.

${pricing()}
### Plan limits

${limits("free")}
${limits("pro")}
${limits("unlimited")}

${agents()}
### MCP tools

${MCP_TOOLS.map((name) => `\`${name}\``).join(", ")}.

Example MCP client config:

\`\`\`json
{
  "mcpServers": {
    "indexfast": {
      "type": "streamable-http",
      "url": "${SITE_URL}/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_INDEXFAST_API_KEY" }
    }
  }
}
\`\`\`

## Search engines

${engines.map((engine) => `### ${engine.name}\n\n${engine.summary}\n\nMethods: ${engine.methods.map((m) => `${m.name} (batch ${m.batchSize.toLocaleString("en-US")}, quota: ${m.dailyQuota})`).join("; ")}.\nGuide: ${SITE_URL}/resources/search-engines/${engine.id}`).join("\n\n")}

## Free tools (no signup)

${tools.map((tool) => `- ${tool.title} (${SITE_URL}/tools/${tool.slug}): ${tool.description}`).join("\n")}

## Comparisons

${comparisons.map((item) => `### IndexFast vs ${item.competitor}\n\n${item.summary}\n\n${SITE_URL}/compare/${item.slug}`).join("\n\n")}

## Guides

${blogPosts.map((post) => `### ${post.title}\n\n${post.description}\n\n${post.sections.map((section) => `- ${section.heading}: ${section.body}`).join("\n")}\n\n${SITE_URL}/blog/${post.slug}`).join("\n\n")}

## Limits and policies

- No guaranteed indexing on any engine. Engines decide what to crawl, index and rank.
- Google Indexing API: JobPosting and livestream BroadcastEvent (in VideoObject) pages only; other pages are refused and logged as skipped.
- Only URLs on hosts whose ownership is verified are ever submitted. IndexFast does not index backlinks or third-party URLs.
- No submissions to third-party directories without an official API; the directory list is a checklist with links.
- Credentials (Bing, Yandex and Baidu keys, Google refresh tokens) are stored encrypted. IndexFast API keys are stored only as hashes.

## Company

- Name: IndexFast. Website: ${SITE_URL}. Contact: ${SITE_URL}/contact
`;
}
