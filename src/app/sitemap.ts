/*
 * sitemap.xml: every public, indexable route. It must never list a path robots.ts disallows
 * (/dashboard, /api/, /login, /signup), or engines get contradictory signals. Tool and blog
 * routes come from marketing-data so a new entry there is listed automatically; comparison pages
 * come from `comparisons` and per-engine guides from the search-engine catalog, for the same reason.
 */
import { MetadataRoute } from "next";
import { blogPosts, comparisons, tools } from "@/lib/marketing-data";
import { getAllSearchEngines } from "@/lib/resources/search-engines";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
	const staticRoutes: MetadataRoute.Sitemap = [
		{
			url: SITE_URL,
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 1,
		},
		{
			url: `${SITE_URL}/tools`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.9,
		},
		{
			url: `${SITE_URL}/blog`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: `${SITE_URL}/pricing`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: `${SITE_URL}/resources`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.85,
		},
		{
			url: `${SITE_URL}/resources/directories`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: `${SITE_URL}/resources/tools`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.75,
		},
		{
			url: `${SITE_URL}/resources/skill`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.65,
		},
		{
			url: `${SITE_URL}/resources/google-indexing-api`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.65,
		},
		{
			url: `${SITE_URL}/resources/search-engines`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: `${SITE_URL}/compare`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: `${SITE_URL}/about`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: `${SITE_URL}/contact`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${SITE_URL}/privacy`,
			lastModified: new Date(),
			changeFrequency: "yearly",
			priority: 0.3,
		},
		{
			url: `${SITE_URL}/terms`,
			lastModified: new Date(),
			changeFrequency: "yearly",
			priority: 0.3,
		},
	];

	const toolRoutes: MetadataRoute.Sitemap = tools.map((tool) => ({
		url: `${SITE_URL}/tools/${tool.slug}`,
		lastModified: new Date(),
		changeFrequency: "weekly",
		priority: 0.7,
	}));

	const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => ({
		url: `${SITE_URL}/blog/${post.slug}`,
		lastModified: new Date(post.date),
		changeFrequency: "monthly",
		priority: 0.6,
	}));

	const comparisonRoutes: MetadataRoute.Sitemap = comparisons.map((item) => ({
		url: `${SITE_URL}/compare/${item.slug}`,
		lastModified: new Date(item.checked),
		changeFrequency: "monthly",
		priority: 0.6,
	}));

	const engineRoutes: MetadataRoute.Sitemap = getAllSearchEngines().map((engine) => ({
		url: `${SITE_URL}/resources/search-engines/${engine.id}`,
		lastModified: new Date(),
		changeFrequency: "monthly",
		priority: 0.65,
	}));

	return [...staticRoutes, ...toolRoutes, ...blogRoutes, ...comparisonRoutes, ...engineRoutes];
}
