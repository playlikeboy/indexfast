/*
 * Marketing content data: the single list of free tools and blog posts. /tools, /blog, every post
 * header and /sitemap.xml read from here, so a post's date and read time live in one place.
 * Every page under src/app/blog/<slug> must have an entry here or it is orphaned from the index
 * and the sitemap. Read time is the body word count at about 230 words a minute, rounded up.
 */
export type ToolDefinition = {
	slug: string;
	aliases?: string[];
	title: string;
	description: string;
	tag?: string;
	checks: string[];
	outputs: string[];
};

export type BlogPost = {
	slug: string;
	title: string;
	description: string;
	date: string;
	readTime: string;
	sections: { heading: string; body: string }[];
};

export const tools: ToolDefinition[] = [
	{
		slug: "google-index-checker",
		title: "Google Index Checker",
		description: "Check if a URL is indexed by Google using live SERP verification.",
		tag: "Popular",
		checks: ["URL format", "SERP visibility", "Indexing signal"],
		outputs: ["Indexed status", "Search query used", "Recommended next action"],
	},
	{
		slug: "bulk-index-checker",
		title: "Bulk Index Checker",
		description: "Check indexing status for hundreds of URLs at once via CSV or bulk input.",
		tag: "Popular",
		checks: ["Bulk URL input", "Duplicate removal", "Index status queue"],
		outputs: ["Per-URL status", "CSV export", "Priority issue list"],
	},
	{
		slug: "sitemap-url-extractor",
		title: "Sitemap URL Extractor",
		description: "Parse any XML sitemap and extract every URL for review or bulk analysis.",
		tag: "Popular",
		checks: ["Sitemap XML", "Sitemap indexes", "URL extraction"],
		outputs: ["URL list", "Total URL count", "Export-ready rows"],
	},
	{
		slug: "robots-txt-checker",
		title: "Robots.txt Checker",
		description: "Analyze robots.txt rules, sitemap references, and blocked paths.",
		checks: ["robots.txt availability", "Disallow rules", "Sitemap declarations"],
		outputs: ["Crawler access summary", "Blocked path warnings", "Sitemap hints"],
	},
	{
		slug: "noindex-tag-checker",
		title: "Noindex Tag Checker",
		description: "Scan pages for noindex meta tags and X-Robots-Tag headers.",
		checks: ["Meta robots", "X-Robots-Tag", "HTTP status"],
		outputs: ["Noindex status", "Header details", "Fix recommendation"],
	},
	{
		slug: "canonical-checker",
		title: "Canonical Checker",
		description: "Verify canonical tags and detect canonical mismatches.",
		checks: ["Canonical href", "Self-reference", "Cross-domain canonicals"],
		outputs: ["Canonical target", "Mismatch warning", "Indexability impact"],
	},
	{
		slug: "http-status-checker",
		title: "HTTP Status Checker",
		description: "Check response codes, redirect chains, and server errors for any URL.",
		checks: ["HTTP status", "Redirect chain", "Response headers"],
		outputs: ["Status code", "Redirect path", "Error classification"],
	},
	{
		slug: "indexnow-key-generator",
		title: "IndexNow Key Generator",
		description: "Generate a secure IndexNow key for supported search engines.",
		checks: ["Domain input", "Key format", "Key location"],
		outputs: ["Generated key", "Key file path", "Submission payload hint"],
	},
	{
		slug: "bing-indexnow-submitter",
		aliases: ["indexnow-submitter"],
		title: "Bing IndexNow Submitter",
		description: "Submit changed URLs through the IndexNow protocol.",
		checks: ["Domain host", "IndexNow key", "URL list"],
		outputs: ["Submission payload", "Engine response", "Retry guidance"],
	},
	{
		slug: "llms-txt-generator",
		title: "llms.txt Generator",
		description: "Generate an llms.txt file describing your site for AI crawlers.",
		checks: ["Site sections", "Important URLs", "Crawler summary"],
		outputs: ["llms.txt draft", "Suggested placement", "AI crawler notes"],
	},
	{
		slug: "ai-crawler-checker",
		title: "AI Crawler Checker",
		description: "Detect which AI crawlers can access your pages and identify blocking rules.",
		checks: ["robots.txt AI rules", "User-agent coverage", "Important path access"],
		outputs: ["Crawler access matrix", "Blocked AI agents", "Recommended rule changes"],
	},
];

