import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { PostShell } from "../_components/PostShell";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Blog", url: `${SITE_URL}/blog` },
	{ name: "How to Set Up and Verify an IndexNow Key", url: `${SITE_URL}/blog/indexnow-key-setup` },
];

const articleJsonLd = {
	"@context": "https://schema.org",
	"@type": "Article",
	headline: "How to Set Up and Verify an IndexNow Key: The Complete Guide",
	description:
		"Step-by-step instructions for generating an IndexNow API key, hosting the verification file on your server, and submitting URLs to search engines as soon as they change.",
	image: `${SITE_URL}/og-image.png`,
	datePublished: "2026-06-03",
	dateModified: "2026-06-03",
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
	mainEntityOfPage: `${SITE_URL}/blog/indexnow-key-setup`,
};

const faqJsonLd = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: [
		{
			"@type": "Question",
			name: "What is an IndexNow key?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "An IndexNow key is a unique 8-128 character hexadecimal or alphanumeric string that proves ownership of your domain. You generate it and host it as a text file at the root of your site.",
			},
		},
		{
			"@type": "Question",
			name: "Where should the IndexNow key file be hosted?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "It must be hosted in the root directory of your website's host (e.g., https://example.com/your-key.txt). The file must return a 200 OK status code and contain the key string inside it.",
			},
		},
		{
			"@type": "Question",
			name: "How does IndexNow communicate URL submissions across multiple search engines?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "IndexNow uses a shared notification model. When you submit a list of updated URLs to any participating search engine's endpoint (e.g., Bing), that search engine automatically broadcasts the request to all other participating search engines.",
			},
		},
		{
			"@type": "Question",
			name: "Can I use IndexNow with subdomains?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Yes. However, the key file must be hosted at the root of the specific subdomain you are submitting URLs for. For example, if you submit blog.example.com URLs, the key file must be at https://blog.example.com/your-key.txt.",
			},
		},
		{
			"@type": "Question",
			name: "Does IndexNow work if my site is behind a CDN like Cloudflare?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Yes. However, you must ensure that your CDN or firewall does not block HTTP GET requests from search engine user-agents trying to read your key verification file, and that it does not redirect the request.",
			},
		},
	],
};

export const metadata: Metadata = {
	title: "How to Set Up and Verify an IndexNow Key",
	description:
		"Learn how to generate, host, and verify your IndexNow API key so you can notify Bing and other search engines as soon as URLs change.",
	keywords: [
		"indexnow key setup",
		"indexnow verification",
		"indexnow protocol",
		"how to verify indexnow",
		"generate indexnow key",
		"indexnow submission",
		"technical seo",
	],
	alternates: {
		canonical: `${SITE_URL}/blog/indexnow-key-setup`,
	},
	openGraph: {
		title: "How to Set Up and Verify an IndexNow Key",
		description:
			"An exhaustive guide to the IndexNow protocol, explaining why instant URL submissions are necessary, who supports it, and how to verify your domain key.",
		images: [`${SITE_URL}/og-image.png`],
	},
	twitter: {
		card: "summary_large_image",
		title: "How to Set Up and Verify an IndexNow Key",
		description:
			"An exhaustive guide to the IndexNow protocol, explaining why instant URL submissions are necessary, who supports it, and how to verify your domain key.",
	},
};

