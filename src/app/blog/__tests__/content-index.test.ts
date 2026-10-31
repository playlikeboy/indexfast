/*
 * Guards the content index: every blog route has a blogPosts entry (or it is orphaned from /blog
 * and the sitemap), and sitemap.xml never lists a path robots.txt disallows.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blogPosts } from "@/lib/marketing-data";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

describe("blog and sitemap index", () => {
	it("lists every blog route in blogPosts", () => {
		const routes = readdirSync(join(__dirname, ".."), { withFileTypes: true })
			.filter((d) => d.isDirectory() && !d.name.startsWith("_"))
			.map((d) => d.name);
		const slugs = new Set(blogPosts.map((post) => post.slug));
		expect(routes.filter((route) => !slugs.has(route))).toEqual([]);
		expect(blogPosts.filter((post) => !routes.includes(post.slug)).map((p) => p.slug)).toEqual([]);
	});

	it("never lists a path robots.txt disallows", () => {
		const rules = robots().rules;
		const disallow = (Array.isArray(rules) ? rules : [rules]).flatMap((rule) => [rule.disallow ?? []].flat());
		const blocked = sitemap()
			.map((entry) => new URL(entry.url).pathname)
			.filter((path) => disallow.some((prefix) => path.startsWith(prefix)));
		expect(blocked).toEqual([]);
	});
});
