import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Blog", url: `${SITE_URL}/blog` },
	{ name: "SEO Meta Tags That Actually Matter for Indexing in 2026", url: `${SITE_URL}/blog/seo-meta-tags-that-matter` },
];

const articleJsonLd = {
	"@context": "https://schema.org",
	"@type": "Article",
	headline: "SEO Meta Tags That Actually Matter for Indexing in 2026",
	description:
		"A practical guide to the meta tags, HTTP headers, and directives that control whether your pages get indexed — and which ones SEOs still waste time on.",
	image: `${SITE_URL}/og-image.png`,
	datePublished: "2026-05-05",
	dateModified: "2026-05-05",
	author: {
		"@type": "Organization",
		name: "IndexFast",
		url: SITE_URL,
	},
	publisher: {
		"@type": "Organization",
		name: "IndexFast",
		url: SITE_URL,
		logo: {
			"@type": "ImageObject",
			url: `${SITE_URL}/favicon.svg`,
		},
	},
	mainEntityOfPage: `${SITE_URL}/blog/seo-meta-tags-that-matter`,
};

const faqJsonLd = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: [
		{
			"@type": "Question",
			name: "Which meta tag is most important for preventing indexing?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "The noindex directive — either as a meta robots tag or X-Robots-Tag HTTP header — is the most direct way to prevent indexing. A single accidental noindex can remove a page from Google entirely.",
			},
		},
		{
			"@type": "Question",
			name: "Does the keywords meta tag affect indexing?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "No. Google has not used the keywords meta tag as a ranking signal for many years. Focus on title tags, meta descriptions, robots directives, and canonical tags — those still matter.",
			},
		},
		{
			"@type": "Question",
			name: "What is the difference between noindex and nofollow?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "noindex tells search engines not to include the page in their index. nofollow tells them not to follow links on the page. They can be combined (e.g. 'noindex, nofollow') or used independently. Use noindex for staging sites and private pages; nofollow is rarely needed today.",
			},
		},
	],
};

export const metadata = {
	title: "SEO Meta Tags That Actually Matter for Indexing in 2026",
	description:
		"A practical guide to the meta tags, HTTP headers, and directives that control whether your pages get indexed — and which ones SEOs still waste time on.",
	keywords: [
		"seo meta tags",
		"meta tags that matter",
		"noindex meta tag",
		"canonical meta tag",
		"robots meta tag",
		"meta tags for indexing",
		"x-robots-tag",
	],
	alternates: {
		canonical: `${SITE_URL}/blog/seo-meta-tags-that-matter`,
	},
};

