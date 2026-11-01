/*
 * robots.txt: keeps crawlers out of the signed-in app, the API and the auth screens. sitemap.ts
 * must not list any path disallowed here.
 *
 * AI search and answer crawlers are named explicitly and allowed on public pages, because being
 * read and cited by ChatGPT, Claude, Perplexity and Gemini is a goal for this site. A crawler
 * that matches a named group ignores the `*` group, so every named group repeats the private
 * paths. Note: Cloudflare's "managed robots.txt" (AI Crawl Control) prepends its own block list
 * to this file at the edge; if it is on, it disallows these same bots and must be turned off in
 * the Cloudflare dashboard for the rules below to be the only ones served.
 */
import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const PRIVATE_PATHS = ["/dashboard", "/admin", "/api/", "/login", "/signup", "/handler/"];

// Search-index and live-retrieval agents for AI answers, plus the opt-in tokens for Gemini and
// Apple Intelligence. Public marketing, docs and tools pages are meant to be quoted.
const AI_CRAWLERS = [
	"GPTBot",
	"OAI-SearchBot",
	"ChatGPT-User",
	"ClaudeBot",
	"Claude-SearchBot",
	"Claude-User",
	"PerplexityBot",
	"Perplexity-User",
	"Google-Extended",
	"Applebot-Extended",
	"meta-externalagent",
	"DuckAssistBot",
	"MistralAI-User",
];

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: PRIVATE_PATHS,
			},
			{
				userAgent: AI_CRAWLERS,
				allow: "/",
				disallow: PRIVATE_PATHS,
			},
		],
		sitemap: `${SITE_URL}/sitemap.xml`,
	};
}
