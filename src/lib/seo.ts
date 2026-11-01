/*
 * Per-page SEO metadata for every public route. It exists because Next merges metadata shallowly:
 * a canonical or og:url set in the root layout leaks into every child that does not override it,
 * which once told search engines that /pricing, /blog and /resources were duplicates of the home
 * page. Rules it enforces:
 * - every public page gets a self-referencing absolute canonical built from its own path;
 * - og:url, og:title, og:description and the share image always describe the page itself;
 * - blog posts are typed `article` with the publish date from `blogPosts` (one source of dates);
 * - titles are bare: the root layout template appends "| IndexFast", so a page must not.
 * Structured data that must match plan prices (SoftwareApplication offers) is built here from
 * plans.ts so a price change never leaves stale schema behind.
 */
import type { Metadata } from "next";
import { getBlogPostBySlug } from "@/lib/marketing-data";
import { VISIBLE_PLANS, PLAN_PERIOD_DAYS } from "@/lib/platform/plans";

export const SITE_URL = "https://indexfast.co";
export const SITE_NAME = "IndexFast";
export const OG_IMAGE = { url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "IndexFast: automatic page discovery for sites that ship fast" };
export const LOGO_URL = `${SITE_URL}/logo.png`;

type PageSeoInput = Omit<Metadata, "title" | "description"> & {
	title: string;
	description: string;
};

/**
 * Wraps a page's own metadata with the canonical, Open Graph and Twitter fields derived from its
 * path. Page-supplied openGraph/twitter text wins, but url, type and images are always set here.
 */
export function withPageSeo(path: string, input: PageSeoInput): Metadata {
	const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
	// Older pages wrote "Pricing | IndexFast"; the layout template adds the suffix, so strip it.
	const title = input.title.replace(/\s*\|\s*IndexFast$/, "");
	const post = path.startsWith("/blog/") ? getBlogPostBySlug(path.slice("/blog/".length)) : undefined;
	const og = (input.openGraph ?? {}) as Record<string, unknown>;
	const tw = (input.twitter ?? {}) as Record<string, unknown>;
	const ogTitle = (og.title as string | undefined) ?? title;
	const ogDescription = (og.description as string | undefined) ?? input.description;

	return {
		...input,
		// The home title already leads with the brand, so it skips the "| IndexFast" template.
		title: path === "/" ? { absolute: title } : title,
		alternates: { canonical: url },
		openGraph: {
			siteName: SITE_NAME,
			locale: "en_US",
			title: ogTitle,
			description: ogDescription,
			url,
			images: [OG_IMAGE],
			...(post
				? { type: "article" as const, publishedTime: post.date, modifiedTime: post.date, authors: [SITE_NAME] }
				: { type: "website" as const }),
		},
		twitter: {
			card: "summary_large_image",
			title: (tw.title as string | undefined) ?? ogTitle,
			description: (tw.description as string | undefined) ?? ogDescription,
			images: [OG_IMAGE.url],
		},
	};
}

/**
 * SoftwareApplication JSON-LD with one Offer per visible plan. Prices come from plans.ts; each
 * paid plan is a prepaid period (no auto-renew), stated in the offer description rather than as
 * a recurring price spec, because nothing recurs.
 */
export function softwareApplicationJsonLd(description: string) {
	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: SITE_NAME,
		url: SITE_URL,
		applicationCategory: "DeveloperApplication",
		applicationSubCategory: "SEO indexing automation",
		operatingSystem: "Web",
		description,
		publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
		offers: VISIBLE_PLANS.map((plan) => ({
			"@type": "Offer",
			name: plan.name,
			price: String(plan.priceUsd),
			priceCurrency: "USD",
			url: `${SITE_URL}/pricing`,
			availability: "https://schema.org/InStock",
			description:
				plan.priceUsd === 0
					? `${plan.tagline} ${plan.features.join(", ")}.`
					: `Prepaid ${PLAN_PERIOD_DAYS}-day plan, no auto-renewal. ${plan.features.join(", ")}.`,
		})),
	};
}

/**
 * Article JSON-LD for a blog post, with dates read from `blogPosts` so the markup, the visible
 * date and the sitemap lastmod always agree. Throws on an unknown slug: a post without an index
 * entry is a bug (it would be missing from /blog and the sitemap).
 */
export function articleJsonLd(slug: string, headline: string) {
	const post = getBlogPostBySlug(slug);
	if (!post) throw new Error(`No blogPosts entry for ${slug}`);
	const url = `${SITE_URL}/blog/${slug}`;
	return {
		"@context": "https://schema.org",
		"@type": "Article",
		headline,
		description: post.description,
		image: OG_IMAGE.url,
		datePublished: post.date,
		dateModified: post.date,
		author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
		publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: LOGO_URL } },
		mainEntityOfPage: url,
	};
}