export const blogPosts: BlogPost[] = [
	{
		slug: "find-unindexed-pages",
		title: "How to Find Unindexed Pages in 2026",
		description:
			"A step-by-step guide to auditing your sitemap, running index checks, and recovering dropped pages.",
		date: "2026-06-01",
		readTime: "3 min read",
		sections: [
			{
				heading: "Start with your sitemap",
				body: "Export every URL from your sitemap and compare it with the pages that matter to your business. Missing, stale, and redirected URLs usually explain a surprising amount of indexing drift.",
			},
			{
				heading: "Separate technical blockers from quality signals",
				body: "A URL can be technically indexable but still invisible. Check HTTP status, robots rules, noindex tags, canonicals, and Search Console coverage before assuming the page has a content problem.",
			},
			{
				heading: "Monitor changes over time",
				body: "One-time checks are useful, but recurring monitoring catches drops, accidental noindex tags, and sitemap regressions before they become traffic problems.",
			},
		],
	},
	{
		slug: "indexnow-vs-indexing-api",
		title: "IndexNow vs. Google's Indexing API: What Actually Works",
		description:
			"Comparing IndexNow, Bing Webmaster, and Google's limited Indexing API for modern SEO teams.",
		date: "2026-05-28",
		readTime: "3 min read",
		sections: [
			{
				heading: "IndexNow is a discovery signal",
				body: "IndexNow can notify supported search engines that a URL changed. It helps with discovery, but it is not a guarantee that the URL will be indexed or ranked.",
			},
			{
				heading: "Google's Indexing API is narrow",
				body: "Google's official Indexing API is intended for limited content types. For most sites, sitemap hygiene, Search Console workflows, and technical diagnostics are the safer path.",
			},
			{
				heading: "Use both where they fit",
				body: "A strong indexing workflow combines clean sitemaps, crawlable pages, useful content, and transparent submission history.",
			},
		],
	},
	{
		slug: "sitemap-monitoring-best-practices",
		title: "Sitemap Monitoring Best Practices for Large Sites",
		description:
			"How to keep sitemap coverage high, spot stale entries, and catch orphaned pages before they get dropped.",
		date: "2026-05-20",
		readTime: "3 min read",
		sections: [
			{
				heading: "Keep sitemap indexes clean",
				body: "Large sites should split sitemap files predictably and avoid mixing canonical, redirected, and blocked URLs in the same feed.",
			},
			{
				heading: "Track additions and removals",
				body: "A useful monitor records when URLs appear, disappear, or change metadata so teams can connect indexing issues to releases.",
			},
			{
				heading: "Alert on meaningful failures",
				body: "Prioritize failed syncs, large URL drops, noindex changes, and spikes in non-200 responses.",
			},
		],
	},
	{
		slug: "pseo-pages-not-ranking",
		title: "Why Your Programmatic SEO Pages Are Not Ranking",
		description:
			"Common pSEO indexing failures and how to fix them before they tank your organic growth.",
		date: "2026-05-15",
		readTime: "3 min read",
		sections: [
			{
				heading: "Indexing comes before ranking",
				body: "If generated pages are not indexed, ranking analysis is premature. Confirm crawlability and canonical intent first.",
			},
			{
				heading: "Templates can multiply mistakes",
				body: "A single bad noindex tag, canonical rule, or thin template can affect thousands of pages at once.",
			},
			{
				heading: "Measure the launch cohort",
				body: "Track each generated batch as a cohort so you can see which templates, categories, or data sources struggle to become visible.",
			},
		],
	},
	{
		slug: "gsc-alerts-setup",
		title: "How to Set Up Google Search Console Alerts",
		description:
			"Automate your indexing health monitoring with GSC visibility workflows and deindexing alerts.",
		date: "2026-05-10",
		readTime: "3 min read",
		sections: [
			{
				heading: "Start from verified properties",
				body: "Search Console data is most useful when the site is verified and mapped to the same canonical domain used in your sitemap.",
			},
			{
				heading: "Watch for sudden status changes",
				body: "Alerts should focus on changes that matter: drops in indexed URLs, increases in excluded pages, and pages that suddenly become blocked.",
			},
			{
				heading: "Pair GSC with live checks",
				body: "GSC is powerful but delayed. Combining it with live diagnostics gives you faster feedback when a deploy changes page behavior.",
			},
		],
	},
	{
		slug: "bing-webmaster-api-key",
		title: "How to Find and Use your Bing Webmaster API Key",
		description:
			"An in-depth guide answering what the Bing Webmaster Tools API key is, why you need it to automate indexing, and how to configure it step-by-step.",
		date: "2026-06-05",
		readTime: "4 min read",
		sections: [
			{
				heading: "What is the Bing Webmaster Tools API Key?",
				body: "The Bing Webmaster Tools API key is a unique user-level credential that grants programmatic access to Microsoft Bing's webmaster services. It allows automated tools and servers to inspect crawl statistics, fetch indexing status, and push URLs directly into Bing's index pipelines without manual interface interaction.",
			},
			{
				heading: "Why is it necessary for automated SEO?",
				body: "Standard search engine discovery can take days or weeks for crawlers to naturally reach your updated pages. By utilizing the API key, platforms like IndexFast can instantly notify Bing of sitemap changes and manually queue priority URLs, drastically decreasing time-to-index and boosting search visibility.",
			},
			{
				heading: "How to find and generate your key",
				body: "Log in to the Bing Webmaster Tools portal, navigate to the top-right Settings cog icon, and select 'API Access' followed by 'API Key'. If none exists, you can generate a new 32-character hexadecimal key, which applies universally to all verified sites inside your account.",
			},
			{
				heading: "Who needs to configure it and when?",
				body: "Any website owner, programmatic SEO architect, or marketing agency managing index recovery needs this key to set up real-time search discovery. It should be configured immediately upon site launch, and rotated/regenerated if ever exposed to public repositories.",
			},
		],
	},
	{
		slug: "indexnow-key-setup",
		title: "How to Set Up and Verify an IndexNow Key",
		description:
			"An exhaustive guide to the IndexNow protocol, explaining why instant URL submissions are necessary, who supports it, and how to verify your domain key.",
		date: "2026-06-03",
		readTime: "4 min read",
		sections: [
			{
				heading: "What is the IndexNow Protocol?",
				body: "IndexNow is an open, lightweight HTTP protocol designed to allow website operators to instantly alert search engines (such as Bing, Seznam, and Yandex) about content updates, deletions, and additions, enabling search engines to prioritize their crawl cycles efficiently.",
			},
			{
				heading: "Why is IndexNow essential for modern sites?",
				body: "Traditional crawl models consume unnecessary bandwidth and delay search indexing. IndexNow solves this by pushing change signals directly to search engines. This reduces crawl overhead on your server while ensuring search results reflect your fresh content within seconds.",
				
			},
			{
				heading: "Who supports the IndexNow protocol?",
				body: "IndexNow is currently co-authored and supported by Microsoft Bing, Yandex, Seznam, and other search engines. Google has also run trials for integrating it. When you submit URLs to any participating search engine, the protocol automatically shares the notification with all other participating engines.",
			},
			{
				heading: "How to generate, host, and verify your key",
				body: "Generate an 8-to-128 character alphanumeric key and host it as a text file (e.g., /your-key.txt) returning a 200 OK status code at the root of your domain. Once hosted, register it in IndexFast to enable automatic trigger loops every time a sitemap update is crawled.",
			},
		],
	},
	{
		slug: "seo-meta-tags-that-matter",
		title: "SEO Meta Tags That Actually Matter for Indexing",
		description:
			"The meta tags, HTTP headers, and directives that control whether your pages get indexed, and which ones SEOs still waste time on.",
		date: "2026-05-05",
		readTime: "3 min read",
		sections: [
			{
				heading: "The meta tags that control indexing",
				body: "The robots meta tag, the X-Robots-Tag HTTP header, and the canonical link element decide whether a page is indexed. Get these wrong and the page will not appear in search results.",
			},
			{
				heading: "Meta tags that do not matter for indexing",
				body: "The keywords, author, revisit-after, and expires tags have no effect on indexing in major search engines.",
			},
			{
				heading: "How to audit your meta tags at scale",
				body: "Spot-check small sites in the browser; for large or dynamic sites, scan pages for noindex signals, verify canonicals, and check X-Robots-Tag headers on non-HTML assets.",
			},
		],
	},
];

export function getToolBySlug(slug: string) {
	return tools.find((tool) => tool.slug === slug || tool.aliases?.includes(slug));
}

export function getBlogPostBySlug(slug: string) {
	return blogPosts.find((post) => post.slug === slug);
}
