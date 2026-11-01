"use server";

/*
 * Server actions behind the free, no-signup SEO tools at /tools/*. Every action returns
 * `{ success: true, ... }` or `{ success: false, error }` and never throws: Next hides thrown
 * messages in production, so a throw would show the visitor a generic error page instead of
 * what went wrong. Every fetch goes through safeFetchText (SSRF guard, timeout, byte cap) and
 * reads only as many bytes as the tool needs, because these run on a 128 MB Worker for anyone.
 */

import { assertSafeExternalUrl, normalizeHost, safeFetchText } from "@/lib/url-utils";
import { parseSitemapXml } from "@/lib/automation/sitemaps";
import { evaluateUrlDiagnostics } from "@/lib/automation/diagnostics";
import { isPathAllowed, parseRobotsGroups, rulesForAgent } from "./robots-rules";

type ToolFailure = { success: false; error: string };
type ToolResult<T> = ({ success: true } & T) | ToolFailure;

// Status and robots tools only need headers or a small text file, never a 5 MB body.
const SMALL_BODY_BYTES = 64 * 1024;
const BULK_MAX_URLS = 20;
const BULK_CONCURRENCY = 4;
const BULK_DEADLINE_MS = 25_000;
const INDEXNOW_MAX_URLS = 100;
const INDEXNOW_KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

async function guard<T>(fallback: string, run: () => Promise<T>): Promise<ToolResult<T>> {
	try {
		return { success: true, ...(await run()) };
	} catch (err: unknown) {
		return {
			success: false,
			error: err instanceof Error && err.message ? err.message : fallback,
		};
	}
}

function hostFrom(input: string) {
	try {
		return normalizeHost(input);
	} catch {
		throw new Error("Enter a valid public domain or URL");
	}
}

