/*
 * Guards the AI-facing and search-facing metadata: llms.txt must carry the live plan prices and
 * never an indexing guarantee, withPageSeo must give every page a self canonical, and the
 * SoftwareApplication offers must match plans.ts.
 */
import { describe, expect, it } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt } from "@/lib/llms";
import { softwareApplicationJsonLd, withPageSeo, SITE_URL } from "@/lib/seo";
import { VISIBLE_PLANS } from "@/lib/platform/plans";
import { blogPosts, comparisons, tools } from "@/lib/marketing-data";

describe("llms.txt", () => {
	it("lists every visible plan price, tool and post", () => {
		const text = buildLlmsTxt();
		for (const plan of VISIBLE_PLANS) expect(text).toContain(plan.priceUsd === 0 ? "$0" : `$${plan.priceUsd}`);
		for (const tool of tools) expect(text).toContain(`/tools/${tool.slug}`);
		for (const post of blogPosts) expect(text).toContain(`/blog/${post.slug}`);
	});

	it("never promises indexing", () => {
		for (const text of [buildLlmsTxt(), buildLlmsFullTxt()]) {
			expect(text).not.toMatch(/we guarantee|guaranteed to (be )?index/i);
			expect(text).toContain("does not guarantee Google indexing");
		}
	});

	it("full brief covers comparisons", () => {
		const text = buildLlmsFullTxt();
		for (const item of comparisons) expect(text).toContain(`/compare/${item.slug}`);
	});
});

describe("withPageSeo", () => {
	it("sets a self canonical and og:url and strips a duplicate brand suffix", () => {
		const meta = withPageSeo("/pricing", { title: "Pricing | IndexFast", description: "d" });
		expect(meta.alternates?.canonical).toBe(`${SITE_URL}/pricing`);
		expect((meta.openGraph as { url?: string }).url).toBe(`${SITE_URL}/pricing`);
		expect(meta.title).toBe("Pricing");
	});

	it("types blog posts as articles with the index date", () => {
		const post = blogPosts[0];
		const og = withPageSeo(`/blog/${post.slug}`, { title: "t", description: "d" }).openGraph as { type?: string; publishedTime?: string };
		expect(og.type).toBe("article");
		expect(og.publishedTime).toBe(post.date);
	});
});

describe("SoftwareApplication offers", () => {
	it("has one offer per visible plan at the plans.ts price", () => {
		const offers = softwareApplicationJsonLd("d").offers;
		expect(offers.map((o) => [o.name, o.price])).toEqual(VISIBLE_PLANS.map((p) => [p.name, String(p.priceUsd)]));
	});
});
