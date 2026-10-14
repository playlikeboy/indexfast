export function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Unknown error";
}

export function isPrivateOrDisallowedHost(hostname: string): boolean {
	const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, "");

	if (
		host === "localhost" ||
		host === "0.0.0.0" ||
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
		const [b0, b1] = [parseInt(ipv4Match[1], 10), parseInt(ipv4Match[2], 10)];
		if (b0 === 0) return true; // 0.0.0.0/8
		if (b0 === 10) return true; // 10.0.0.0/8
		if (b0 === 127) return true; // 127.0.0.0/8
		if (b0 === 169 && b1 === 254) return true; // 169.254.0.0/16 (metadata)
		if (b0 === 172 && b1 >= 16 && b1 <= 31) return true; // 172.16.0.0/12
		if (b0 === 192 && b1 === 168) return true; // 192.168.0.0/16
		if (b0 === 100 && b1 >= 64 && b1 <= 127) return true; // 100.64.0.0/10 CGNAT
		if (b0 >= 224) return true; // 224.0.0.0+ multicast/reserved
	}

	// Check IPv6
	if (host.includes(":")) {
		if (host === "::" || host === "::1") return true;
		if (host.startsWith("fe80:") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb")) return true;
		if (host.startsWith("fc00:") || host.startsWith("fd") || host.startsWith("fc")) return true;
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

export function normalizeUrlForHost(input: string, host: string) {
	const url = assertSafeExternalUrl(input);

	if (normalizeHost(url.hostname) !== host) {
		throw new Error("URL must belong to the selected site host");
	}

	return url.toString();
}

export function getSiteHost(site: { domain: string; indexingHost?: string | null }) {
	return site.indexingHost || site.domain;
}
