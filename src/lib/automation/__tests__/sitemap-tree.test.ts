import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverSitemapUrls, fetchSitemapTree, mapWithConcurrency } from "../sitemaps";
import { AUTOMATION_LIMITS } from "../constants";

const HOST = "example.com";

function urlset(...paths: string[]) {
	return `<urlset>${paths.map((path) => `<url><loc>https://${HOST}${path}</loc></url>`).join("")}</urlset>`;
}

function index(...paths: string[]) {
	return `<sitemapindex>${paths.map((path) => `<sitemap><loc>https://${HOST}${path}</loc></sitemap>`).join("")}</sitemapindex>`;
}

async function gzip(text: string) {
	return new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
}

/** Route-table fetch mock: unknown paths 404, values may be strings, bytes or thrown errors. */
function mockFetch(routes: Record<string, string | Uint8Array | Error>) {
	const calls: string[] = [];
	const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		calls.push(url);
		const body = routes[new URL(url).pathname];
		if (body instanceof Error) throw body;
		if (body === undefined) return new Response("not found", { status: 404 });
		return new Response(body as BodyInit, { status: 200 });
	});
	vi.stubGlobal("fetch", fetchMock);
	return calls;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("fetchSitemapTree", () => {
	it("keeps the URLs of healthy children when one child sitemap is broken", async () => {
		mockFetch({
			"/sitemap.xml": index("/a.xml", "/missing.xml", "/b.xml"),
			"/a.xml": urlset("/one"),
			"/b.xml": urlset("/two"),
		});
		const result = await fetchSitemapTree(`https://${HOST}/sitemap.xml`, HOST);
		expect(result.urls.map((entry) => entry.loc).sort()).toEqual([`https://${HOST}/one`, `https://${HOST}/two`]);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]).toContain("/missing.xml");
	});

	it("still throws when the root sitemap itself fails", async () => {
		mockFetch({});
		await expect(fetchSitemapTree(`https://${HOST}/sitemap.xml`, HOST)).rejects.toThrow("HTTP 404");
	});

	it("inflates .xml.gz children that arrive still compressed", async () => {
		mockFetch({
			"/sitemap.xml": index("/posts.xml.gz"),
			"/posts.xml.gz": await gzip(urlset("/gz-post")),
		});
		const result = await fetchSitemapTree(`https://${HOST}/sitemap.xml`, HOST);
		expect(result.urls.map((entry) => entry.loc)).toEqual([`https://${HOST}/gz-post`]);
		expect(result.failures).toEqual([]);
	});

	it("stops starting new files after the deadline and reports truncation", async () => {
		const calls = mockFetch({
			"/sitemap.xml": index("/a.xml", "/b.xml"),
			"/a.xml": urlset("/one"),
			"/b.xml": urlset("/two"),
		});
		const result = await fetchSitemapTree(`https://${HOST}/sitemap.xml`, HOST, { deadline: Date.now() - 1 });
		expect(calls).toHaveLength(1); // the root is always read
		expect(result.timedOut).toBe(true);
		expect(result.truncated).toBe(true);
	});
});

describe("discoverSitemapUrls", () => {
	it("probes at most 20 declared sitemaps, 3 at a time, reading at most 1MB each", async () => {
		const declared = Array.from({ length: 30 }, (_, i) => `/s${i}.xml`);
		const routes: Record<string, string> = {
			"/robots.txt": declared.map((path) => `Sitemap: https://${HOST}${path}`).join("\n"),
		};
		// Each sitemap is ~2MB: a full read would throw, a 1MB head read still parses.
		const big = urlset(...Array.from({ length: 40_000 }, (_, i) => `/page-${i}`));
		expect(big.length).toBeGreaterThan(AUTOMATION_LIMITS.discoveryProbeMaxBytes);
		for (const path of declared) routes[path] = big;

		let inFlight = 0;
		let peak = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				inFlight++;
				peak = Math.max(peak, inFlight);
				await new Promise((resolve) => setTimeout(resolve, 2));
				inFlight--;
				const body = routes[new URL(String(input)).pathname];
				return body ? new Response(body, { status: 200 }) : new Response("", { status: 404 });
			}),
		);

		const found = await discoverSitemapUrls(HOST);
		expect(found).toHaveLength(AUTOMATION_LIMITS.maxSitemapSourcesPerSite);
		expect(peak).toBeLessThanOrEqual(AUTOMATION_LIMITS.discoveryProbeConcurrency);
		// Builds 1MB+ bodies: about 2s alone, slower when the full suite runs in parallel.
	}, 20_000);
});

describe("mapWithConcurrency", () => {
	it("keeps result order", async () => {
		expect(await mapWithConcurrency([3, 1, 2], 2, async (value) => value * 10)).toEqual([30, 10, 20]);
		expect(await mapWithConcurrency([], 3, async (value) => value)).toEqual([]);
	});
});
