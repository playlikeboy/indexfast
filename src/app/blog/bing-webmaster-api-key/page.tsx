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
	{ name: "How to Find and Use your Bing Webmaster API Key", url: `${SITE_URL}/blog/bing-webmaster-api-key` },
];

const articleJsonLd = {
	"@context": "https://schema.org",
	"@type": "Article",
	headline: "How to Find and Use your Bing Webmaster API Key: The Complete Guide",
	description:
		"Learn what the Bing Webmaster Tools API key is, why it is necessary for search index automation, and how to configure and verify it step-by-step.",
	image: `${SITE_URL}/og-image.png`,
	datePublished: "2026-06-05",
	dateModified: "2026-06-05",
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
	mainEntityOfPage: `${SITE_URL}/blog/bing-webmaster-api-key`,
};

const faqJsonLd = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: [
		{
			"@type": "Question",
			name: "Where can I find my Bing Webmaster Tools API key?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Log in to the Bing Webmaster Tools portal, click the gear icon in the top right to open Settings, navigate to API Access, and choose API Key. You can generate or copy your key from that section.",
			},
		},
		{
			"@type": "Question",
			name: "Is the Bing Webmaster API key per-site or per-user?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "It is a user-level key. Once generated, the same API key can manage and submit URLs for any and all websites verified under that particular Bing Webmaster Tools account.",
			},
		},
		{
			"@type": "Question",
			name: "How many URLs can I submit daily using the Bing Webmaster API?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "For most verified websites, Bing offers a generous daily submission limit of up to 10,000 URLs. You can query your remaining quota using the API's GetUrlSubmissionQuota endpoint.",
			},
		},
		{
			"@type": "Question",
			name: "What does the 'InvalidParameter' error mean in Bing Webmaster Tools?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "This error occurs when the URL hostname or format sent to the API does not match the exact hostname of the verified site registered in Bing Webmaster Tools. Check for protocol mismatches (http vs. https) or www subdomain mismatches.",
			},
		},
	],
};

export const metadata: Metadata = {
	title: "How to Find and Use your Bing Webmaster API Key",
	description:
		"Learn how to generate your Bing Webmaster Tools API key, configure search discovery pipelines, and troubleshoot validation errors so search engines are notified as soon as your pages change.",
	keywords: [
		"bing webmaster api key",
		"bing api key",
		"how to find bing api key",
		"bing indexing api",
		"bing webmaster tools",
		"indexfast bing integration",
		"automated indexing",
	],
	alternates: {
		canonical: `${SITE_URL}/blog/bing-webmaster-api-key`,
	},
	openGraph: {
		title: "How to Find and Use your Bing Webmaster API Key",
		description:
			"An in-depth guide answering what the Bing Webmaster Tools API key is, why you need it to automate indexing, and how to configure it step-by-step.",
		images: [`${SITE_URL}/og-image.png`],
	},
	twitter: {
		card: "summary_large_image",
		title: "How to Find and Use your Bing Webmaster API Key",
		description:
			"An in-depth guide answering what the Bing Webmaster Tools API key is, why you need it to automate indexing, and how to configure it step-by-step.",
	},
};

