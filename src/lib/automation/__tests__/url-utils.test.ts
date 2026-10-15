import { describe, expect, it } from "vitest";
import { canonicalizeUrl, normalizeHost, normalizeSitemapUrl, normalizeUrlForHost } from "@/lib/url-utils";

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
