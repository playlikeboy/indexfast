/*
 * Marketing content data: the single list of free tools and blog posts. /tools, /blog, every post
 * header and /sitemap.xml read from here, so a post's date and read time live in one place.
 * Every page under src/app/blog/<slug> must have an entry here or it is orphaned from the index
 * and the sitemap. Read time is the body word count at about 230 words a minute, rounded up.
 * `comparisons` feeds /compare and /compare/<slug>. Comparison facts must be verifiable on the
 * competitor's own public page (linked from each entry) and are dated by `checked`; never state a
 * competitor price, a speed claim or anything we could not read on their site. IndexFast's own
 * prices are not stored here: the page reads them from plans.ts.
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

export type Comparison = {
	slug: string;
	competitor: string;
	competitorUrl: string;
	category: string;
	// Answer-first: two or three sentences an AI answer engine can quote as is.
	summary: string;
	rows: { label: string; indexfast: string; competitor: string }[];
	competitorPricing: string;
	chooseCompetitor: string[];
	chooseIndexFast: string[];
	faqs: { question: string; answer: string }[];
	checked: string;
};

export const tools: ToolDefinition[] = [
	{
		slug: "google-index-checker",
		title: "Google Index Checker",
		description: "Check whether Google can index a URL (HTTP status, redirects, noindex, canonical) and open it in Search Console URL Inspection.",
		tag: "Popular",
		checks: ["HTTP status and redirects", "Noindex meta and X-Robots-Tag", "Canonical target"],
		outputs: ["Indexability verdict", "Blocker details", "Search Console URL Inspection link"],
	},
	{
		slug: "bulk-index-checker",
		title: "Bulk Index Checker",
		description: "Check up to 20 URLs at once for indexing blockers: HTTP status, noindex and canonical.",
		tag: "Popular",
		checks: ["Bulk URL input (up to 20)", "Duplicate removal", "Per-URL indexability checks"],
		outputs: ["Per-URL status", "Download results as CSV", "Priority issue list"],
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
		slug: "discovered-currently-not-indexed",
		title: "Discovered or crawled, currently not indexed: what it means and what to do",
		description:
			"What the two most common Search Console exclusions mean, how they differ, and a fix order that starts with technical blockers before content.",
		date: "2026-11-01",
		readTime: "5 min read",
		sections: [
			{
				heading: "Discovered means Google knows the URL but has not fetched it",
				body: "Google found the URL, usually in a sitemap or a link, and postponed crawling it. Common causes are a new site with little crawl demand, many near-identical URLs, weak internal linking, or a server that slowed down.",
			},
			{
				heading: "Crawled means Google fetched it and chose not to index it yet",
				body: "The page was fetched but not added to the index. Check for technical blockers first (noindex, canonical to another URL, soft 404), then for thin or duplicate content.",
			},
			{
				heading: "Fix order",
				body: "Remove blockers, link the page from pages that are already indexed, keep it in a clean sitemap, then use URL Inspection. Neither status is a penalty, and no tool can force Google to index a page.",
			},
		],
	},
	{
		slug: "how-to-get-indexed-on-bing",
		title: "How to get your pages indexed on Bing (and into AI answers that use it)",
		description:
			"A practical Bing indexing checklist: Bing Webmaster Tools, sitemaps, IndexNow and the Webmaster API, and why Bing coverage matters for Copilot and other AI search.",
		date: "2026-10-30",
		readTime: "5 min read",
		sections: [
			{
				heading: "Verify the site in Bing Webmaster Tools",
				body: "Add the site, verify it (import from Google Search Console is the fastest way), and submit your XML sitemap.",
			},
			{
				heading: "Push changes with IndexNow",
				body: "IndexNow tells Bing and other participating engines the moment a URL is created, updated or deleted. One key file at your site root proves ownership.",
			},
			{
				heading: "Why Bing matters for AI search",
				body: "Bing's index feeds Microsoft Copilot and several search engines that syndicate Bing results, so pages missing from Bing are harder for those AI answers to cite.",
			},
		],
	},
	{
		slug: "indexnow-nextjs",
		title: "How to set up IndexNow on a Next.js site",
		description:
			"Host the IndexNow key in public/, make sure it is served without redirects, and ping IndexNow after each deploy, with a copy-paste script and the response codes to expect.",
		date: "2026-10-28",
		readTime: "5 min read",
		sections: [
			{
				heading: "Host the key in public/",
				body: "Next.js serves files in public/ from the site root, so public/<key>.txt becomes https://your-site.com/<key>.txt. It must return 200 with the key as plain text and no redirect.",
			},
			{
				heading: "Ping after each deploy",
				body: "POST the changed URLs as JSON (host, key, keyLocation, urlList) to https://api.indexnow.org/indexnow. Up to 10,000 URLs fit in one request.",
			},
			{
				heading: "Or automate it from your sitemap",
				body: "IndexFast reads your sitemap, works out which URLs are new or changed, and sends them for you with throttle-aware retries.",
			},
		],
	},
	{
		slug: "find-unindexed-pages",
		title: "How to find unindexed pages in 2026",
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
		title: "IndexNow vs. Google's Indexing API: what actually works",
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
		title: "Sitemap monitoring best practices for large sites",
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
		title: "Why your programmatic SEO pages are not ranking",
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
		title: "How to set up Google Search Console alerts",
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
		title: "How to find and use your Bing Webmaster API key",
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
				body: "Standard search engine discovery can take days or weeks for crawlers to naturally reach your updated pages. By utilizing the API key, platforms like IndexFast can notify Bing of sitemap changes immediately and queue priority URLs by hand. Bing still decides when to crawl and whether to index.",
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
		title: "How to set up and verify an IndexNow key",
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
		title: "SEO meta tags that actually matter for indexing",
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

// Shared IndexFast column values, so every comparison describes the product the same way.
const IF_TYPE = "Hosted service (web dashboard, MCP server, REST API, CLI)";
const IF_WORKS_WITH = "Any site with an XML sitemap: Next.js, WordPress, static sites, programmatic SEO builds";
const IF_DISCOVERY = "Reads your sitemaps on a schedule (daily on Free, hourly on paid plans) and queues new and changed URLs";
const IF_ENGINES = "IndexNow on every plan; Bing Webmaster API, Yandex, Baidu and Search Console (URL inspection, sitemap submit) on paid plans";
const IF_GOOGLE = "Uses Google's Indexing API only for JobPosting and livestream pages, as Google's policy requires. Never promises Google indexing";
const IF_AGENTS = "MCP server, REST API, CLI and SKILL.md on every plan";
const IF_SCOPE = "Only URLs on hosts you verified by hosting the IndexNow key file";

export const comparisons: Comparison[] = [
	{
		slug: "rank-math-instant-indexing",
		competitor: "Rank Math Instant Indexing",
		competitorUrl: "https://wordpress.org/plugins/fast-indexing-api/",
		category: "WordPress plugin",
		summary:
			"Rank Math's Instant Indexing is a free WordPress plugin that sends post URLs to Google's Indexing API, using a Google Cloud service account you create, and to IndexNow. IndexFast is a hosted service for any site with a sitemap: it sends IndexNow and other official engine APIs automatically, and uses Google's Indexing API only for the JobPosting and livestream pages Google allows.",
		rows: [
			{ label: "Type", indexfast: IF_TYPE, competitor: "WordPress plugin, configured in wp-admin" },
			{ label: "Works with", indexfast: IF_WORKS_WITH, competitor: "WordPress sites only" },
			{ label: "How URLs are found", indexfast: IF_DISCOVERY, competitor: "WordPress publish and update events for the post types you choose, plus manual submission" },
			{ label: "Google Indexing API", indexfast: IF_GOOGLE, competitor: "Sends the post types you select. Google documents the API for JobPosting and BroadcastEvent pages only" },
			{ label: "Other engines", indexfast: IF_ENGINES, competitor: "IndexNow" },
			{ label: "Agent and API access", indexfast: IF_AGENTS, competitor: "WordPress admin screens" },
		],
		competitorPricing: "Free plugin on WordPress.org",
		chooseCompetitor: [
			"Your site runs on WordPress and you want a free plugin inside wp-admin.",
			"Your pages are job postings or livestreams, which Google's Indexing API is meant for.",
		],
		chooseIndexFast: [
			"Your site is not WordPress, or you run several sites from one place.",
			"You want sitemap monitoring, a submission log and engine responses per URL.",
			"You want an AI agent to run indexing work through MCP or the REST API.",
			"You want to stay inside Google's Indexing API policy without checking each page yourself.",
		],
		faqs: [
			{
				question: "Can Rank Math Instant Indexing get any page indexed by Google?",
				answer:
					"No tool can guarantee that. Google's Indexing API documentation says the API is only for pages with JobPosting or BroadcastEvent (in VideoObject) structured data. Sending other pages is outside that policy, and Google decides what it indexes either way.",
			},
			{
				question: "Can I use IndexFast on a WordPress site?",
				answer:
					"Yes. IndexFast reads your sitemap, so it works with WordPress (including sitemaps from Rank Math or Yoast) and with any other stack. You host one IndexNow key file to prove ownership.",
			},
		],
		checked: "2026-11-01",
	},
	{
		slug: "indexnow-wordpress-plugin",
		competitor: "Microsoft IndexNow plugin",
		competitorUrl: "https://wordpress.org/plugins/indexnow/",
		category: "WordPress plugin",
		summary:
			"Microsoft's IndexNow plugin is a free WordPress plugin that notifies IndexNow engines when you publish, update or delete a post. IndexFast does the same IndexNow push for any site with a sitemap, and adds sitemap monitoring, a submission log, other official engine APIs on paid plans, and an MCP server for AI agents.",
		rows: [
			{ label: "Type", indexfast: IF_TYPE, competitor: "WordPress plugin from Microsoft Bing" },
			{ label: "Works with", indexfast: IF_WORKS_WITH, competitor: "WordPress sites only" },
			{ label: "How URLs are found", indexfast: IF_DISCOVERY, competitor: "WordPress publish, update and delete events" },
			{ label: "Engines", indexfast: IF_ENGINES, competitor: "IndexNow (Bing, Yandex, Seznam, Naver and other participating engines)" },
			{ label: "Google", indexfast: IF_GOOGLE, competitor: "Not covered: Google does not use IndexNow" },
			{ label: "Agent and API access", indexfast: IF_AGENTS, competitor: "WordPress admin screens" },
		],
		competitorPricing: "Free plugin on WordPress.org",
		chooseCompetitor: [
			"You only run WordPress and IndexNow is all you need.",
			"You prefer a plugin from the search engine itself and no external account.",
		],
		chooseIndexFast: [
			"Your site is built with Next.js, a static generator or another non-WordPress stack.",
			"You want to see which URLs were sent, when, and what each engine answered.",
			"You also want the Bing Webmaster API, Yandex, Baidu or Search Console inspection.",
			"You want agents in Claude Code or Cursor to manage indexing through MCP.",
		],
		faqs: [
			{
				question: "Do I need both the IndexNow plugin and IndexFast?",
				answer:
					"No. Both send IndexNow notifications, so pick one per site to avoid duplicate pings. IndexNow engines share submissions, so one ping per URL change is enough.",
			},
			{
				question: "Does IndexNow reach Google?",
				answer:
					"No. Google does not use IndexNow. For Google, keep a clean XML sitemap and use Search Console. IndexFast can submit sitemaps and inspect URLs through the Search Console API once you connect Google.",
			},
		],
		checked: "2026-11-01",
	},
	{
		slug: "indexmenow",
		competitor: "IndexMeNow",
		competitorUrl: "https://indexmenow.com/",
		category: "Paid indexing service",
		summary:
			"IndexMeNow is a paid indexing service marketed for getting pages and backlinks indexed in Google, with credits bought per URL according to its website. IndexFast is different in scope: it only submits URLs on hosts you verify, only through documented official engine APIs such as IndexNow, Bing and Search Console, and never promises Google indexing.",
		rows: [
			{ label: "Type", indexfast: IF_TYPE, competitor: "Hosted paid service" },
			{ label: "Which URLs", indexfast: IF_SCOPE, competitor: "Any URL you submit, including backlinks on sites you do not own" },
			{ label: "Method", indexfast: "Documented engine APIs only: IndexNow, Bing Webmaster API, Yandex, Baidu, Search Console", competitor: "Not publicly documented on its website at the time we checked" },
			{ label: "Google", indexfast: IF_GOOGLE, competitor: "Marketed around Google indexing" },
			{ label: "Monitoring", indexfast: "Sitemap sync, indexability checks (status, redirects, noindex, canonical), submission log", competitor: "Reports the status of submitted URLs" },
			{ label: "Agent and API access", indexfast: IF_AGENTS, competitor: "See its website for current API options" },
		],
		competitorPricing: "Paid, credit based. See its website for current prices",
		chooseCompetitor: [
			"You want third-party URLs, such as backlinks on other sites, sent for indexing. IndexFast cannot do that because it only submits hosts you verify.",
		],
		chooseIndexFast: [
			"You want only official, documented engine APIs used for your own site.",
			"You want new and changed pages found from your sitemap automatically, without buying credits per URL.",
			"You want a record of exactly what was sent and what each engine answered.",
			"You want AI agents to run the workflow through MCP or the REST API.",
		],
		faqs: [
			{
				question: "Is IndexFast an IndexMeNow alternative?",
				answer:
					"For your own site's pages, yes: IndexFast pushes new and changed URLs through official engine APIs and finds the blockers that keep them out of the index. It is not a backlink indexer, because it only submits URLs on hosts you have verified.",
			},
			{
				question: "Can any service guarantee Google indexing?",
				answer:
					"No. Google decides what to crawl and index. Official channels for Google are XML sitemaps, Search Console, and the Indexing API for JobPosting and livestream pages only.",
			},
		],
		checked: "2026-11-01",
	},
	{
		slug: "omega-indexer",
		competitor: "Omega Indexer",
		competitorUrl: "https://www.omegaindexer.com/",
		category: "Paid link indexing service",
		summary:
			"Omega Indexer is a long-running paid link indexing service, used mostly to get backlinks crawled, with credit-based pricing according to its website. IndexFast is built for your own sites instead: it reads your sitemaps, pushes new and changed URLs through official engine APIs, diagnoses indexing blockers, and exposes everything to AI agents over MCP.",
		rows: [
			{ label: "Type", indexfast: IF_TYPE, competitor: "Hosted paid service" },
			{ label: "Which URLs", indexfast: IF_SCOPE, competitor: "URLs you submit in campaigns, typically backlinks" },
			{ label: "Method", indexfast: "Documented engine APIs only: IndexNow, Bing Webmaster API, Yandex, Baidu, Search Console", competitor: "Not publicly documented on its website at the time we checked" },
			{ label: "Google", indexfast: IF_GOOGLE, competitor: "Marketed around getting links crawled and indexed" },
			{ label: "Monitoring", indexfast: "Sitemap sync, indexability checks (status, redirects, noindex, canonical), submission log", competitor: "Campaign reports" },
			{ label: "Agent and API access", indexfast: IF_AGENTS, competitor: "See its website for current API options" },
		],
		competitorPricing: "Paid, credit based. See its website for current prices",
		chooseCompetitor: ["Your goal is getting backlinks on other people's sites crawled. IndexFast only submits hosts you verify."],
		chooseIndexFast: [
			"Your goal is getting your own new and changed pages discovered.",
			"You want only official engine APIs and no grey-area techniques.",
			"You want indexing blockers (noindex, canonical, redirects, errors) found for you.",
			"You want an MCP server so an AI agent can run indexing work.",
		],
		faqs: [
			{
				question: "Does IndexFast index backlinks?",
				answer:
					"No. IndexFast only submits URLs on hosts whose ownership you proved by hosting the IndexNow key file. Submitting other people's URLs through official APIs is not allowed by those APIs.",
			},
		],
		checked: "2026-11-01",
	},
	{
		slug: "google-search-console",
		competitor: "Google Search Console",
		competitorUrl: "https://search.google.com/search-console/about",
		category: "Google's free webmaster tool",
		summary:
			"Google Search Console is Google's free tool for seeing how Google crawls and indexes your site; its Request indexing button works one URL at a time with a daily limit. IndexFast does not replace it: IndexFast connects to Search Console to inspect URLs and submit sitemaps through the official API, and also pushes your URLs to IndexNow, Bing, Yandex and Baidu.",
		rows: [
			{ label: "Type", indexfast: IF_TYPE, competitor: "Google's web dashboard and APIs" },
			{ label: "Engines", indexfast: IF_ENGINES, competitor: "Google only" },
			{ label: "Request indexing", indexfast: "Not offered for Google: no public API requests indexing for normal pages", competitor: "Manual, one URL at a time in URL Inspection, with a daily limit" },
			{ label: "URL Inspection", indexfast: "Automated through the URL Inspection API within Google's quota (2,000 a day per property); 100 a day on Free", competitor: "Manual in the dashboard, or the URL Inspection API (2,000 a day, 600 a minute per property)" },
			{ label: "Sitemaps", indexfast: "Monitors your sitemaps and submits them to Search Console once Google is connected (paid plans)", competitor: "Submit and view sitemap status" },
			{ label: "Agent and API access", indexfast: IF_AGENTS, competitor: "REST APIs with OAuth" },
		],
		competitorPricing: "Free",
		chooseCompetitor: [
			"You need Google's own data: the Pages report, performance and manual actions. Every site should have Search Console set up.",
		],
		chooseIndexFast: [
			"You want Bing, Yandex, Baidu and other IndexNow engines notified automatically too.",
			"You want URL inspection run for you on a schedule instead of one URL at a time.",
			"You want an AI agent to check index status and fix blockers through MCP.",
		],
		faqs: [
			{
				question: "Can IndexFast press Request indexing for me?",
				answer:
					"No. Google offers no public API that requests indexing for normal pages. The URL Inspection API only reads status. IndexFast uses it to report what Google sees and submits your sitemaps, which is the supported path.",
			},
			{
				question: "Do I still need Search Console if I use IndexFast?",
				answer:
					"Yes. Search Console is where Google reports coverage, performance and manual actions. IndexFast connects to it over OAuth and adds the other engines and automation on top.",
			},
		],
		checked: "2026-11-01",
	},
];

export function getComparisonBySlug(slug: string) {
	return comparisons.find((item) => item.slug === slug);
}

export function getToolBySlug(slug: string) {
	return tools.find((tool) => tool.slug === slug || tool.aliases?.includes(slug));
}

export function getBlogPostBySlug(slug: string) {
	return blogPosts.find((post) => post.slug === slug);
}