export default function BingApiKeyPost() {
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
					slug="bing-webmaster-api-key"
					category="SEO Guide"
					title="How to find and use your Bing Webmaster API key"
					lede="Looking to automate your URL submissions to Bing? You need an API key. Here is the complete walkthrough on how to generate, verify, and integrate your Bing Webmaster Tools API Key with third-party software like IndexFast."
					outline={[{"id":"what","label":"What is the Bing Webmaster Tools API key?"},{"id":"why","label":"Why is it necessary for modern SEO?"},{"id":"who","label":"Who needs to configure this key?"},{"id":"when","label":"When should you rotate or regenerate the key?"},{"id":"where","label":"Where to find your API key, step by step"},{"id":"how","label":"How to integrate and automate submissions"},{"id":"faq","label":"Frequently asked questions"},{"id":"citations","label":"References and official citations"}]}
				>

					{/* WHAT */}
					<h2 id="what">What is the Bing Webmaster Tools API key?</h2>
					<p>
						The <strong>Bing Webmaster Tools API Key</strong> is a unique, 32-character hexadecimal credential that identifies your user account to Microsoft's search crawler engine. Unlike standard API tokens that are issued for individual domains, the Bing API key is <strong>user-level</strong>. This means once you generate it, you can use the same key to programmatically manage and submit URLs for every website verified inside your Webmaster Tools account.
					</p>
					<p>
						This key acts as a secure bridge, allowing automated programs, CLI scripts, and indexing platforms (like IndexFast) to talk directly to Bing's index without requiring you to manually log into their web portal every time you publish new content.
					</p>

					{/* WHY */}
					<h2 id="why">Why is it necessary for modern SEO?</h2>
					<p>
						In SEO, speed is everything. When you publish a new blog post, launch a programmatic SEO directory, or update an ecommerce product catalog, you want search engine users to find it immediately.
					</p>
					<p>
						Historically, webmasters relied on "passive discovery" — submitting a sitemap and waiting for search engine crawlers to periodically download and parse it. This passive model has massive drawbacks:
					</p>
					<ul>
						<li><strong>High Delays</strong>: Crawlers might take days or even weeks to discover and index deep pages.</li>
						<li><strong>Crawl Budget Waste</strong>: Crawlers waste bandwidth re-scanning unchanged pages.</li>
						<li><strong>Loss of Traffic</strong>: If your pages aren't indexed, they generate zero organic traffic, leaving money on the table.</li>
					</ul>
					<p>
						The Bing Webmaster API solves this by enabling "active submission." Instead of waiting, your site <strong>actively pushes</strong> the updated URLs to Bing. The search engine schedules an immediate priority crawl, often indexing your fresh content within seconds.
					</p>

					{/* WHO */}
					<h2 id="who">Who needs to configure this key?</h2>
					<p>
						You need to generate and configure a Bing Webmaster API key if you are:
					</p>
					<ul>
						<li><strong>SaaS Founders & developers</strong>: Building programmatic SEO sites that publish hundreds of pages daily.</li>
						<li><strong>SEO Agencies</strong>: Managing index health for multiple client sites.</li>
						<li><strong>Marketing teams</strong>: Responsible for launching new campaigns or product catalogs that need new pages discovered quickly.</li>
						<li><strong>Platform operators</strong>: Looking to hook up automated tools (like IndexFast or Cursor MCP servers) to manage indexing pipelines programmatically.</li>
					</ul>

					{/* WHEN */}
					<h2 id="when">When should you rotate or regenerate the key?</h2>
					<p>
						Security is paramount. Because the API key grants full write-access to submit URLs and read crawl stats for <em>all</em> your verified websites, you should treat it as a secret password.
					</p>
					<p>
						You should rotate or regenerate your API key in the following events:
					</p>
					<ul>
						<li><strong>Accidental exposure</strong>: If you accidentally commit the API key in plain text to a public GitHub repository.</li>
						<li><strong>Personnel changes</strong>: If a team member or agency partner who had access to the key leaves the company.</li>
						<li><strong>Regular hygiene</strong>: Rotating credentials every 90-180 days is an excellent security best practice to mitigate long-term leak risks.</li>
					</ul>

					{/* WHERE */}
					<h2 id="where">Where to find your API key, step by step</h2>
					<p>
						Follow these steps to find and generate your key inside the official portal:
					</p>
					<ol>
						<li>
							Go to the official <Link href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer">Bing Webmaster Tools Portal</Link> and log in.
						</li>
						<li>
							Select any site from your dashboard list. (Remember, the key is user-level, so selecting any site will work).
						</li>
						<li>
							Click the <strong>Settings</strong> (gear) icon in the top-right corner of the window.
						</li>
						<li>
							In the Settings navigation menu, locate the <strong>API Access</strong> group and click <strong>API Key</strong>.
						</li>
						<li>
							If this is your first time, you will be prompted to accept the Terms of Service. Click <strong>Generate API Key</strong>.
						</li>
						<li>
							Copy the 32-character alphanumeric key string and save it securely.
						</li>
					</ol>

					{/* HOW */}
					<h2 id="how">How to integrate and automate submissions</h2>
					<p>
						To connect your key to IndexFast for automated hourly submissions:
					</p>
					<ul>
						<li>Open your site in the IndexFast dashboard and choose <strong>Settings</strong>.</li>
						<li>Find <strong>Bing Webmaster API</strong>, paste your 32-character key and choose <strong>Connect and verify</strong>.</li>
						<li>IndexFast will automatically run a validation request against Bing's API using:
							<br />
							<code>https://ssl.bing.com/webmaster/api.svc/json/GetUrlSubmissionQuota</code>
						</li>
						<li>Once validated, IndexFast stores the key securely. From then on, any sitemap changes, new pages, or updated content will be pushed to Bing automatically.</li>
					</ul>

					{/* FAQ */}
					<h2 id="faq">Frequently asked questions</h2>
					
					<h3>Q1: Can I use the same API key for multiple websites?</h3>
					<p>
						Yes. Because the API key is associated with your Bing Webmaster user account, it can manage and submit URLs for any website verified in that account. There is no need to generate separate keys for different domains.
					</p>

					<h3>Q2: Why am I getting an 'InvalidParameter' error when validating the key?</h3>
					<p>
						This is the most common integration error. It occurs because the site URL you are trying to submit does not match the exact hostname registered inside your Bing Webmaster Tools. Check if the site is registered as <code>https://example.com</code> or <code>https://www.example.com</code> — they must match exactly.
					</p>

					<h3>Q3: How do I know how many URL submissions I have left today?</h3>
					<p>
						Bing resets your quota daily. You can view your remaining quota on the Bing Webmaster API row in your site's Settings in IndexFast, or by calling the <code>GetUrlSubmissionQuota</code> API endpoint. For most verified sites, the limit is 10,000 URLs per day.
					</p>

					<h3>Q4: Is the Bing Webmaster API key the same as the IndexNow key?</h3>
					<p>
						No. The Bing Webmaster API Key is a user-level secret used to authenticate programmatic requests to Bing's private endpoints. The IndexNow key is a domain-level verification key hosted publicly on your server (<code>/YOUR_KEY.txt</code>) and is shared across participating search engines (like Bing, Yandex, and Seznam).
					</p>

					{/* CITATIONS */}
					<h2 id="citations">References and official citations</h2>
					<p>
						For official documentation and further reading, refer to these resources:
					</p>
					<ul>
						<li>
							<Link href="https://learn.microsoft.com/en-us/bingwebmaster/api-overview" target="_blank" rel="noopener noreferrer">
								Microsoft Bing Webmaster Tools API Overview
							</Link>
						</li>
						<li>
							<Link href="https://learn.microsoft.com/en-us/bingwebmaster/url-submission-api" target="_blank" rel="noopener noreferrer">
								Microsoft Bing URL Submission API Specification
							</Link>
						</li>
						<li>
							<Link href="https://www.bing.com/webmasters/help/api-access-e1c25a07" target="_blank" rel="noopener noreferrer">
								Bing Webmaster Help Center: Managing API Access
							</Link>
						</li>
					</ul>
				</PostShell>
			</main>
			<Footer />
		</>
	);
}
