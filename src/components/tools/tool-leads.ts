/*
 * One sentence per free tool saying exactly what it does, shared by the tool's own hero and the
 * /tools index so the two never drift apart. Keep each to what the tool really checks: none of
 * them looks up live Google results, so none may say it does.
 */
export const TOOL_LEADS: Record<string, string> = {
	"ai-crawler-checker": "See which AI crawlers your robots.txt lets in, and which group decides.",
	"bing-indexnow-submitter": "Send up to 100 changed URLs to Bing and other IndexNow engines.",
	"bulk-index-checker": "Check up to 20 URLs at once for status, noindex and canonical blockers.",
	"canonical-checker": "Read a page's canonical tag and see whether it matches the URL.",
	"google-index-checker": "Find what keeps a URL out of Google, then confirm in Search Console.",
	"http-status-checker": "See the status code, redirects and response headers for any URL.",
	"indexnow-key-generator": "Generate a random IndexNow key and the file name to host it.",
	"llms-txt-generator": "Generate an llms.txt file that describes your site to AI models.",
	"noindex-tag-checker": "Find noindex meta tags and X-Robots-Tag headers on any URL.",
	"robots-txt-checker": "Read a site's robots.txt: crawl rules, Disallow paths and sitemaps.",
	"sitemap-url-extractor": "Paste a sitemap URL and list every page URL in it.",
};