function splitLines(text: string) {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

// 1. IndexNow Key Generator
export async function generateIndexNowKeyTool(domainInput: string) {
	return guard("Could not generate a key", async () => {
		const host = hostFrom(domainInput);
		// 32 hex characters: inside IndexNow's 8 to 128 character key rule.
		const bytes = crypto.getRandomValues(new Uint8Array(16));
		const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
		return {
			host,
			key,
			keyLocation: `https://${host}/${key}.txt`,
			fileName: `${key}.txt`,
		};
	});
}

// 2. llms.txt Generator
export async function generateLlmsTxtTool(data: { domain: string; title: string; description: string }) {
	return guard("Could not generate llms.txt", async () => {
		const host = hostFrom(data.domain);
		// Collapse whitespace: the description comes from a textarea, and a line break would end the
		// "> " blockquote (or the "# " heading) and leave the rest as stray Markdown.
		const title = data.title.replace(/\s+/g, " ").trim() || host;
		const description = data.description.replace(/\s+/g, " ").trim() || `Official documentation and information for ${host}`;
		const llmsTxt = `# ${title}

> ${description}

## Core Information
- [Home](https://${host}/): Main overview and core capabilities
`;
		return { host, llmsTxt };
	});
}

// 3. HTTP Status Checker
export async function checkHttpStatusTool(inputUrl: string) {
	return guard("Failed to fetch URL", async () => {
		const requested = assertSafeExternalUrl(inputUrl).toString();
		const startTime = Date.now();
		// truncate: the status and headers are the answer, the body is irrelevant past the cap.
		const res = await safeFetchText(requested, {
			timeoutMs: 10000,
			userAgent: "IndexFast HttpStatusChecker/1.0",
			maxBytes: SMALL_BODY_BYTES,
			truncate: true,
		});
		const headers: Record<string, string> = {};
		for (const key of ["content-type", "server", "cache-control", "x-robots-tag", "location"]) {
			const val = res.headers.get(key);
			if (val) headers[key] = val;
		}
		return {
			url: requested,
			finalUrl: res.finalUrl,
			status: res.status,
			durationMs: Date.now() - startTime,
			headers,
			isRedirect: res.finalUrl !== requested,
		};
	});
}

async function fetchRobotsTxt(host: string, userAgent: string) {
	const robotsUrl = `https://${host}/robots.txt`;
	const res = await safeFetchText(robotsUrl, {
		timeoutMs: 8000,
		userAgent,
		maxBytes: SMALL_BODY_BYTES,
		truncate: true,
	});
	// RFC 9309: a 4xx robots.txt means no rules; a 5xx means the rules are unknown, so we say so.
	if (res.status >= 500) throw new Error(`robots.txt returned HTTP ${res.status}; crawl rules could not be read`);
	return {
		robotsUrl,
		status: res.status,
		found: res.status >= 200 && res.status < 300,
		text: res.text,
	};
}

// 4. Robots.txt Checker
export async function checkRobotsTxtTool(domainOrUrl: string) {
	return guard("Failed to fetch robots.txt", async () => {
		const host = hostFrom(domainOrUrl);
		const robots = await fetchRobotsTxt(host, "IndexFast RobotsChecker/1.0");
		if (!robots.found) {
			return {
				host,
				robotsUrl: robots.robotsUrl,
				status: robots.status,
				exists: false,
				content: "",
				sitemaps: [] as string[],
				disallowCount: 0,
				allowCount: 0,
				message: `No robots.txt (HTTP ${robots.status}). Crawlers treat every path as allowed.`,
			};
		}

		const sitemaps: string[] = [];
		let disallowCount = 0;
		let allowCount = 0;
		for (const line of robots.text.split("\n")) {
			const trimmed = line.trim();
			if (/^sitemap:\s*/i.test(trimmed)) sitemaps.push(trimmed.replace(/^sitemap:\s*/i, "").trim());
			else if (/^disallow:\s*\S/i.test(trimmed)) disallowCount++;
			else if (/^allow:\s*\S/i.test(trimmed)) allowCount++;
		}
		return {
			host,
			robotsUrl: robots.robotsUrl,
			status: robots.status,
			exists: true,
			content: robots.text,
			sitemaps,
			disallowCount,
			allowCount,
			message: `${disallowCount} disallow and ${allowCount} allow rules, ${sitemaps.length} sitemaps declared.`,
		};
	});
}

// 5. Noindex Tag Checker
export async function checkNoindexTagTool(inputUrl: string) {
	return guard("Failed to check the URL", async () => {
		const diag = await evaluateUrlDiagnostics(inputUrl);
		return {
			url: diag.url,
			httpStatus: diag.httpStatus,
			noindex: diag.noindex,
			noindexSource: diag.noindexSource,
			blockers: diag.blockers,
			title: diag.title,
			robotsBlocked: diag.robotsBlocked,
			isIndexable: !diag.noindex && !diag.robotsBlocked && diag.httpStatus === 200,
		};
	});
}

// 6. Canonical Checker
export async function checkCanonicalTool(inputUrl: string) {
	return guard("Failed to check the URL", async () => {
		const diag = await evaluateUrlDiagnostics(inputUrl);
		return {
			url: diag.url,
			finalUrl: diag.finalUrl,
			canonical: diag.canonical,
			isCanonicalMatch: diag.isCanonicalMatch,
			httpStatus: diag.httpStatus,
			blockers: diag.blockers,
		};
	});
}

const AI_BOTS = [
	{
		name: "GPTBot",
		owner: "OpenAI",
		description: "Crawls data for training OpenAI models",
	},
	{
		name: "ChatGPT-User",
		owner: "OpenAI",
		description: "Browsing on behalf of ChatGPT users",
	},
	{
		name: "ClaudeBot",
		owner: "Anthropic",
		description: "Crawls content for Anthropic / Claude",
	},
	{
		name: "PerplexityBot",
		owner: "Perplexity AI",
		description: "Search indexer for Perplexity answer engine",
	},
	{
		name: "Google-Extended",
		owner: "Google",
		description: "Controls Google Gemini & Vertex AI training access",
	},
	{
		name: "Applebot-Extended",
		owner: "Apple",
		description: "Controls Apple Intelligence data training",
	},
	{
		name: "CCBot",
		owner: "Common Crawl",
		description: "Open web crawler used by many LLM teams",
	},
	{
		name: "Bytespider",
		owner: "ByteDance",
		description: "TikTok and ByteDance AI web crawler",
	},
];

// 7. AI Crawler Checker
export async function checkAiCrawlerTool(domainOrUrl: string) {
	return guard("Failed to fetch robots.txt", async () => {
		const host = hostFrom(domainOrUrl);
		// A fetch error is reported as an error, never as "allowed": we do not know the rules.
		const robots = await fetchRobotsTxt(host, "IndexFast AiCrawlerChecker/1.0");
		const groups = robots.found ? parseRobotsGroups(robots.text) : [];
		const bots = AI_BOTS.map((bot) => {
			const { rules, match } = rulesForAgent(groups, bot.name);
			return {
				...bot,
				// "Allowed" means the site root may be crawled; partial Disallow paths do not block the bot.
				allowed: isPathAllowed(rules, "/"),
				ruleSource: robots.found ? match : ("no_robots_txt" as const),
			};
		});
		return { host, robotsFound: robots.found, bots };
	});
}

// 8. Sitemap URL Extractor
export async function extractSitemapUrlsTool(sitemapUrl: string) {
	return guard("Failed to extract sitemap", async () => {
		const valid = assertSafeExternalUrl(sitemapUrl);
		const host = normalizeHost(valid.hostname);
		const res = await safeFetchText(valid.toString(), {
			timeoutMs: 12000,
			userAgent: "IndexFast Sitemap Extractor/1.0",
			decompressGzip: true,
		});
		// A 404 page or a login wall parses as "0 URLs"; that is a failure, not an empty sitemap.
		if (res.status !== 200) throw new Error(`Sitemap returned HTTP ${res.status}`);
		const parsed = parseSitemapXml(res.text, host);
		return {
			sitemapUrl: valid.toString(),
			host,
			childSitemaps: parsed.sitemaps,
			urlCount: parsed.urls.length,
			urls: parsed.urls.slice(0, 500).map((u) => ({
				loc: u.loc,
				lastmod: u.lastmod ? u.lastmod.toISOString() : null,
				changefreq: u.changefreq,
				priority: u.priority,
			})),
		};
	});
}

const INDEXNOW_STATUS_MEANING: Record<number, string> = {
	400: "bad request, check the URL list",
	403: "the key was not found at the key file URL",
	422: "the URLs do not belong to the host, or the key does not match its file",
	429: "too many requests, try again later",
};

// 9. Bing & IndexNow Submitter
export async function submitIndexNowTool(data: { host: string; key: string; keyLocation?: string; urlList: string }) {
	return guard("Failed to reach the IndexNow API", async () => {
		const host = hostFrom(data.host);
		const key = data.key.trim();
		if (!INDEXNOW_KEY_PATTERN.test(key)) {
			throw new Error("The key must be 8 to 128 characters: letters, numbers and dashes only");
		}

		// The key file must sit on the submitted host, or engines cannot tie the key to the site.
		const keyLocation = data.keyLocation?.trim() || `https://${host}/${key}.txt`;
		const keyUrl = assertSafeExternalUrl(keyLocation);
		if (normalizeHost(keyUrl.hostname) !== host) throw new Error(`The key file must be on ${host}`);

		const rawUrls = [...new Set(splitLines(data.urlList))];
		if (rawUrls.length === 0) throw new Error("Provide at least one URL to submit");
		if (rawUrls.length > INDEXNOW_MAX_URLS) throw new Error(`Maximum ${INDEXNOW_MAX_URLS} URLs per submission`);
		const urls = rawUrls.map((raw) => {
			const u = assertSafeExternalUrl(raw);
			if (normalizeHost(u.hostname) !== host) throw new Error(`${raw} is not on ${host}`);
			return u.toString();
		});

		const res = await fetch("https://api.indexnow.org/indexnow", {
			method: "POST",
			headers: { "Content-Type": "application/json; charset=utf-8" },
			body: JSON.stringify({
				host,
				key,
				keyLocation: keyUrl.toString(),
				urlList: urls,
			}),
			signal: AbortSignal.timeout(10000),
		});
		await res.body?.cancel().catch(() => undefined);
		if (res.status !== 200 && res.status !== 202) {
			const meaning = INDEXNOW_STATUS_MEANING[res.status] ?? "the submission was not accepted";
			throw new Error(`IndexNow answered HTTP ${res.status}: ${meaning}`);
		}
		return {
			status: res.status,
			keyLocation: keyUrl.toString(),
			submittedCount: urls.length,
			urls,
			message:
				res.status === 200 ? `IndexNow accepted ${urls.length} URLs.` : `IndexNow received ${urls.length} URLs; key validation is pending.`,
		};
	});
}

// 10. Google Index Checker
export async function checkGoogleIndexTool(inputUrl: string) {
	return guard("Failed to check the URL", async () => {
		const diag = await evaluateUrlDiagnostics(inputUrl);
		const gscInspectUrl = `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(
			new URL(diag.url).origin,
		)}&id=${encodeURIComponent(diag.url)}`;
		return {
			url: diag.url,
			httpStatus: diag.httpStatus,
			noindex: diag.noindex,
			noindexSource: diag.noindexSource,
			canonical: diag.canonical,
			isCanonicalMatch: diag.isCanonicalMatch,
			robotsBlocked: diag.robotsBlocked,
			isIndexable: !diag.noindex && !diag.robotsBlocked && diag.httpStatus === 200,
			blockers: diag.blockers,
			gscInspectUrl,
			truthNote:
				"Google does not offer a public real-time index lookup for arbitrary sites, and its Indexing API is limited to JobPosting and BroadcastEvent pages. Confirm index status with URL Inspection in Search Console.",
		};
	});
}

type BulkRow = {
	url: string;
	httpStatus: number;
	// skipped: never fetched before the deadline, so it says nothing about the page itself.
	status: "pass" | "warn" | "fail" | "skipped";
	noindex: boolean;
	canonicalMatch: boolean;
	blockers: string[];
};

function failedRow(url: string, reason: string, status: "fail" | "skipped" = "fail"): BulkRow {
	return {
		url,
		httpStatus: 0,
		status,
		noindex: false,
		canonicalMatch: false,
		blockers: [reason],
	};
}

// 11. Bulk Index Checker
export async function checkBulkIndexTool(urlText: string) {
	return guard("Bulk check failed", async () => {
		const urls = [...new Set(splitLines(urlText))];
		if (urls.length === 0) throw new Error("Enter at least one URL");
		if (urls.length > BULK_MAX_URLS) throw new Error(`The free bulk check takes up to ${BULK_MAX_URLS} URLs at a time`);

		// Four at a time keeps one visitor from opening 20 sockets; the deadline bounds the whole
		// request so a few slow hosts cannot hold the Worker open.
		const rows: Array<BulkRow | null> = urls.map(() => null);
		let next = 0;
		const worker = async () => {
			while (next < urls.length) {
				const i = next++;
				try {
					const diag = await evaluateUrlDiagnostics(urls[i]);
					rows[i] = {
						url: urls[i],
						httpStatus: diag.httpStatus,
						status: diag.status,
						noindex: diag.noindex,
						canonicalMatch: diag.isCanonicalMatch,
						blockers: diag.blockers,
					};
				} catch (e: unknown) {
					rows[i] = failedRow(urls[i], e instanceof Error ? e.message : "Invalid URL");
				}
			}
		};
		let timer: ReturnType<typeof setTimeout> | undefined;
		const deadline = new Promise<void>((resolve) => {
			timer = setTimeout(resolve, BULK_DEADLINE_MS);
		});
		await Promise.race([Promise.all(Array.from({ length: BULK_CONCURRENCY }, worker)), deadline]);
		clearTimeout(timer);
		next = urls.length; // stop workers picking up more after the deadline

		const results = rows.map((row, i) => row ?? failedRow(urls[i], "Not checked: the overall time limit was reached", "skipped"));
		return {
			total: results.length,
			passed: results.filter((r) => r.status === "pass").length,
			warned: results.filter((r) => r.status === "warn").length,
			failed: results.filter((r) => r.status === "fail").length,
			skipped: results.filter((r) => r.status === "skipped").length,
			results,
		};
	});
}
