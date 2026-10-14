"use server";

import { assertSafeExternalUrl, normalizeHost, safeFetchText } from "@/lib/url-utils";
import { parseSitemapXml } from "@/lib/automation/sitemaps";
import { evaluateUrlDiagnostics } from "@/lib/automation/diagnostics";

// 1. IndexNow Key Generator
export async function generateIndexNowKeyTool(domainInput: string) {
	const host = normalizeHost(domainInput);
	// Generate compliant 32-character hex key
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const key = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	const keyLocation = `https://${host}/${key}.txt`;

	return {
		success: true,
		host,
		key,
		keyLocation,
		fileContent: key,
		fileName: `${key}.txt`,
	};
}

// 2. llms.txt Generator
export async function generateLlmsTxtTool(data: {
	domain: string;
	title: string;
	description: string;
	keyPages?: string;
}) {
	const host = normalizeHost(data.domain);
	const title = data.title.trim() || host;
	const description = data.description.trim() || `Official documentation and information for ${host}`;

	const rawPages = (data.keyPages || "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	const links = rawPages.map((line) => {
		const parts = line.split(/[|,-]/).map((p) => p.trim());
		if (parts.length >= 2) {
			return `- [${parts[0]}](${parts[1]})`;
		}
		if (line.startsWith("http")) {
			return `- [Page](${line})`;
		}
		return `- [${line}](https://${host}/${line.replace(/^\//, "")})`;
	});

	const llmsTxt = `# ${title}

> ${description}

## Core Information
- [Home](https://${host}/): Main overview and core capabilities
${links.join("\n")}

## Optional
- [Full Documentation](https://${host}/llms-full.txt): Complete context for AI models
`;

	const llmsFullTxt = `# ${title} (Full Reference)

> ${description}

Generated for LLMs and AI Agents by IndexFast.
Website: https://${host}/

${links.map((link) => `### ${link}\nSummary and context available at this link.`).join("\n\n")}
`;

	return {
		success: true,
		host,
		llmsTxt,
		llmsFullTxt,
	};
}

// 3. HTTP Status Checker
export async function checkHttpStatusTool(inputUrl: string) {
	const startTime = Date.now();
	try {
		const res = await safeFetchText(inputUrl, {
			timeoutMs: 10000,
			userAgent: "IndexFast HttpStatusChecker/1.0",
		});
		const durationMs = Date.now() - startTime;

		const headers: Record<string, string> = {};
		for (const key of ["content-type", "server", "cache-control", "x-robots-tag", "location"]) {
			const val = res.headers.get(key);
			if (val) headers[key] = val;
		}

		return {
			success: true,
			url: inputUrl,
			finalUrl: res.finalUrl,
			status: res.status,
			durationMs,
			headers,
			isRedirect: res.finalUrl !== inputUrl,
		};
	} catch (err: unknown) {
		return {
			success: false,
			url: inputUrl,
			error: err instanceof Error ? err.message : "Failed to fetch URL",
		};
	}
}

// 4. Robots.txt Checker
export async function checkRobotsTxtTool(domainOrUrl: string) {
	let host: string;
	try {
		host = normalizeHost(domainOrUrl);
	} catch {
		throw new Error("Enter a valid domain or URL");
	}

	const robotsUrl = `https://${host}/robots.txt`;
	try {
		const res = await safeFetchText(robotsUrl, {
			timeoutMs: 8000,
			userAgent: "IndexFast RobotsChecker/1.0",
		});

		if (res.status === 404) {
			return {
				success: true,
				host,
				robotsUrl,
				status: 404,
				content: "",
				exists: false,
				message: "robots.txt not found (HTTP 404). All crawlers are allowed by default.",
				sitemaps: [],
				rulesCount: 0,
			};
		}

		const content = res.text;
		const sitemaps: string[] = [];
		let disallowCount = 0;
		let allowCount = 0;

		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (/^sitemap:\s*/i.test(trimmed)) {
				sitemaps.push(trimmed.replace(/^sitemap:\s*/i, "").trim());
			} else if (/^disallow:\s*/i.test(trimmed)) {
				disallowCount++;
			} else if (/^allow:\s*/i.test(trimmed)) {
				allowCount++;
			}
		}

		return {
			success: true,
			host,
			robotsUrl,
			status: res.status,
			content,
			exists: true,
			sitemaps,
			disallowCount,
			allowCount,
			message: `Found robots.txt with ${disallowCount} disallow and ${allowCount} allow rules, ${sitemaps.length} sitemaps declared.`,
		};
	} catch (err: unknown) {
		return {
			success: false,
			host,
			robotsUrl,
			error: err instanceof Error ? err.message : "Failed to fetch robots.txt",
		};
	}
}

