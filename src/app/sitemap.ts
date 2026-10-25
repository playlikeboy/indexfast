import { MetadataRoute } from "next";
import { blogPosts, tools } from "@/lib/marketing-data";

const SITE_URL = "https://indexfast.co";

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
		{
			url: `${SITE_URL}/login`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.5,
		},
		{
			url: `${SITE_URL}/signup`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.5,
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

	return [...staticRoutes, ...toolRoutes, ...blogRoutes];
}