export default function SeoMetaTagsPost() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
				/>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
				/>
				<article className="py-20 sm:py-28" aria-labelledby="post-heading">
					<div className="mx-auto max-w-3xl px-4 sm:px-6">
						<p className="label-mono">Technical SEO · May 5, 2026 · 9 min read</p>
						<h1 id="post-heading" className="display mt-3 text-4xl sm:text-5xl">
							SEO Meta Tags That Actually Matter for{" "}
							<span className="text-highlight">Indexing in 2026</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Not all meta tags are created equal. Some actively control whether your pages get
							indexed. Others are ignored by search engines. Here is which directives you need to
							pay attention to — and which ones you can stop worrying about.
						</p>

						<div className="prose prose-muted mt-14 max-w-none space-y-8 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">The meta tags that control indexing</h2>
							<p>
								A small set of HTML meta tags and HTTP headers have a direct, powerful effect
								on whether a page is indexed. Get these wrong and your pages will not appear in
								search results — regardless of how good the content is.
							</p>

							<h3 className="text-sm font-bold text-ink mt-6">1. robots meta tag</h3>
							<p>
								The robots meta tag is the most important indexing directive. It lives in the HTML
								head and tells search engines how to treat the page:
							</p>
							<ul className="list-disc space-y-2 pl-5">
								<li>
									<strong className="text-ink">index, follow</strong> — Default. Page can be indexed
									and links can be followed.
								</li>
								<li>
									<strong className="text-ink">noindex</strong> — Page will not be indexed. This is
									the most dangerous tag to get wrong.
								</li>
								<li>
									<strong className="text-ink">nofollow</strong> — Links on the page will not be
									followed. Rarely needed.
								</li>
								<li>
									<strong className="text-ink">noimageindex</strong> — Images on the page will not
									be indexed.
								</li>
							</ul>
							<p>
								Common mistakes: noindex left on from staging, conflicting directives (e.g.
								index + nofollow mixed incorrectly), or applying noindex to entire sections via
								templates.
							</p>

							<h3 className="text-sm font-bold text-ink mt-6">2. X-Robots-Tag HTTP header</h3>
							<p>
								The X-Robots-Tag header achieves the same effect as the robots meta tag but at the
								HTTP level. It is commonly used for PDFs, images, and non-HTML files where a meta
								tag cannot be embedded. It supports the same directives: noindex, nofollow,
								nosnippet, and more.
							</p>
							<p>
								Common mistake: a CDN or server config adds an X-Robots-Tag: noindex to a file
								type (e.g. PDFs) when you actually want them indexed.
							</p>

							<h3 className="text-sm font-bold text-ink mt-6">3. canonical link element</h3>
							<p>
								The canonical tag tells search engines which URL is the preferred version when
								duplicate or similar pages exist. A correctly set canonical consolidates ranking
								signals to one URL. A wrong canonical can cause the wrong page to rank — or cause
								all versions to be excluded.
							</p>
							<p>
								Key rules: the canonical URL should be absolute, should match the page's primary
								URL, and should be consistent across http/https and www/non-www variants.
							</p>

							<h2 className="text-base font-bold text-ink">Meta tags that do not matter for indexing</h2>
							<p>
								Save time by ignoring these:
							</p>
							<ul className="list-disc space-y-2 pl-5">
								<li>
									<strong className="text-ink">keywords meta tag</strong> — Google has not used this
									since 2009. Bing gives it negligible weight.
								</li>
								<li>
									<strong className="text-ink">author meta tag</strong> — No ranking impact. Fine for
									attribution, but not worth optimizing for.
								</li>
								<li>
									<strong className="text-ink">revisit-after</strong> — Ignored by major search
									engines. Use sitemap ping instead.
								</li>
								<li>
									<strong className="text-ink">expires</strong> — Rarely used correctly. Better to
									return 410 Gone for truly removed pages.
								</li>
							</ul>

							<h2 className="text-base font-bold text-ink">Other signals that affect indexing</h2>
							<p>
								Beyond meta tags, these technical signals determine indexability:
							</p>
							<ul className="list-disc space-y-2 pl-5">
								<li>
									<strong className="text-ink">HTTP status code</strong> — 200 OK is required. Everything
									else blocks or removes indexing.
								</li>
								<li>
									<strong className="text-ink">robots.txt Disallow</strong> — Blocked pages cannot be
									crawled, and without crawling, they cannot be indexed.
								</li>
								<li>
									<strong className="text-ink">Page speed</strong> — Very slow pages consume more
									crawl budget and may be deprioritized.
								</li>
								<li>
									<strong className="text-ink">Mobile-friendliness</strong> — Mobile-first indexing
									means mobile usability issues can affect rankings and, in severe cases, indexing.
								</li>
							</ul>

							<h2 className="text-base font-bold text-ink">How to audit your meta tags at scale</h2>
							<p>
								For small sites, spot-checking in the browser is enough. For large or dynamic
								sites, automate:
							</p>
							<ul className="list-disc space-y-2 pl-5">
								<li>
									Use the Noindex Tag Checker to scan individual pages for noindex signals.
								</li>
								<li>
									Use the Canonical Checker to verify canonical tags match the intended URLs.
								</li>
								<li>
									Sample your pSEO templates and verify the meta robots tag is correct across
									all variations.
								</li>
								<li>
									Check server responses for X-Robots-Tag headers on non-HTML assets.
								</li>
							</ul>

							<h2 className="text-base font-bold text-ink">Final recommendation</h2>
							<p>
								Focus your auditing energy on the tags that control indexing: robots meta, X-Robots-Tag,
								and canonical. Ignore the noise. A single stray noindex tag can remove a page from
								the index; a correct canonical can save it. These three tags are where your time
								is best spent.
							</p>
						</div>
					</div>
				</article>
			</main>
			<Footer />
		</>
	);
}
