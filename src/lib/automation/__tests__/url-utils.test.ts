import { describe, expect, it } from "vitest";
import {
	assertSafeExternalUrl,
	canonicalizeUrl,
	gunzipLimited,
	isGzipBytes,
	isPrivateOrDisallowedHost,
	normalizeHost,
	normalizeSitemapUrl,
	normalizeUrlForHost,
} from "@/lib/url-utils";

describe("url utils", () => {
	it("preserves www in configured hosts", () => {
		expect(normalizeHost("https://www.example.com/path")).toBe("www.example.com");
		expect(normalizeHost("example.com")).toBe("example.com");
	});

	it("requires sitemap URLs to match the exact host", () => {
		expect(normalizeSitemapUrl("https://www.example.com/sitemap.xml", "www.example.com")).toBe(
			"https://www.example.com/sitemap.xml",
		);
		expect(() => normalizeSitemapUrl("https://example.com/sitemap.xml", "www.example.com")).toThrow(
			"exact site host",
		);
	});

	it("normalizes submitted URLs for the exact site host", () => {
		expect(normalizeUrlForHost("https://www.example.com/blog", "www.example.com")).toBe("https://www.example.com/blog");
		expect(() => normalizeUrlForHost("https://example.com/blog", "www.example.com")).toThrow("selected site host");
	});

	it("blocks SSRF attempts to private and loopback networks", () => {
		expect(() => normalizeHost("127.0.0.1")).toThrow("Private or local network");
		expect(() => normalizeHost("http://localhost:3000")).toThrow();
		expect(() => normalizeHost("169.254.169.254")).toThrow("Private or local network");
		expect(() => normalizeHost("10.0.0.5")).toThrow("Private or local network");
		expect(() => normalizeHost("192.168.1.1")).toThrow("Private or local network");
		expect(() => normalizeUrlForHost("https://127.0.0.1/admin", "example.com")).toThrow();
		expect(() => normalizeUrlForHost("https://169.254.169.254/latest/meta-data", "example.com")).toThrow();
		expect(() => normalizeUrlForHost("http://[::ffff:127.0.0.1]/admin", "example.com")).toThrow();
		expect(() => normalizeUrlForHost("http://[::ffff:169.254.169.254]/meta", "example.com")).toThrow();
		expect(() => normalizeUrlForHost("http://[fe80::1]/admin", "example.com")).toThrow();
		expect(() => normalizeUrlForHost("http://user:pass@example.com/blog", "example.com")).toThrow("Credentials in URLs");
	});
});


describe("canonicalizeUrl (dedup key)", () => {
	it("drops fragments, default ports and tracking params", () => {
		expect(canonicalizeUrl("https://Example.com:443/a?utm_source=x&id=2#top")).toBe("https://example.com/a?id=2");
	});

	it("preserves path case and trailing slashes", () => {
		expect(canonicalizeUrl("https://example.com/Blog/")).toBe("https://example.com/Blog/");
		expect(canonicalizeUrl("https://example.com/blog")).not.toBe(canonicalizeUrl("https://example.com/blog/"));
	});
});

describe("SSRF host checks (gaps)", () => {
	it("blocks trailing-dot localhost, IPv4-compatible IPv6 and 192.0.0.0/24", () => {
		expect(isPrivateOrDisallowedHost("localhost.")).toBe(true);
		expect(isPrivateOrDisallowedHost("foo.localhost.")).toBe(true);
		expect(() => assertSafeExternalUrl("http://localhost./admin")).toThrow("Private or local network");
		expect(() => assertSafeExternalUrl("http://[::127.0.0.1]/")).toThrow("Private or local network");
		expect(() => assertSafeExternalUrl("http://[::a00:1]/")).toThrow("Private or local network");
		expect(isPrivateOrDisallowedHost("192.0.0.170")).toBe(true);
		expect(isPrivateOrDisallowedHost("example.com")).toBe(false);
		expect(isPrivateOrDisallowedHost("2606:4700::1111")).toBe(false);
	});
});

describe("canonicalizeUrl query normalization", () => {
	it("treats %20 and + in a query as the same URL", () => {
		expect(canonicalizeUrl("https://example.com/s?q=a%20b")).toBe(canonicalizeUrl("https://example.com/s?q=a+b"));
		expect(canonicalizeUrl("https://example.com/s?q=a%20b")).toBe("https://example.com/s?q=a+b");
	});

	it("drops a bare trailing question mark", () => {
		expect(canonicalizeUrl("https://example.com/a?")).toBe("https://example.com/a");
		expect(canonicalizeUrl("https://example.com/a?#x")).toBe("https://example.com/a");
	});

	it("leaves path encoding and other query bytes alone", () => {
		expect(canonicalizeUrl("https://example.com/a%20b?x=1/2")).toBe("https://example.com/a%20b?x=1/2");
	});
});

describe("gzip helpers", () => {
	it("detects and inflates gzip bytes under a size limit", async () => {
		const xml = "<urlset><url><loc>https://example.com/a</loc></url></urlset>";
		const gz = new Uint8Array(await new Response(new Blob([xml]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
		expect(isGzipBytes(gz)).toBe(true);
		expect(isGzipBytes(new TextEncoder().encode(xml))).toBe(false);
		expect(new TextDecoder().decode(await gunzipLimited(gz, { maxBytes: 1024 }))).toBe(xml);
		await expect(gunzipLimited(gz, { maxBytes: 10 })).rejects.toThrow("exceeds maximum limit");
		expect((await gunzipLimited(gz, { maxBytes: 10, truncate: true })).byteLength).toBe(10);
	});
});
