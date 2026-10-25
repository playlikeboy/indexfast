/**
 * URL safety and normalization. Two jobs: (1) SSRF protection for every outbound fetch of a
 * user-supplied URL (assertSafeExternalUrl / safeFetchText), and (2) the canonical URL form
 * used as the dedup key across sitemaps, manual submits and the queue (canonicalizeUrl).
 */
export function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Unknown error";
}

export function isPrivateOrDisallowedHost(hostname: string): boolean {
	const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, "");

	if (
		host === "localhost" ||
		host === "0.0.0.0" ||
		host === "::" ||
		host === "::1" ||
		host.endsWith(".localhost") ||
		host.endsWith(".local") ||
		host.endsWith(".internal") ||
		host.endsWith(".lan") ||
		host.endsWith(".localdomain") ||
		host.endsWith(".home") ||
		host.endsWith(".arpa")
	) {
		return true;
	}

	// Check IPv4
	const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
	if (ipv4Match) {
		const [b0, b1, b2] = [parseInt(ipv4Match[1], 10), parseInt(ipv4Match[2], 10), parseInt(ipv4Match[3], 10)];
		if (b0 === 0) return true; // 0.0.0.0/8
		if (b0 === 10) return true; // 10.0.0.0/8
		if (b0 === 127) return true; // 127.0.0.0/8
		if (b0 === 169 && b1 === 254) return true; // 169.254.0.0/16 (metadata)
		if (b0 === 172 && b1 >= 16 && b1 <= 31) return true; // 172.16.0.0/12
		if (b0 === 192 && b1 === 168) return true; // 192.168.0.0/16
		if (b0 === 100 && b1 >= 64 && b1 <= 127) return true; // 100.64.0.0/10 CGNAT
		if (b0 === 198 && (b1 === 18 || b1 === 19)) return true; // 198.18.0.0/15 benchmarking
		if (b0 === 192 && b1 === 0 && b2 === 2) return true; // 192.0.2.0/24 TEST-NET-1
		if (b0 === 198 && b1 === 51 && b2 === 100) return true; // 198.51.100.0/24 TEST-NET-2
		if (b0 === 203 && b1 === 0 && b2 === 113) return true; // 203.0.113.0/24 TEST-NET-3
		if (b0 >= 224) return true; // 224.0.0.0+ multicast/reserved
	}

	// Check IPv6
	if (host.includes(":")) {
		if (
			host === "::" ||
			host === "::1" ||
			host.includes(":ffff:") ||
			host.startsWith("::ffff:") ||
			host.startsWith("2002:") || // 6to4
			host.startsWith("64:ff9b:") || // NAT64
			host.startsWith("fe8") ||
			host.startsWith("fe9") ||
			host.startsWith("fea") ||
			host.startsWith("feb") || // fe80::/10 link-local
			host.startsWith("fc") ||
			host.startsWith("fd") || // fc00::/7 unique local
			host.startsWith("ff") || // ff00::/8 multicast
			host.startsWith("100::") || // discard
			host.startsWith("2001:db8:") || // documentation
			host.startsWith("2001:10:") || // ORCHID
			host.startsWith("2001:20:")
		) {
			return true;
		}
	}

	return false;
}

export function assertSafeExternalUrl(input: string): URL {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		throw new Error("Enter a valid URL");
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("URL must use HTTP or HTTPS");
	}

	if (url.username || url.password) {
		throw new Error("Credentials in URLs are not permitted");
	}

	if (isPrivateOrDisallowedHost(url.hostname)) {
		throw new Error("Private or local network hosts are not allowed");
	}

	// Disallow non-standard ports commonly abused for internal service probing
	if (url.port && url.port !== "80" && url.port !== "443" && url.port !== "8080" && url.port !== "8443") {
		throw new Error("Non-standard service ports are not permitted");
	}

	return url;
}

