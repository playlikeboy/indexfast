/*
 * Blog post: the two Search Console exclusions people search for most. Answer-first (the lede
 * defines both statuses), technical blockers before content advice, and no promise that any
 * action gets a page indexed. Date and read time live in blogPosts (marketing-data.ts).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { PostShell } from "../_components/PostShell";
import { PostFaq, type FaqItem } from "../_components/PostFaq";
import { SITE_URL, articleJsonLd, withPageSeo } from "@/lib/seo";

const SLUG = "discovered-currently-not-indexed";
const TITLE = "Discovered or Crawled, Currently Not Indexed: What It Means and How to Fix It";

export const metadata: Metadata = withPageSeo(`/blog/${SLUG}`, {
	title: "Discovered or Crawled, Currently Not Indexed: Fixes",
	description:
		"What \"Discovered - currently not indexed\" and \"Crawled - currently not indexed\" mean in Google Search Console, how they differ, and the fix order that works.",
	keywords: [
		"discovered currently not indexed",
		"crawled currently not indexed",
		"search console not indexed",
		"page not indexed google",
		"fix discovered not indexed",
	],
});

const faqs: FaqItem[] = [
	{
		question: "Is \"Discovered - currently not indexed\" a penalty?",
		answer:
			"No. It means Google knows the URL exists and has not crawled it yet. It is a queue state, not a manual action. Manual actions are listed separately in Search Console.",
	},
	{
		question: "How long does it take for a discovered page to be crawled?",
		answer:
			"Google does not publish a timeline. New sites and sites with many low-value URLs often wait longer. Internal links from pages that are already indexed are the strongest signal you control.",
	},
	{
		question: "Does requesting indexing in Search Console fix it?",
		answer:
			"It can prompt a crawl of one URL, but it is limited to a small number of requests per day and does not guarantee indexing. Fix blockers and internal links first, then request indexing for the most important pages.",
	},
	{
		question: "Will IndexNow help with Google?",
		answer:
			"No. Google does not use IndexNow. IndexNow helps Bing, Yandex, Seznam, Naver and other participating engines discover the same pages faster.",
	},
];

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Blog", url: `${SITE_URL}/blog` },
	{ name: "Discovered or crawled, currently not indexed", url: `${SITE_URL}/blog/${SLUG}` },
];

export default function DiscoveredNotIndexedPost() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(SLUG, TITLE)) }} />
				<PostShell
					slug={SLUG}
					category="Search Console"
					title="Discovered or crawled, currently not indexed: what it means and how to fix it"
					lede="Discovered - currently not indexed means Google knows a URL but has not fetched it yet. Crawled - currently not indexed means Google fetched it and decided not to index it for now. The first is usually about crawl demand and links; the second is usually about blockers or page value. Neither is a penalty."
					outline={[
						{ id: "difference", label: "The difference in one table" },
						{ id: "discovered", label: "Fixing discovered, not indexed" },
						{ id: "crawled", label: "Fixing crawled, not indexed" },
						{ id: "order", label: "A fix order that works" },
						{ id: "faq", label: "Frequently asked questions" },
					]}
				>
					<h2 id="difference">The difference in one table</h2>
					<table>
						<thead>
							<tr>
								<th>Status</th>
								<th>What Google did</th>
								<th>Usual cause</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>Discovered - currently not indexed</td>
								<td>Found the URL, postponed the crawl</td>
								<td>Low crawl demand, weak internal links, many similar URLs, slow server</td>
							</tr>
							<tr>
								<td>Crawled - currently not indexed</td>
								<td>Fetched the page, did not add it</td>
								<td>Duplicate or thin content, soft 404, canonical pointing elsewhere</td>
							</tr>
						</tbody>
					</table>
					<p>
						Both appear in the Pages report in Google Search Console under <strong>Why pages aren&apos;t indexed</strong>. Open a
						URL with URL Inspection to see the last crawl date, the canonical Google chose, and whether the page is in a sitemap.
					</p>

					<h2 id="discovered">Fixing discovered, not indexed</h2>
					<p>Google has the URL in its queue. Your job is to make the crawl worth Google&apos;s time.</p>
					<ul>
						<li>
							<strong>Link to it from indexed pages.</strong> A URL that only lives in a sitemap gets little crawl priority. Add
							links from your home page, hub pages or related posts.
						</li>
						<li>
							<strong>Cut low-value URLs.</strong> Faceted filters, tag pages and parameter variants dilute crawl demand. Keep them
							out of the sitemap and canonicalise them.
						</li>
						<li>
							<strong>Check server speed and errors.</strong> If Googlebot sees slow responses or 5xx errors, it crawls less. The
							Crawl stats report in Search Console shows this.
						</li>
						<li>
							<strong>Keep the sitemap honest.</strong> List only canonical, indexable URLs that return 200, with a real{" "}
							<code>lastmod</code>.
						</li>
					</ul>

					<h2 id="crawled">Fixing crawled, not indexed</h2>
					<p>Google saw the page. Rule out technical reasons before you rewrite anything.</p>
					<ul>
						<li>
							<strong>noindex:</strong> a meta robots tag or an <code>X-Robots-Tag</code> header. Check with the{" "}
							<Link href="/tools/noindex-tag-checker">Noindex Tag Checker</Link>.
						</li>
						<li>
							<strong>Canonical:</strong> a canonical pointing to another URL tells Google to index that one instead. Check with the{" "}
							<Link href="/tools/canonical-checker">Canonical Checker</Link>.
						</li>
						<li>
							<strong>Soft 404:</strong> an empty template, an out-of-stock page with no content, or an error message served with
							status 200.
						</li>
						<li>
							<strong>Duplicates:</strong> programmatic pages that differ only by a city name or a keyword. Add data or text that
							is unique to each page, or merge them.
						</li>
					</ul>

					<h2 id="order">A fix order that works</h2>
					<ol>
						<li>
							Run the affected URLs through the <Link href="/tools/bulk-index-checker">Bulk Index Checker</Link> to catch status,
							redirect, noindex and canonical problems in one pass.
						</li>
						<li>Fix template-level problems first: one bad rule can affect thousands of pages.</li>
						<li>Add internal links from pages that are already indexed.</li>
						<li>Keep only canonical, indexable URLs in the sitemap and resubmit it in Search Console.</li>
						<li>Use URL Inspection and Request indexing for the handful of pages that matter most.</li>
						<li>
							Notify Bing and other IndexNow engines at the same time, so the rest of the web is not waiting on Google.
						</li>
					</ol>
					<p>
						IndexFast automates the repetitive parts: it reads your sitemap on a schedule, sends new and changed URLs to IndexNow,
						inspects URLs through the Search Console API once you connect Google, and runs indexability diagnostics on demand from
						the dashboard, the API or an AI agent over MCP. It cannot make Google index a page; nothing can.
					</p>

					<PostFaq items={faqs} />
				</PostShell>
			</main>
			<Footer />
		</>
	);
}
