/**
 * Search engine indexing automation and URL submission specifications.
 * Comprehensive research catalog covering protocols, REST APIs, authentication, quotas,
 * restrictions, and setup steps across major search engines worldwide.
 */

export type SubmissionMethodType = "indexnow" | "direct_api" | "inspection_only" | "sitemap_only" | "syndicated";
export type AuthMethod = "indexnow_key" | "api_key" | "oauth2" | "token" | "none";
export type SupportLevel = "native" | "indexnow" | "syndicated" | "restricted" | "planned";

export type SearchEngineMethod = {
	name: string;
	type: SubmissionMethodType;
	endpoint: string;
	httpMethod: "GET" | "POST";
	authMethod: AuthMethod;
	batchSize: number;
	dailyQuota: string;
	latency: string;
	contentRestrictions: string;
	documentationUrl: string;
	curlExample: string;
	notes?: string;
};

export type SearchEngine = {
	id: string;
	name: string;
	company: string;
	marketShare: string;
	regions: string[];
	supportLevel: SupportLevel;
	supportedInIndexFast: boolean;
	summary: string;
	methods: SearchEngineMethod[];
	setupGuide: {
		title: string;
		steps: string[];
	};
	developerTips: string[];
};

export const SEARCH_ENGINES: SearchEngine[] = [
	{
		id: "bing",
		name: "Microsoft Bing",
		company: "Microsoft",
		marketShare: "Global: ~3.5% | US Desktop: ~13% | Powering Yahoo, DuckDuckGo, Ecosia",
		regions: ["Global", "North America", "Europe", "Asia-Pacific"],
		supportLevel: "native",
		supportedInIndexFast: true,
		summary:
			"Microsoft Bing provides both the open IndexNow protocol for instant push and a dedicated Webmaster API for direct quota-based batch submissions. Discovery on Bing also feeds DuckDuckGo, Yahoo Search, and Ecosia.",
		methods: [
			{
				name: "IndexNow Protocol",
				type: "indexnow",
				endpoint: "https://api.indexnow.org/indexnow",
				httpMethod: "POST",
				authMethod: "indexnow_key",
				batchSize: 10000,
				dailyQuota: "10,000+ URLs/day",
				latency: "Instant (minutes to crawl)",
				contentRestrictions: "None (any valid page hosted on the verified domain).",
				documentationUrl: "https://www.bing.com/indexnow/getstarted",
				curlExample: `curl -X POST "https://api.indexnow.org/indexnow" \\
  -H "Content-Type: application/json; charset=utf-8" \\
  -d '{
    "host": "example.com",
    "key": "your-indexnow-key",
    "keyLocation": "https://example.com/your-indexnow-key.txt",
    "urlList": [
      "https://example.com/new-page-1",
      "https://example.com/updated-page-2"
    ]
  }'`,
				notes: "Created jointly by Microsoft and Yandex. Pinging one IndexNow endpoint shares notifications across all participating search engines.",
			},
			{
				name: "Bing Webmaster API (SubmitUrlBatch)",
				type: "direct_api",
				endpoint: "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch?apikey={apiKey}",
				httpMethod: "POST",
				authMethod: "api_key",
				batchSize: 500,
				dailyQuota: "10,000 - 100,000 URLs/day (based on site authority)",
				latency: "Fast (direct push to Bing indexing queue)",
				contentRestrictions: "Site must be registered and verified in Bing Webmaster Tools.",
				documentationUrl: "https://learn.microsoft.com/en-us/bingwebmaster/getting-started/webmaster-api",
				curlExample: `curl -X POST "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch?apikey=YOUR_BING_API_KEY" \\
  -H "Content-Type: application/json; charset=utf-8" \\
  -d '{
    "siteUrl": "https://example.com",
    "urlList": [
      "https://example.com/page-1",
      "https://example.com/page-2"
    ]
  }'`,
				notes: "Quota can be queried via GetUrlSubmissionQuota endpoint. IndexFast supports automated submissions through both IndexNow and Bing Webmaster API.",
			},
		],
		setupGuide: {
			title: "How to connect Bing in IndexFast",
			steps: [
				"Add your site to IndexFast by entering your domain.",
				"Deploy the generated IndexNow key file to your root (e.g. /public/<key>.txt) and click Verify.",
				"In Bing Webmaster Tools (bing.com/webmasters), verify your domain ownership.",
				"Go to Bing Webmaster Tools > Settings (gear icon) > API Access > API Key, copy your key.",
				"Paste the API key into your IndexFast site Settings under 'Bing Webmaster API' with auto-submit enabled.",
			],
		},
		developerTips: [
			"Using both IndexNow and Bing Webmaster API provides maximum delivery redundancy.",
			"Bing Webmaster API requires the exact protocol and host (including or excluding www) matching your Bing Webmaster property.",
			"Bing powers DuckDuckGo, Yahoo, and Ecosia, so submitting to Bing covers multiple search engines in one call.",
		],
	},
	{
		id: "google",
		name: "Google",
		company: "Alphabet",
		marketShare: "Global: ~90% | Mobile: ~94%",
		regions: ["Global"],
		supportLevel: "restricted",
		supportedInIndexFast: true,
		summary:
			"Google does NOT offer an open URL submission API for standard content. The Google Indexing API is strictly restricted by policy to JobPosting and BroadcastEvent (live video) schema. Google deprecated sitemap pinging in December 2023. The URL Inspection API is read-only.",
		methods: [
			{
				name: "Google Indexing API (Strictly Gated)",
				type: "direct_api",
				endpoint: "https://indexing.googleapis.com/v3/urlNotifications:publish",
				httpMethod: "POST",
				authMethod: "oauth2",
				batchSize: 100,
				dailyQuota: "200 quota units/day default (JobPosting/BroadcastEvent only)",
				latency: "Fast (crawls within minutes for eligible types)",
				contentRestrictions: "CRITICAL: Strictly permitted ONLY for pages containing JobPosting or BroadcastEvent structured data. Submitting standard pages violates Google policies.",
				documentationUrl: "https://developers.google.com/search/apis/indexing-api/v3/quickstart",
				curlExample: `curl -X POST "https://indexing.googleapis.com/v3/urlNotifications:publish" \\
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://example.com/jobs/senior-engineer",
    "type": "URL_UPDATED"
  }'`,
				notes: "IndexFast enforces safe guardrails for Google Indexing API to protect domains from API quota revocation or algorithmic penalties.",
			},
			{
				name: "Google Search Console URL Inspection API",
				type: "inspection_only",
				endpoint: "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
				httpMethod: "POST",
				authMethod: "oauth2",
				batchSize: 1,
				dailyQuota: "2,000 requests/day per Search Console property",
				latency: "Read-only inspection (does not trigger crawling)",
				contentRestrictions: "None. Provides indexing status, canonical URL, and mobile usability.",
				documentationUrl: "https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect",
				curlExample: `curl -X POST "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect" \\
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "inspectionUrl": "https://example.com/about",
    "siteUrl": "sc-domain:example.com"
  }'`,
				notes: "Useful for checking whether Google has indexed a URL and verifying user-declared canonical tags.",
			},
		],
		setupGuide: {
			title: "How to handle Google Discovery with IndexFast",
			steps: [
				"Ensure XML sitemaps are referenced in robots.txt and submitted in Google Search Console.",
				"Ensure pages return 200 HTTP status, valid canonical link tags, and proper schema markup.",
				"If your site publishes job listings or livestream broadcasts, you can connect a GCP Service Account with Google Indexing API enabled.",
				"For general pages, discovery occurs organically via sitemaps and inbound web links.",
			],
		},
		developerTips: [
			"Beware of services claiming 'instant Google indexing for all pages' via the Indexing API; Google actively revokes quotas for abusive usage.",
			"Google permanently turned off 'google.com/ping?sitemap=...' in December 2023. Keep sitemaps updated on your server instead.",
			"Googlebot crawls sitemaps frequently when lastmod dates are updated accurately.",
		],
	},
	{
		id: "yandex",
		name: "Yandex",
		company: "Yandex",
		marketShare: "Russia & CIS: ~65% | Central Asia: ~30-50%",
		regions: ["Russia", "Eastern Europe", "Central Asia"],
		supportLevel: "indexnow",
		supportedInIndexFast: true,
		summary:
			"Yandex is a co-founder and primary operator of the IndexNow protocol. Submissions sent via IndexNow to api.indexnow.org or yandex.com/indexnow are directly ingested by YandexBot. Yandex also provides a Webmaster Recrawl API.",
		methods: [
			{
				name: "IndexNow (Recommended)",
				type: "indexnow",
				endpoint: "https://yandex.com/indexnow",
				httpMethod: "POST",
				authMethod: "indexnow_key",
				batchSize: 10000,
				dailyQuota: "10,000 URLs/day",
				latency: "Very fast (crawls within minutes)",
				contentRestrictions: "None.",
				documentationUrl: "https://yandex.com/support/webmaster/indexnow/indexnow.html",
				curlExample: `curl -X POST "https://yandex.com/indexnow" \\
  -H "Content-Type: application/json; charset=utf-8" \\
  -d '{
    "host": "example.com",
    "key": "your-indexnow-key",
    "keyLocation": "https://example.com/your-indexnow-key.txt",
    "urlList": ["https://example.com/page-1"]
  }'`,
				notes: "Standard IndexNow endpoint; submissions through IndexFast reach Yandex automatically.",
			},
			{
				name: "Yandex.Webmaster API (Recrawl Queue)",
				type: "direct_api",
				endpoint: "https://api.webmaster.yandex.net/v4/user/{userId}/hosts/{hostId}/recrawl/queue",
				httpMethod: "POST",
				authMethod: "oauth2",
				batchSize: 1,
				dailyQuota: "10 - 100 URLs/day (limited based on SQI score)",
				latency: "Within 24 hours",
				contentRestrictions: "Requires Yandex OAuth 2.0 app and low quota.",
				documentationUrl: "https://yandex.com/dev/webmaster/doc/dg/reference/hosts-recrawl-post.html",
				curlExample: `curl -X POST "https://api.webmaster.yandex.net/v4/user/USER_ID/hosts/HOST_ID/recrawl/queue" \\
  -H "Authorization: OAuth YOUR_OAUTH_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/page-1"}'`,
				notes: "Due to small daily quotas (often just 20 URLs/day), IndexNow is much better suited for automated indexing.",
			},
		],
		setupGuide: {
			title: "How to connect Yandex in IndexFast",
			steps: [
				"Add your site in IndexFast and verify your IndexNow key.",
				"All verified IndexFast sites automatically submit URLs to Yandex through the federated IndexNow protocol.",
				"Optionally add your site in Yandex.Webmaster (webmaster.yandex.com) to track Russian and CIS search analytics.",
			],
		},
		developerTips: [
			"IndexNow is the official recommendation by Yandex for rapid content indexing.",
			"Yandex strongly penalizes slow mobile pages; ensure mobile TTFB is under 400ms.",
		],
	},
	{
		id: "baidu",
		name: "Baidu",
		company: "Baidu, Inc.",
		marketShare: "China: ~65-70% | Global Chinese diaspora",
		regions: ["China", "East Asia"],
		supportLevel: "planned",
		supportedInIndexFast: false,
		summary:
			"Baidu operates the 'Active Push' (主动推送) API through the Baidu Search Resource Platform (百度搜索资源平台). It allows webmasters to submit up to 50,000 URLs daily via a direct HTTP POST with a site push token.",
		methods: [
			{
				name: "Baidu Active Push API (主动推送)",
				type: "direct_api",
				endpoint: "http://data.zz.baidu.com/urls?site={domain}&token={token}",
				httpMethod: "POST",
				authMethod: "token",
				batchSize: 2000,
				dailyQuota: "Up to 50,000 URLs/day (level dependent)",
				latency: "Fast (fastest crawl speed for Baiduspider)",
				contentRestrictions: "Only URLs belonging to the registered domain. Requires ICP license for mainland Chinese hosting.",
				documentationUrl: "https://ziyuan.baidu.com/college/courseinfo?id=267&page=2#h2_article_title14",
				curlExample: `curl -H 'Content-Type:text/plain' --data-binary $'https://example.com/page-1\\nhttps://example.com/page-2' \\
  "http://data.zz.baidu.com/urls?site=https://example.com&token=YOUR_BAIDU_TOKEN"`,
				notes: "Returns JSON response: {\"remain\":49990,\"success\":10}. Baidu does not currently participate in IndexNow.",
			},
		],
		setupGuide: {
			title: "How to set up Baidu Active Push",
			steps: [
				"Register on Baidu Search Resource Platform (ziyuan.baidu.com).",
				"Add and verify your website domain via HTML file or DNS TXT record.",
				"Go to Resource Submission (资源提交) > Ordinary Ingestion (普通收录) > API Submission (API提交).",
				"Copy your site push token (16-character alphanumeric string).",
				"Execute direct HTTP POST with plain text newline-delimited URLs to the push endpoint.",
			],
		},
		developerTips: [
			"Baidu does not support IndexNow; direct HTTP POST to their active push endpoint is mandatory for real-time discovery.",
			"Baiduspider prioritizes sites with Chinese mainland ICP filing and fast domestic CDN routes.",
			"Use GB2312 or UTF-8 character encoding cleanly to avoid crawl parsing errors on Baidu.",
		],
	},
	{
		id: "naver",
		name: "Naver",
		company: "Naver Corporation",
		marketShare: "South Korea: ~20-30%",
		regions: ["South Korea", "East Asia"],
		supportLevel: "indexnow",
		supportedInIndexFast: true,
		summary:
			"Naver is South Korea's premier search engine and portal. In 2022, Naver Search Advisor officially partnered with IndexNow to enable instant notification and crawling of new and updated Korean web pages.",
		methods: [
			{
				name: "IndexNow (Federated Partner)",
				type: "indexnow",
				endpoint: "https://api.indexnow.org/indexnow",
				httpMethod: "POST",
				authMethod: "indexnow_key",
				batchSize: 10000,
				dailyQuota: "10,000 URLs/day",
				latency: "Fast (hours to 1 day)",
				contentRestrictions: "Korean language or international web pages.",
				documentationUrl: "https://searchadvisor.naver.com/guide/seo-basic-indexnow",
				curlExample: `curl -X POST "https://api.indexnow.org/indexnow" \\
  -H "Content-Type: application/json; charset=utf-8" \\
  -d '{
    "host": "example.com",
    "key": "your-indexnow-key",
    "keyLocation": "https://example.com/your-indexnow-key.txt",
    "urlList": ["https://example.com/ko/new-post"]
  }'`,
				notes: "Naver receives notifications from the shared IndexNow pool automatically.",
			},
		],
		setupGuide: {
			title: "How to optimize for Naver with IndexFast",
			steps: [
				"Enable IndexFast for your site; IndexNow automatically broadcasts to Naver.",
				"Register your domain in Naver Search Advisor (searchadvisor.naver.com).",
				"Submit your sitemap URL in Naver Search Advisor under Site Collection > Sitemap.",
			],
		},
		developerTips: [
			"Naver places high emphasis on Open Graph metadata (og:title, og:image, og:description) and clean H1 structure.",
			"Include hreflang tags for 'ko-KR' if targeting Korean users.",
		],
	},
	{
		id: "seznam",
		name: "Seznam.cz",
		company: "Seznam.cz, a.s.",
		marketShare: "Czech Republic: ~10-15%",
		regions: ["Czech Republic", "Central Europe"],
		supportLevel: "indexnow",
		supportedInIndexFast: true,
		summary:
			"Seznam.cz is an independent European search engine in the Czech Republic. Seznam officially integrated with IndexNow in 2022 to provide real-time discovery for Czech and European websites.",
		methods: [
			{
				name: "IndexNow (Official Partner)",
				type: "indexnow",
				endpoint: "https://indexnow.seznam.cz/indexnow",
				httpMethod: "POST",
				authMethod: "indexnow_key",
				batchSize: 10000,
				dailyQuota: "10,000 URLs/day",
				latency: "Within hours",
				contentRestrictions: "None.",
				documentationUrl: "https://napoveda.seznam.cz/cz/webmaster/indexnow/",
				curlExample: `curl -X POST "https://indexnow.seznam.cz/indexnow" \\
  -H "Content-Type: application/json; charset=utf-8" \\
  -d '{
    "host": "example.com",
    "key": "your-indexnow-key",
    "keyLocation": "https://example.com/your-indexnow-key.txt",
    "urlList": ["https://example.com/cz/stranka"]
  }'`,
				notes: "Submissions to api.indexnow.org or indexnow.seznam.cz are shared with SeznamBot.",
			},
		],
		setupGuide: {
			title: "How to connect Seznam in IndexFast",
			steps: [
				"IndexFast sites with verified IndexNow keys automatically notify SeznamBot.",
				"Register in Seznam Webmaster (webmaster.seznam.cz) to monitor crawl health in the Czech market.",
			],
		},
		developerTips: [
			"SeznamBot heavily values schema.org microdata and standard HTML sitemaps.",
		],
	},
	{
		id: "syndicated",
		name: "DuckDuckGo, Yahoo & Ecosia",
		company: "Syndicated Search Engines",
		marketShare: "Combined Global: ~5% | Privacy-focused users",
		regions: ["Global", "Privacy-conscious audience"],
		supportLevel: "syndicated",
		supportedInIndexFast: true,
		summary:
			"DuckDuckGo, Yahoo Search, and Ecosia do not operate separate large-scale web crawlers; their search indexes are primarily powered by Microsoft Bing. Pushing URLs to Bing via IndexNow or the Bing Webmaster API immediately makes content discoverable across these engines.",
		methods: [
			{
				name: "Syndicated Discovery via Bing & IndexNow",
				type: "syndicated",
				endpoint: "https://api.indexnow.org/indexnow",
				httpMethod: "POST",
				authMethod: "indexnow_key",
				batchSize: 10000,
				dailyQuota: "Covered by Bing / IndexNow quota",
				latency: "Indexed when Bing updates its index",
				contentRestrictions: "Inherits Bing policies.",
				documentationUrl: "https://help.duckduckgo.com/duckduckgo-help-pages/results/sources/",
				curlExample: `# Submitting to IndexNow or Bing automatically covers DuckDuckGo, Yahoo, and Ecosia:
curl -X POST "https://api.indexnow.org/indexnow" \\
  -H "Content-Type: application/json" \\
  -d '{"host": "example.com", "key": "KEY", "urlList": ["https://example.com/page"]}'`,
				notes: "No separate API keys or registration required. Bing is the underlying data provider.",
			},
		],
		setupGuide: {
			title: "How to reach DuckDuckGo and Yahoo",
			steps: [
				"Enable IndexFast for your domain.",
				"Verify your IndexNow key and optionally configure your Bing Webmaster API key.",
				"Once Bing indexes your URLs, they appear automatically in DuckDuckGo and Yahoo search results.",
			],
		},
		developerTips: [
			"DuckDuckGo uses Wikipedia, Apple Maps, and Bing index results. Clean structured data and fast SSL are critical.",
		],
	},
];

export function getAllSearchEngines(): SearchEngine[] {
	return SEARCH_ENGINES;
}

export function getSearchEngineById(id: string): SearchEngine | undefined {
	return SEARCH_ENGINES.find((engine) => engine.id.toLowerCase() === id.toLowerCase());
}

export function getSupportedSearchEngines(): SearchEngine[] {
	return SEARCH_ENGINES.filter((engine) => engine.supportedInIndexFast);
}
