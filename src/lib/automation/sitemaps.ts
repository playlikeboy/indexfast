/**
 * Sitemap parsing, crawling and discovery. Pure network + parsing, no DB, so it is unit
 * tested directly. Every URL leaving this module is canonicalized and filtered to the site's
 * exact host, which is what makes downstream dedup and IndexNow host checks reliable.
 */
import { AUTOMATION_LIMITS } from "./constants";
import { canonicalizeUrl, normalizeHost } from "@/lib/url-utils";

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
			return canonicalizeUrl(url);
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

// Sitemaps can legitimately be large (50k URLs is ~10MB). The cap protects Worker memory.
const MAX_SITEMAP_BYTES = 15 * 1024 * 1024;
const MAX_SITEMAP_FILES = 100;

async function fetchText(url: string, userAgent: string) {
	const res = await safeFetchText(url, { userAgent, timeoutMs: 15000, maxBytes: MAX_SITEMAP_BYTES });
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
			maxBytes: MAX_SITEMAP_BYTES,
		});
		if (res.status !== 200 || !res.text.trim().startsWith("<")) {
			return null;
		}

		const parsed = parseSitemapXml(res.text, host);
		if (parsed.sitemaps.length === 0 && parsed.urls.length === 0) {
			return null;
		}

		return { url, parsed };
	} catch {
		return null;
	}
}

/**
 * Breadth-first walk through sitemap indexes. Returns deduplicated URL entries (keyed by the
 * canonical loc produced in parseSitemapXml), so the same page listed in two child sitemaps
 * is only ingested once.
 */
export async function fetchSitemapTree(
	startUrl: string,
	host: string,
	maxUrls: number = AUTOMATION_LIMITS.maxUrlsPerSitemap,
) {
	const queue = [startUrl];
	const seenSitemaps = new Set<string>();
	const urlEntries = new Map<string, ParsedSitemapUrl>();

	while (queue.length > 0 && urlEntries.size < maxUrls && seenSitemaps.size < MAX_SITEMAP_FILES) {
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
			const existing = urlEntries.get(entry.loc);
			// Keep the freshest lastmod when a URL appears in several sitemaps.
			if (!existing || (entry.lastmod && (!existing.lastmod || entry.lastmod > existing.lastmod))) {
				urlEntries.set(entry.loc, entry);
			}
		}
	}

	return {
		sitemapCount: seenSitemaps.size,
		urls: Array.from(urlEntries.values()),
		truncated: urlEntries.size >= maxUrls || queue.length > 0,
	};
}

const COMMON_SITEMAP_PATHS = [
	"/sitemap.xml",
	"/sitemap_index.xml",
	"/sitemap-index.xml",
	"/wp-sitemap.xml",
	"/sitemap/sitemap.xml",
	"/sitemap-0.xml",
	"/post-sitemap.xml",
	"/page-sitemap.xml",
	"/product-sitemap.xml",
];

const FEED_PATHS = ["/rss.xml", "/feed.xml", "/atom.xml", "/feed", "/rss"];

/**
 * Find a site's sitemap sources with as little user input as possible.
 * 1. robots.txt `Sitemap:` lines win, since that is the site's own declaration.
 * 2. Otherwise probe common paths in parallel.
 * Sources that are already children of another discovered index are dropped, and RSS/Atom
 * feeds are only used when no real sitemap exists, so the source list stays minimal.
 */
export async function discoverSitemapUrls(host: string) {
	const declared = new Set<string>();
	try {
		const robots = await fetchText(`https://${host}/robots.txt`, "IndexFast Sitemap Discoverer/1.0");
		for (const match of robots.matchAll(/^sitemap:\s*(\S+)/gim)) {
			const loc = normalizeUrlOnHost(match[1], host);
			if (loc) {
				declared.add(loc);
			}
		}
	} catch {
		// robots.txt is optional.
	}

	const probe = async (candidates: string[]) =>
		(await Promise.all(candidates.map((candidate) => fetchCandidateSource(candidate, host)))).filter(
			(result): result is NonNullable<typeof result> => result !== null,
		);

	let found = declared.size > 0 ? await probe(Array.from(declared)) : [];
	if (found.length === 0) {
		found = await probe(COMMON_SITEMAP_PATHS.map((path) => `https://${host}${path}`));
	}
	if (found.length === 0) {
		found = await probe(FEED_PATHS.map((path) => `https://${host}${path}`));
	}

	const children = new Set(found.flatMap((source) => source.parsed.sitemaps));
	const roots = found.filter((source) => !children.has(source.url));
	// Prefer indexes (they cover everything) and stable ordering for the "primary" pick.
	roots.sort((a, b) => b.parsed.sitemaps.length - a.parsed.sitemaps.length);
	return Array.from(new Set(roots.map((source) => source.url)));
}