export default function IndexNowKeyPost() {
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
				<PostShell
					slug="indexnow-key-setup"
					category="SEO Guide"
					title="How to set up and verify an IndexNow key"
					lede="Tired of waiting for search engines to crawl your sitemaps? The IndexNow protocol allows you to instantly notify engines about new pages. Here is the complete guide on generating, hosting, and verifying your IndexNow key."
					outline={[{"id":"what","label":"What is the IndexNow protocol?"},{"id":"why","label":"Why is IndexNow a game-changer for crawling?"},{"id":"who","label":"Who supports the IndexNow protocol?"},{"id":"where","label":"Where should the key be hosted?"},{"id":"when","label":"When does IndexNow trigger submissions?"},{"id":"how","label":"How to generate and verify your key, step by step"},{"id":"faq","label":"Frequently asked questions"},{"id":"citations","label":"References and official citations"}]}
				>

					{/* WHAT */}
					<h2 id="what">What is the IndexNow protocol?</h2>
					<p>
						<strong>IndexNow</strong> is a simple, lightweight HTTP protocol designed to allow website owners to instantly notify participating search engines about recent content changes on their site.
					</p>
					<p>
						Instead of waiting for crawl engines to periodically download and check sitemaps, IndexNow enables websites to push a list of new, modified, or deleted URLs directly. This ensures that search index states are updated in near real-time, greatly improving user discovery times.
					</p>

					{/* WHY */}
					<h2 id="why">Why is IndexNow a game-changer for crawling?</h2>
					<p>
						For decades, the search engine indexing model has been pull-based. Search engines used automated bots (like Bingbot) to crawl the web, following links and downloading sitemaps. While this works, it is highly inefficient:
					</p>
					<ul>
						<li><strong>Excessive Bandwidth</strong>: Crawlers spend bandwidth downloading pages that haven't changed.</li>
						<li><strong>Delayed Discovery</strong>: New, highly relevant content can remain undiscovered for weeks.</li>
						<li><strong>Server Overhead</strong>: High bot traffic can degrade server performance, particularly on shared hosting.</li>
					</ul>
					<p>
						IndexNow flips this model into a <strong>push-based</strong> system. By sending a quick HTTP request, you let search engines know exactly which URLs require crawling. This optimizes search engine resource usage, minimizes unnecessary crawl requests on your server, and prioritizes indexing for fresh content.
					</p>

					{/* WHO */}
					<h2 id="who">Who supports the IndexNow protocol?</h2>
					<p>
						IndexNow is an open standard spearheaded by <strong>Microsoft Bing</strong> and <strong>Yandex</strong>. It is also supported by <strong>Seznam</strong> and other search platforms. 
					</p>
					<p>
						One of the best design choices of the IndexNow standard is the <strong>shared notification broadcast</strong>. When you submit a list of updated URLs to any participating search engine (such as Bing's endpoint), that engine automatically broadcasts the notification to all other participating search engines. This means you only need to submit once, and all supported search engines are notified simultaneously.
					</p>

					{/* WHERE */}
					<h2 id="where">Where should the key be hosted?</h2>
					<p>
						To prevent malicious actors from submitting URLs they do not own, IndexNow requires verification. You must host a plain text file named exactly after your key at the root of your domain.
					</p>
					<p>
						For example, if your domain is <code>example.com</code> and your key is <code>87e1a3bc86d4</code>, the file must be accessible at:
						<br />
						<code>https://example.com/87e1a3bc86d4.txt</code>
					</p>
					<p>
						When you submit a URL list, the search engine will make a verification request to this URL. It checks that the file returns an HTTP 200 OK status code and that the body contains the exact key string.
					</p>

					{/* WHEN */}
					<h2 id="when">When does IndexNow trigger submissions?</h2>
					<p>
						You should trigger an IndexNow submission whenever content on your site changes. In an automated setup like IndexFast, these submissions trigger in three main scenarios:
					</p>
					<ul>
						<li><strong>New Content</strong>: A new page URL is detected in your XML sitemap.</li>
						<li><strong>Updated Content</strong>: The <code>lastmod</code> date or sitemap entry for a page changes, indicating an update.</li>
						<li><strong>Manual Priority</strong>: You manually push a URL from your dashboard or CLI to fix a crawl error.</li>
					</ul>

					{/* HOW */}
					<h2 id="how">How to generate and verify your key, step by step</h2>
					<p>
						Follow this step-by-step workflow to verify your domain and enable automation:
					</p>
					
					<h3>1. Generate an API key</h3>
					<p>
						Your key must be an alphanumeric or hexadecimal string between 8 and 128 characters. You can generate one automatically in IndexFast, or write a custom string.
					</p>

					<h3>2. Host the verification file</h3>
					<p>
						Create a file named <code>your-key.txt</code> and paste the key inside it. Upload this to the root of your web server. Ensure that:
					</p>
					<ul>
						<li>The URL does not redirect. A <code>301</code> or <code>302</code> redirect to a landing page or trailing slash will cause verification to fail.</li>
						<li>The file is served as <code>text/plain</code> and contains <em>only</em> the key string (no trailing newlines or spaces).</li>
					</ul>

					<h3>3. Verify in IndexFast</h3>
					<p>
						IndexFast generates the key for you when you add your site. Deploy the file it shows, then open your site in the IndexFast dashboard and choose <strong>Verify and turn on auto-submit</strong>. IndexFast fetches the file live. Once verified, sitemap updates trigger automatic pushes. If you already host a key, choose <strong>Use my key and verify</strong> instead.
					</p>

					{/* FAQ */}
					<h2 id="faq">Frequently asked questions</h2>
					
					<h3>Q1: Can I use the same IndexNow key for multiple websites?</h3>
					<p>
						Yes, you can use the same key across multiple domains. However, you must host a separate copy of the key text file at the root of <em>each</em> website. For example, if you manage <code>domainA.com</code> and <code>domainB.com</code> with the same key <code>abc123xyz</code>, you must upload the file <code>abc123xyz.txt</code> to the root of both websites.
					</p>

					<h3>Q2: Why does my key verification fail if I am using Cloudflare?</h3>
					<p>
						Cloudflare and other CDNs can sometimes block verification requests if they trigger bot protection rules, or if they inject HTML wrappers. Check your Cloudflare WAF logs to verify that crawler requests (e.g. from Bingbot or IndexNow) to your key file URL return a clean 200 OK.
					</p>

					<h3>Q3: How do I manage IndexNow for subdomains?</h3>
					<p>
						IndexNow treats subdomains as distinct hosts. If your site has URLs on <code>blog.example.com</code> and <code>shop.example.com</code>, you must generate and verify keys for both subdomains, hosting the key files at <code>blog.example.com/key.txt</code> and <code>shop.example.com/key.txt</code> respectively.
					</p>

					<h3>Q4: Does Google support IndexNow?</h3>
					<p>
						Google is currently investigating the IndexNow standard and has run trials. However, Google's main production crawler does not support IndexNow. For Google, you should continue using optimized XML sitemaps or Google Search Console inspection tools.
					</p>

					{/* CITATIONS */}
					<h2 id="citations">References and official citations</h2>
					<p>
						For the official specifications and engine guides, refer to these links:
					</p>
					<ul>
						<li>
							<Link href="https://www.indexnow.org" target="_blank" rel="noopener noreferrer">
								IndexNow.org: Official Specification and Protocols
							</Link>
						</li>
						<li>
							<Link href="https://blogs.bing.com/webmaster/october-2021/Introducing-IndexNow-Instant-Indexing-for-Websites" target="_blank" rel="noopener noreferrer">
								Microsoft Bing Blog: Introducing IndexNow Instant Indexing
							</Link>
						</li>
						<li>
							<Link href="https://www.bing.com/webmasters/help/indexnow-api-c1e1e075" target="_blank" rel="noopener noreferrer">
								Bing Webmaster Help: Setting Up IndexNow API
							</Link>
						</li>
					</ul>
				</PostShell>
			</main>
			<Footer />
		</>
	);
}
