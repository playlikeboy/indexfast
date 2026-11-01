import { describe, expect, it, vi } from "vitest";
import { evaluateUrlDiagnostics } from "@/lib/automation/diagnostics";

describe("evaluateUrlDiagnostics", () => {
	it("blocks private network and SSRF targets gracefully", async () => {
		const result = await evaluateUrlDiagnostics("http://127.0.0.1:8080/internal");
		expect(result.status).toBe("fail");
		expect(result.blockers.length).toBeGreaterThan(0);
		expect(result.blockers[0]).toMatch(/Private or local network/);
	});

	it("detects noindex tag and returns fail status", async () => {
		const html = `<html><head><meta name="robots" content="noindex, follow"><title>Blocked Page</title></head><body>Hello</body></html>`;
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue({
			status: 200,
			headers: new Headers({ "content-type": "text/html" }),
			text: () => Promise.resolve(html),
		}) as unknown as typeof fetch;

		try {
			const result = await evaluateUrlDiagnostics("https://example.com/test-noindex");
			expect(result.status).toBe("fail");
			expect(result.noindex).toBe(true);
			expect(result.noindexSource).toBe("meta_robots");
			expect(result.title).toBe("Blocked Page");
			expect(result.blockers.some((b) => b.includes("noindex"))).toBe(true);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("detects X-Robots-Tag header noindex", async () => {
		const html = `<html><head><title>Clean HTML</title></head><body>No meta tag</body></html>`;
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue({
			status: 200,
			headers: new Headers({
				"content-type": "text/html",
				"x-robots-tag": "noindex, noarchive",
			}),
			text: () => Promise.resolve(html),
		}) as unknown as typeof fetch;

		try {
			const result = await evaluateUrlDiagnostics("https://example.com/header-noindex");
			expect(result.status).toBe("fail");
			expect(result.noindex).toBe(true);
			expect(result.noindexSource).toBe("x_robots_tag");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("passes clean page with matching canonical", async () => {
		const html = `<html><head><title>Good Page</title><link rel="canonical" href="https://example.com/clean"></head><body>Valid content</body></html>`;
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue({
			status: 200,
			headers: new Headers({ "content-type": "text/html" }),
			text: () => Promise.resolve(html),
		}) as unknown as typeof fetch;

		try {
			const result = await evaluateUrlDiagnostics("https://example.com/clean");
			expect(result.status).toBe("pass");
			expect(result.noindex).toBe(false);
			expect(result.isCanonicalMatch).toBe(true);
			expect(result.blockers.length).toBe(0);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("fails a URL that robots.txt disallows for Googlebot", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockImplementation((input: string | URL | Request) => {
			const url = String(input instanceof Request ? input.url : input);
			const body = url.endsWith("/robots.txt") ? "User-agent: *\nDisallow: /private/\n" : "<html><head><title>Hi</title></head></html>";
			return Promise.resolve({ status: 200, headers: new Headers({ "content-type": "text/plain" }), text: () => Promise.resolve(body) });
		}) as unknown as typeof fetch;

		try {
			const blocked = await evaluateUrlDiagnostics("https://example.com/private/page");
			expect(blocked.robotsBlocked).toBe(true);
			expect(blocked.status).toBe("fail");
			const open = await evaluateUrlDiagnostics("https://example.com/public/page");
			expect(open.robotsBlocked).toBe(false);
			expect(open.redirected).toBe(false);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