// 5. Noindex Tag Checker
export async function checkNoindexTagTool(inputUrl: string) {
	const diag = await evaluateUrlDiagnostics(inputUrl);
	return {
		success: true,
		url: diag.url,
		httpStatus: diag.httpStatus,
		noindex: diag.noindex,
		noindexSource: diag.noindexSource,
		blockers: diag.blockers,
		title: diag.title,
		isIndexable: !diag.noindex && diag.httpStatus === 200,
	};
}

// 6. Canonical Checker
export async function checkCanonicalTool(inputUrl: string) {
	const diag = await evaluateUrlDiagnostics(inputUrl);
	return {
		success: true,
		url: diag.url,
		finalUrl: diag.finalUrl,
		canonical: diag.canonical,
		isCanonicalMatch: diag.isCanonicalMatch,
		httpStatus: diag.httpStatus,
		blockers: diag.blockers,
	};
}

// 7. AI Crawler Checker
export async function checkAiCrawlerTool(domainOrUrl: string) {
	const host = normalizeHost(domainOrUrl);
	const robotsUrl = `https://${host}/robots.txt`;

	const aiBots = [
		{ name: "GPTBot", owner: "OpenAI", description: "Crawls data for training OpenAI models" },
		{ name: "ChatGPT-User", owner: "OpenAI", description: "Browsing on behalf of ChatGPT users" },
		{ name: "ClaudeBot", owner: "Anthropic", description: "Crawls content for Anthropic / Claude" },
		{ name: "PerplexityBot", owner: "Perplexity AI", description: "Search indexer for Perplexity answer engine" },
		{ name: "Google-Extended", owner: "Google", description: "Controls Google Gemini & Vertex AI training access" },
		{ name: "Applebot-Extended", owner: "Apple", description: "Controls Apple Intelligence data training" },
		{ name: "CCBot", owner: "Common Crawl", description: "Open web crawler used by many LLM teams" },
		{ name: "Bytespider", owner: "ByteDance", description: "TikTok and ByteDance AI web crawler" },
	];

	try {
		const res = await safeFetchText(robotsUrl, { timeoutMs: 8000 });
		const content = res.text.toLowerCase();

		const results = aiBots.map((bot) => {
			const botLower = bot.name.toLowerCase();
			const hasExplicitBlock = content.includes(`user-agent: ${botLower}`) &&
				content.slice(content.indexOf(`user-agent: ${botLower}`)).match(/disallow:\s*\/\s*(?:\r?\n|$)/i);
			const hasGlobalBlock = content.includes("user-agent: *") &&
				content.slice(content.indexOf("user-agent: *")).match(/disallow:\s*\/\s*(?:\r?\n|$)/i);

			const isBlocked = Boolean(hasExplicitBlock || hasGlobalBlock);
			return {
				...bot,
				allowed: !isBlocked,
				ruleSource: hasExplicitBlock ? "explicit_bot_rule" : hasGlobalBlock ? "global_wildcard" : "allowed_by_default",
			};
		});

		return {
			success: true,
			host,
			robotsFound: res.status === 200,
			bots: results,
		};
	} catch {
		return {
			success: true,
			host,
			robotsFound: false,
			bots: aiBots.map((b) => ({ ...b, allowed: true, ruleSource: "no_robots_txt" })),
		};
	}
}

// 8. Sitemap URL Extractor
export async function extractSitemapUrlsTool(sitemapUrl: string) {
	const valid = assertSafeExternalUrl(sitemapUrl);
	const host = normalizeHost(valid.hostname);

	try {
		const res = await safeFetchText(sitemapUrl, {
			timeoutMs: 12000,
			userAgent: "IndexFast Sitemap Extractor/1.0",
		});
		const parsed = parseSitemapXml(res.text, host);

		return {
			success: true,
			sitemapUrl,
			host,
			sitemapIndexCount: parsed.sitemaps.length,
			childSitemaps: parsed.sitemaps,
			urlCount: parsed.urls.length,
			urls: parsed.urls.slice(0, 500).map((u) => ({
				loc: u.loc,
				lastmod: u.lastmod ? u.lastmod.toISOString() : null,
				changefreq: u.changefreq,
				priority: u.priority,
			})),
		};
	} catch (err: unknown) {
		return {
			success: false,
			sitemapUrl,
			error: err instanceof Error ? err.message : "Failed to extract sitemap",
		};
	}
}