async function readResponseTextLimited(response: Response, maxBytes: number) {
	if (!response.body) {
		const text = await response.text();
		if (new TextEncoder().encode(text).byteLength > maxBytes) {
			throw new Error("Response size exceeds maximum limit of " + maxBytes + " bytes");
		}
		return text;
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel().catch(() => undefined);
				throw new Error("Response size exceeds maximum limit of " + maxBytes + " bytes");
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

export async function safeFetchText(
	inputUrl: string,
	options: {
		timeoutMs?: number;
		userAgent?: string;
		maxBytes?: number;
		redirectLimit?: number;
	} = {},
): Promise<{ text: string; status: number; finalUrl: string; headers: Headers }> {
	const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
	const timeoutMs = options.timeoutMs ?? 10000;
	const userAgent = options.userAgent ?? "IndexFast Bot/1.0 (+https://indexfast.co)";
	let currentUrl = assertSafeExternalUrl(inputUrl).toString();
	let redirectCount = 0;
	const maxRedirects = options.redirectLimit ?? 5;

	while (redirectCount <= maxRedirects) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetch(currentUrl, {
				method: "GET",
				headers: {
					"User-Agent": userAgent,
					Accept: "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8",
				},
				redirect: "manual",
				signal: controller.signal,
			});
			if (response.status >= 300 && response.status < 400) {
				await response.body?.cancel().catch(() => undefined);
				clearTimeout(timeoutId);
				const location = response.headers.get("location");
				if (!location) throw new Error("Redirect status " + response.status + " without Location header");
				const nextUrl = new URL(location, currentUrl).toString();
				currentUrl = assertSafeExternalUrl(nextUrl).toString();
				redirectCount++;
				continue;
			}
			// The timer remains active during streaming so slow bodies are aborted too.
			const text = await readResponseTextLimited(response, maxBytes);
			clearTimeout(timeoutId);
			return { text, status: response.status, finalUrl: currentUrl, headers: response.headers };
		} catch (err: unknown) {
			clearTimeout(timeoutId);
			if (err instanceof Error && err.name === "AbortError") {
				throw new Error("Request timed out after " + timeoutMs + "ms");
			}
			throw err;
		}
	}
	throw new Error("Exceeded maximum redirect limit of " + maxRedirects);
}

export function normalizeHost(input: string) {
	const raw = input.trim();
	if (!raw) {
		throw new Error("Domain is required");
	}

	let hostname: string;
	try {
		const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
		hostname = url.hostname.toLowerCase();
	} catch {
		throw new Error("Enter a valid domain");
	}

	if (isPrivateOrDisallowedHost(hostname)) {
		throw new Error("Private or local network hosts are not allowed");
	}

	const validHost = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
		hostname,
	);

	if (!validHost) {
		throw new Error("Enter a valid domain");
	}

	return hostname;
}

export function normalizeSitemapUrl(sitemapUrl: string | undefined, host: string) {
	const raw = sitemapUrl?.trim();
	if (!raw) {
		return null;
	}

	const url = assertSafeExternalUrl(raw);

	if (normalizeHost(url.hostname) !== host) {
		throw new Error("Sitemap URL must belong to the exact site host");
	}

	return url.toString();
}

// Query params that never change page content. Stripping them is what lets the same page,
// linked from a campaign and listed in a sitemap, collapse into one tracked URL.
const TRACKING_PARAMS = /^(utm_[a-z]+|gclid|fbclid|msclkid|mc_cid|mc_eid|_ga|ref_src)$/i;

/**
 * Canonical form used as the dedup key for `urls.loc` and the submission queue.
 * Lowercases scheme/host (URL does this), drops the fragment, default ports, and tracking
 * params. Path case and trailing slashes are preserved: they are different URLs to search
 * engines and silently merging them would submit a URL the site never published.
 */
export function canonicalizeUrl(input: string | URL) {
	const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
	url.hash = "";
	if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
		url.port = "";
	}
	for (const key of Array.from(url.searchParams.keys())) {
		if (TRACKING_PARAMS.test(key)) {
			url.searchParams.delete(key);
		}
	}
	return url.toString();
}

export function normalizeUrlForHost(input: string, host: string) {
	const url = assertSafeExternalUrl(input);

	if (normalizeHost(url.hostname) !== host) {
		throw new Error("URL must belong to the selected site host");
	}

	return canonicalizeUrl(url);
}

export function getSiteHost(site: { domain: string; indexingHost?: string | null }) {
	return site.indexingHost || site.domain;
}
