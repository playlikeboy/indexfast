import { AUTOMATION_LIMITS } from "./constants";
import { normalizeHost } from "@/lib/url-utils";

export type ParsedSitemapUrl = {
	loc: string;
	lastmod: Date | null;
	changefreq: string | null;
	priority: string | null;
};

export type ParsedSitemap = {
	sitemaps: string[];
	urls: ParsedSitemapUrl[];
};

const entityMap: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

function decodeXml(value: string) {
	return value
		.trim()
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
		.replace(/&([a-z]+);/gi, (_, entity: string) => entityMap[entity.toLowerCase()] ?? `&${entity};`);
}

function readTag(block: string, tag: string) {
	const match = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "i").exec(block);
	return match ? decodeXml(match[1]) : null;
}

function readAttribute(tag: string, attribute: string) {
	const match = new RegExp(`${attribute}=["']([^"']+)["']`, "i").exec(tag);
	return match ? decodeXml(match[1]) : null;
}

function parseDate(value: string | null) {
	if (!value) {
		return null;
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeUrlOnHost(value: string | null, host: string) {
	if (!value) {
		return null;
	}

	try {
		const url = new URL(value);
		if ((url.protocol === "http:" || url.protocol === "https:") && normalizeHost(url.hostname) === host) {
			return url.toString();
		}
	} catch {
		return null;
	}

	return null;
}

export function parseSitemapXml(xml: string, host: string): ParsedSitemap {
	const sitemaps = new Set<string>();
	const urls = new Map<string, ParsedSitemapUrl>();

	for (const match of xml.matchAll(/<(?:[\w-]+:)?sitemap\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?sitemap>/gi)) {
		const loc = normalizeUrlOnHost(readTag(match[1], "loc"), host);
		if (loc) {
			sitemaps.add(loc);
		}
	}

	for (const match of xml.matchAll(/<(?:[\w-]+:)?url\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?url>/gi)) {
		const loc = normalizeUrlOnHost(readTag(match[1], "loc"), host);
		if (!loc) {
			continue;
		}

		urls.set(loc, {
			loc,
			lastmod: parseDate(readTag(match[1], "lastmod")),
			changefreq: readTag(match[1], "changefreq"),
			priority: readTag(match[1], "priority"),
		});
	}

	for (const match of xml.matchAll(/<(?:[\w-]+:)?item\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?item>/gi)) {
		const loc = normalizeUrlOnHost(readTag(match[1], "link"), host);
		if (!loc) {
			continue;
		}

		urls.set(loc, {
			loc,
			lastmod: parseDate(readTag(match[1], "pubDate")),
			changefreq: null,
			priority: null,
		});
	}

	for (const match of xml.matchAll(/<(?:[\w-]+:)?entry\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?entry>/gi)) {
		const linkTag = /<(?:[\w-]+:)?link\b[^>]*>/i.exec(match[1])?.[0] ?? "";
		const loc = normalizeUrlOnHost(readAttribute(linkTag, "href") || readTag(match[1], "id"), host);
		if (!loc) {
			continue;
		}

		urls.set(loc, {
			loc,
			lastmod: parseDate(readTag(match[1], "updated") || readTag(match[1], "published")),
			changefreq: null,
			priority: null,
		});
	}

	return { sitemaps: Array.from(sitemaps), urls: Array.from(urls.values()) };
}

import { safeFetchText } from "@/lib/url-utils";

async function fetchText(url: string, userAgent: string) {
	const res = await safeFetchText(url, { userAgent, timeoutMs: 10000 });
	if (res.status !== 200) {
		throw new Error(`${url} returned HTTP ${res.status}`);
	}
	return res.text;
}

async function fetchCandidateSource(url: string, host: string) {
	try {
		const res = await safeFetchText(url, {
			userAgent: "IndexFast Sitemap Discoverer/1.0",
			timeoutMs: 6000,
		});
		if (res.status !== 200) {
			return null;
		}

		if (!res.text.trim().startsWith("<")) {
			return null;
		}

		const parsed = parseSitemapXml(res.text, host);
		if (parsed.sitemaps.length === 0 && parsed.urls.length === 0) {
			return null;
		}

		return url;
	} catch {
		return null;
	}
}

export async function fetchSitemapTree(
	startUrl: string,
	host: string,
	maxUrls = AUTOMATION_LIMITS.maxUrlsPerSitemap,
) {
	const queue = [startUrl];
	const seenSitemaps = new Set<string>();
	const urlEntries = new Map<string, ParsedSitemapUrl>();

	while (queue.length > 0 && urlEntries.size < maxUrls) {
		const current = queue.shift();
		if (!current || seenSitemaps.has(current)) {
			continue;
		}

		seenSitemaps.add(current);
		const xml = await fetchText(current, "IndexFast Sitemap Crawler/1.0");
		const parsed = parseSitemapXml(xml, host);

		for (const sitemapUrl of parsed.sitemaps) {
			if (!seenSitemaps.has(sitemapUrl)) {
				queue.push(sitemapUrl);
			}
		}

		for (const entry of parsed.urls) {
			if (urlEntries.size >= maxUrls) {
				break;
			}

			urlEntries.set(entry.loc, entry);
		}
	}

	return {
		sitemapCount: seenSitemaps.size,
		urls: Array.from(urlEntries.values()),
		truncated: urlEntries.size >= maxUrls,
	};
}

export async function discoverSitemapUrls(host: string) {
	const discovered = new Set<string>();
	const candidates = new Set<string>();

	try {
		const robots = await fetchText(`https://${host}/robots.txt`, "IndexFast Sitemap Discoverer/1.0");
		for (const match of robots.matchAll(/^sitemap:\s*(\S+)/gim)) {
			const loc = normalizeUrlOnHost(match[1], host);
			if (loc) {
				candidates.add(loc);
			}
		}
	} catch {
		// robots.txt is optional; common sitemap paths below cover the usual fallback.
	}

	for (const path of [
		"/sitemap.xml",
		"/sitemap_index.xml",
		"/sitemap-index.xml",
		"/wp-sitemap.xml",
		"/post-sitemap.xml",
		"/page-sitemap.xml",
		"/category-sitemap.xml",
		"/product-sitemap.xml",
		"/news-sitemap.xml",
		"/image-sitemap.xml",
		"/video-sitemap.xml",
		"/sitemap/sitemap.xml",
		"/rss.xml",
		"/feed.xml",
		"/feeds.xml",
		"/atom.xml",
		"/rss",
		"/feed",
	]) {
		candidates.add(`https://${host}${path}`);
	}

	for (const candidate of candidates) {
		const validSource = await fetchCandidateSource(candidate, host);
		if (validSource) {
			discovered.add(validSource);
		}
	}

	return Array.from(discovered);
}
