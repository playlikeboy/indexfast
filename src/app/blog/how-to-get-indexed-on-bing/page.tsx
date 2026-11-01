/*
 * Blog post: a Bing indexing checklist. Answer-first lede, only official channels (Bing
 * Webmaster Tools, sitemaps, IndexNow, the Webmaster API), and AI-search claims limited to what
 * Microsoft and the syndicating engines state publicly. No indexing or ranking guarantee.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { PostShell } from "../_components/PostShell";
import { PostFaq, type FaqItem } from "../_components/PostFaq";
import { SITE_URL, articleJsonLd, withPageSeo } from "@/lib/seo";

const SLUG = "how-to-get-indexed-on-bing";
const TITLE = "How to Get Your Pages Indexed on Bing (and Into AI Answers That Use It)";

export const metadata: Metadata = withPageSeo(`/blog/${SLUG}`, {
	title: "How to Get Indexed on Bing: A Practical Checklist",
	description:
		"Get new pages indexed on Bing: verify in Bing Webmaster Tools, submit a clean sitemap, push changes with IndexNow and the Webmaster API, and fix crawl blockers.",
	keywords: ["get indexed on bing", "bing indexing", "bing webmaster tools", "indexnow bing", "submit url to bing", "bing not indexing"],
});

const faqs: FaqItem[] = [
	{
		question: "How do I submit a URL to Bing?",
		answer:
			"Use the URL Submission tool in Bing Webmaster Tools for a few URLs, the Webmaster API (SubmitUrlBatch) for batches within your daily quota, or IndexNow to notify Bing automatically whenever a URL changes.",
	},
	{
		question: "Is IndexNow enough for Bing?",
		answer:
			"For discovery, usually yes: Bing processes IndexNow pings directly. Still verify the site in Bing Webmaster Tools so you can see crawl errors, index coverage and your submission quota.",
	},
	{
		question: "Does Bing indexing affect AI answers?",
		answer:
			"Microsoft Copilot answers draw on Bing's index, and DuckDuckGo, Yahoo and Ecosia show results from Bing. A page that is missing from Bing is harder for those surfaces to find and cite.",
	},
	{
		question: "Why does Bing not index my page?",
		answer:
			"Check the basics first: the URL must return 200, must not carry noindex, must not canonicalise to another URL and must not be blocked for bingbot in robots.txt. Bing also skips pages it considers thin or duplicate.",
	},
];

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Blog", url: `${SITE_URL}/blog` },
	{ name: "How to get indexed on Bing", url: `${SITE_URL}/blog/${SLUG}` },
];

export default function BingIndexingPost() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(SLUG, TITLE)) }} />
				<PostShell
					slug={SLUG}
					category="Bing"
					title="How to get your pages indexed on Bing (and into AI answers that use it)"
					lede="To get pages indexed on Bing: verify your site in Bing Webmaster Tools, submit a clean XML sitemap, and notify Bing of every new or changed URL with IndexNow. Bing still decides what to index, but these steps remove the discovery delay, and Bing coverage now matters beyond Bing itself."
					outline={[
						{ id: "why", label: "Why Bing matters more than its market share" },
						{ id: "verify", label: "1. Verify in Bing Webmaster Tools" },
						{ id: "sitemap", label: "2. Submit a clean sitemap" },
						{ id: "indexnow", label: "3. Push changes with IndexNow" },
						{ id: "api", label: "4. Use the Webmaster API for batches" },
						{ id: "blockers", label: "5. Fix crawl blockers" },
						{ id: "faq", label: "Frequently asked questions" },
					]}
				>
					<h2 id="why">Why Bing matters more than its market share</h2>
					<p>
						Bing&apos;s index does not only serve bing.com. Microsoft Copilot grounds its answers in Bing search, and DuckDuckGo, Yahoo
						and Ecosia show results that come from Bing. If your pages are not in Bing, every one of those surfaces has a harder time
						finding them. For a new site, Bing is often also the fastest engine to pick up changes, because it accepts push
						notifications through IndexNow.
					</p>

					<h2 id="verify">1. Verify in Bing Webmaster Tools</h2>
					<p>
						Sign in to <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer">Bing Webmaster Tools</a>{" "}
						and add your site. The quickest path is <strong>Import from Google Search Console</strong>, which brings over verified
						sites and sitemaps in one step. Otherwise verify with an XML file, a meta tag or a DNS record.
					</p>

					<h2 id="sitemap">2. Submit a clean sitemap</h2>
					<p>
						Submit your XML sitemap under <strong>Sitemaps</strong>. Keep it clean: only canonical URLs that return 200 and are
						not blocked or noindexed, with a <code>lastmod</code> that changes only when the content does. Use the{" "}
						<Link href="/tools/sitemap-url-extractor">Sitemap URL Extractor</Link> to see exactly what your sitemap lists.
					</p>

					<h2 id="indexnow">3. Push changes with IndexNow</h2>
					<p>
						IndexNow is an open protocol run by Bing and other engines. You host a key file at your site root, then POST changed URLs
						to <code>https://api.indexnow.org/indexnow</code>. Participating engines share the ping, so one request reaches Bing,
						Yandex, Seznam, Naver and others.
					</p>
					<ul>
						<li>
							Generate a key with the <Link href="/tools/indexnow-key-generator">IndexNow Key Generator</Link> and host it as{" "}
							<code>https://your-site.com/&lt;key&gt;.txt</code>.
						</li>
						<li>Send a URL when it is created, meaningfully updated or deleted. Do not resend unchanged URLs.</li>
						<li>
							Test a few URLs with the free <Link href="/tools/bing-indexnow-submitter">Bing IndexNow Submitter</Link>.
						</li>
					</ul>
					<p>
						Full walkthrough: <Link href="/blog/indexnow-key-setup">How to set up and verify an IndexNow key</Link>.
					</p>

					<h2 id="api">4. Use the Webmaster API for batches</h2>
					<p>
						The Bing Webmaster API (<code>SubmitUrlBatch</code>) accepts batches of URLs within a daily quota that Bing sets per site.
						You need an API key from Bing Webmaster Tools (Settings, API access). See{" "}
						<Link href="/blog/bing-webmaster-api-key">how to find and use your Bing Webmaster API key</Link> and the{" "}
						<Link href="/resources/search-engines/bing">Bing submission reference</Link> for endpoints and limits.
					</p>

					<h2 id="blockers">5. Fix crawl blockers</h2>
					<ul>
						<li>
							<strong>robots.txt:</strong> make sure <code>bingbot</code> is not disallowed. The{" "}
							<Link href="/tools/robots-txt-checker">Robots.txt Checker</Link> shows which group applies.
						</li>
						<li>
							<strong>noindex and canonical:</strong> a stray noindex or a canonical to another URL keeps a page out. Check with the{" "}
							<Link href="/tools/noindex-tag-checker">Noindex</Link> and <Link href="/tools/canonical-checker">Canonical</Link>{" "}
							checkers.
						</li>
						<li>
							<strong>Bot protection:</strong> a CDN or WAF that challenges bots can block bingbot and the IndexNow key check. Allow
							verified search engine bots.
						</li>
					</ul>
					<p>
						IndexFast does steps 3 and 4 for you: it reads your sitemap, queues new and changed URLs, sends them through IndexNow on
						every plan and through the Bing Webmaster API on paid plans with your own key, and backs off when Bing rate-limits.
					</p>

					<PostFaq items={faqs} />
				</PostShell>
			</main>
			<Footer />
		</>
	);
}
