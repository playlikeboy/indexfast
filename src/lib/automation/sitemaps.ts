/**
 * Sitemap parsing, crawling and discovery. Pure network + parsing, no DB, so it is unit
 * tested directly. Every URL leaving this module is canonicalized and filtered to the site's
 * exact host, which is what makes downstream dedup and IndexNow host checks reliable.
 */
import { AUTOMATION_LIMITS } from "./constants";
import { canonicalizeUrl, getErrorMessage, normalizeHost, safeFetchText } from "@/lib/url-utils";

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

// Sitemaps can legitimately be large (50k URLs is ~10MB). The cap protects Worker memory.
const MAX_SITEMAP_BYTES = 15 * 1024 * 1024;
const MAX_SITEMAP_FILES = 100;

async function fetchText(url: string, userAgent: string) {
	const res = await safeFetchText(url, { userAgent, timeoutMs: 15000, maxBytes: MAX_SITEMAP_BYTES, decompressGzip: true });
	if (res.status !== 200) {
		throw new Error(`${url} returned HTTP ${res.status}`);
	}
	return res.text;
}

/** Probes only need the head of a file, so they read at most 1MB instead of failing on big files. */
function fetchHead(url: string, timeoutMs: number) {
	return safeFetchText(url, {
		userAgent: "IndexFast Sitemap Discoverer/1.0",
		timeoutMs,
		maxBytes: AUTOMATION_LIMITS.discoveryProbeMaxBytes,
		truncate: true,
		decompressGzip: true,
	});
}

async function fetchCandidateSource(url: string, host: string) {
	try {
		const res = await fetchHead(url, 6000);
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

/** Run at most `limit` tasks at once: discovery must not hold many large bodies in memory together. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
	const results = new Array<R>(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await task(items[index]);
		}
	});
	await Promise.all(workers);
	return results;
}

/**
 * Check a user-supplied sitemap URL before saving it, so a blog post or HTML page pasted
 * by mistake is rejected with a clear reason instead of failing every hour in the cron.
 */
export async function validateSitemapUrl(url: string, host: string) {
	let res;
	try {
		res = await fetchHead(url, 10000);
	} catch (error) {
		return `Could not fetch ${url}: ${error instanceof Error ? error.message : "network error"}`;
	}
	if (res.status !== 200) {
		return `${url} returned HTTP ${res.status}.`;
	}
	const body = res.text.trim();
	if (!body.startsWith("<") || !/<(?:[\w-]+:)?(urlset|sitemapindex|rss|feed)\b/i.test(body)) {
		return `${url} is not a sitemap. Use an XML sitemap URL, usually ${`https://${host}/sitemap.xml`}.`;
	}
	return null;
}

/**
 * Breadth-first walk through sitemap indexes. Returns deduplicated URL entries (keyed by the
 * canonical loc produced in parseSitemapXml), so the same page listed in two child sitemaps
 * is only ingested once.
 *
 * Only the root failing throws: one broken or missing child must not hide the URLs of every
 * other child, so child errors are collected in `failures` and the walk continues. The
 * optional `deadline` (epoch ms) is checked before each file so the cron stays inside its
 * wall-time budget; unvisited files are reported through `truncated`.
 */
export async function fetchSitemapTree(
	startUrl: string,
	host: string,
	options: { maxUrls?: number; deadline?: number } = {},
) {
	const maxUrls = options.maxUrls ?? AUTOMATION_LIMITS.maxUrlsPerSitemap;
	const queue = [startUrl];
	const seenSitemaps = new Set<string>();
	const urlEntries = new Map<string, ParsedSitemapUrl>();
	const failures: string[] = [];
	// Hosts of <loc> entries dropped by the exact-host filter. Lets sync explain the classic
	// mistake: adding "x.github.io" when the sitemap lists "customdomain.com".
	const foreignHosts = new Map<string, number>();
	let timedOut = false;

	while (queue.length > 0 && urlEntries.size < maxUrls && seenSitemaps.size < MAX_SITEMAP_FILES) {
		const current = queue.shift();
		if (!current || seenSitemaps.has(current)) {
			continue;
		}
		if (options.deadline && Date.now() > options.deadline && seenSitemaps.size > 0) {
			queue.unshift(current);
			timedOut = true;
			break;
		}

		seenSitemaps.add(current);
		let xml: string;
		try {
			xml = await fetchText(current, "IndexFast Sitemap Crawler/1.0");
		} catch (error) {
			if (current === startUrl) throw error;
			failures.push(`${current}: ${getErrorMessage(error)}`);
			continue;
		}
		const parsed = parseSitemapXml(xml, host);
		if (parsed.urls.length === 0 && parsed.sitemaps.length === 0) {
			for (const match of xml.matchAll(/<(?:[\w-]+:)?loc>\s*(?:<!\[CDATA\[)?\s*https?:\/\/([^/<\s\]:]+)/gi)) {
				const foreign = match[1].toLowerCase();
				if (foreign !== host) foreignHosts.set(foreign, (foreignHosts.get(foreign) ?? 0) + 1);
			}
		}

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
		failures,
		timedOut,
		truncated: urlEntries.size >= maxUrls || queue.length > 0,
		foreignHosts: Array.from(foreignHosts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name),
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
 * 2. Otherwise probe common paths, a few at a time.
 * Sources that are already children of another discovered index are dropped, and RSS/Atom
 * feeds are only used when no real sitemap exists, so the source list stays minimal.
 * Probes read at most 1MB each, 3 at a time, and at most 20 declared sitemaps are probed,
 * so a robots.txt listing hundreds of sitemaps cannot exhaust Worker memory.
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
			if (declared.size >= AUTOMATION_LIMITS.maxSitemapSourcesPerSite) break;
		}
	} catch {
		// robots.txt is optional.
	}

	const probe = async (candidates: string[]) =>
		(
			await mapWithConcurrency(candidates, AUTOMATION_LIMITS.discoveryProbeConcurrency, (candidate) =>
				fetchCandidateSource(candidate, host),
			)
		).filter((result): result is NonNullable<typeof result> => result !== null);

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
	const ordered = [...roots].sort((a, b) => b.parsed.sitemaps.length - a.parsed.sitemaps.length);
	return Array.from(new Set(ordered.map((source) => source.url))).slice(0, AUTOMATION_LIMITS.maxSitemapSourcesPerSite);
}