// 9. Bing & IndexNow Submitter
export async function submitIndexNowTool(data: {
	host: string;
	key: string;
	keyLocation?: string;
	urlList: string;
}) {
	const host = normalizeHost(data.host);
	const key = data.key.trim();
	if (!key) throw new Error("IndexNow key is required");

	const rawUrls = data.urlList
		.split("\n")
		.map((u) => u.trim())
		.filter(Boolean);

	if (rawUrls.length === 0) throw new Error("Provide at least one URL to submit");
	if (rawUrls.length > 100) throw new Error("Maximum 100 URLs per submission batch");

	const cleanUrls: string[] = [];
	for (const raw of rawUrls) {
		const u = assertSafeExternalUrl(raw);
		if (normalizeHost(u.hostname) !== host) {
			throw new Error(`URL ${raw} does not match host ${host}`);
		}
		cleanUrls.push(u.toString());
	}

	const payload: Record<string, unknown> = {
		host,
		key,
		urlList: cleanUrls,
	};
	if (data.keyLocation) {
		payload.keyLocation = data.keyLocation.trim();
	}

	try {
		const res = await fetch("https://api.indexnow.org/indexnow", {
			method: "POST",
			headers: { "Content-Type": "application/json; charset=utf-8" },
			body: JSON.stringify(payload),
		});

		return {
			success: res.ok || res.status === 200 || res.status === 202,
			status: res.status,
			submittedCount: cleanUrls.length,
			urls: cleanUrls,
			message: res.status === 200 || res.status === 202
				? `Successfully submitted ${cleanUrls.length} URLs to IndexNow (Bing + Yandex).`
				: `IndexNow responded with HTTP ${res.status}. Key verification might be pending.`,
		};
	} catch (err: unknown) {
		return {
			success: false,
			status: 0,
			error: err instanceof Error ? err.message : "Failed to reach IndexNow API",
		};
	}
}

// 10. Google Index Checker
export async function checkGoogleIndexTool(inputUrl: string) {
	const diag = await evaluateUrlDiagnostics(inputUrl);

	const gscInspectUrl = `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(
		new URL(diag.url).origin,
	)}&id=${encodeURIComponent(diag.url)}`;

	return {
		success: true,
		url: diag.url,
		httpStatus: diag.httpStatus,
		diagnostics: diag,
		gscInspectUrl,
		truthNote:
			"Google does not provide a public real-time indexing API for arbitrary websites. The Google Indexing API is strictly restricted by Google to JobPosting and BroadcastEvent structured data. Use Google Search Console URL inspection or IndexFast technical diagnostics to find blockers.",
	};
}

// 11. Bulk Index Checker
export async function checkBulkIndexTool(urlText: string) {
	const rawUrls = urlText
		.split("\n")
		.map((u) => u.trim())
		.filter(Boolean);

	if (rawUrls.length === 0) throw new Error("Please enter at least one URL");
	if (rawUrls.length > 20) throw new Error("Bulk free check is limited to 20 URLs at a time");

	const results = await Promise.all(
		rawUrls.map(async (url) => {
			try {
				const diag = await evaluateUrlDiagnostics(url);
				return {
					url,
					httpStatus: diag.httpStatus,
					status: diag.status,
					noindex: diag.noindex,
					canonicalMatch: diag.isCanonicalMatch,
					blockers: diag.blockers,
				};
			} catch (e: unknown) {
				return {
					url,
					httpStatus: 0,
					status: "fail" as const,
					noindex: false,
					canonicalMatch: false,
					blockers: [e instanceof Error ? e.message : "Invalid URL"],
				};
			}
		}),
	);

	const passed = results.filter((r) => r.status === "pass").length;
	const failed = results.filter((r) => r.status === "fail").length;
	const warned = results.filter((r) => r.status === "warn").length;

	return {
		success: true,
		total: results.length,
		passed,
		failed,
		warned,
		results,
	};
}
