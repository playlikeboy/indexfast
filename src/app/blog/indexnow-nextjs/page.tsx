/*
 * Blog post: IndexNow on Next.js, the stack most IndexFast users ship with. Answer-first lede,
 * protocol facts from indexnow.org (payload, batch size, response codes), and a script readers can
 * run without IndexFast. No claim that a ping leads to indexing, and no claim about Google.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { CodeBlock } from "@/components/ui";
import { PostShell } from "../_components/PostShell";
import { PostFaq, type FaqItem } from "../_components/PostFaq";
import { SITE_URL, articleJsonLd, withPageSeo } from "@/lib/seo";

const SLUG = "indexnow-nextjs";
const TITLE = "How to Set Up IndexNow on a Next.js Site";

export const metadata: Metadata = withPageSeo(`/blog/${SLUG}`, {
	title: "How to Set Up IndexNow on Next.js (Key File + Deploy Ping)",
	description:
		"Add IndexNow to a Next.js site: host the key in public/, check it is served without redirects, and ping IndexNow after each deploy with a copy-paste script.",
	keywords: ["indexnow nextjs", "next.js indexnow", "indexnow key file", "indexnow api", "nextjs seo indexing", "vercel indexnow"],
});

const verifyCommand = `curl -sI https://your-site.com/0f1e2d3c4b5a69788796a5b4c3d2e1f0.txt
# Expect: HTTP/2 200, content-type: text/plain, and no "location:" header`;

const pingScript = `// scripts/indexnow.mjs: run after a deploy, e.g. "node scripts/indexnow.mjs"
const host = "your-site.com";
const key = process.env.INDEXNOW_KEY; // the same string as public/<key>.txt
const urlList = process.argv.slice(2); // changed URLs, absolute, on this host only

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host,
    key,
    keyLocation: \`https://\${host}/\${key}.txt\`,
    urlList, // up to 10,000 URLs per request
  }),
});
console.log(res.status); // 200 or 202 = received`;

const faqs: FaqItem[] = [
	{
		question: "Where does the IndexNow key file go in Next.js?",
		answer:
			"In the public/ folder. Next.js serves public/<key>.txt at https://your-site.com/<key>.txt. Check that middleware, i18n routing or trailing-slash rules do not redirect it.",
	},
	{
		question: "Should I ping every URL on every deploy?",
		answer:
			"No. Send only URLs that were created, meaningfully updated or deleted. Resending unchanged URLs wastes your quota and can get requests throttled with HTTP 429.",
	},
	{
		question: "Does IndexNow work with Vercel or Cloudflare?",
		answer:
			"Yes. The host does not matter as long as the key file returns 200 with the key as plain text and bot protection does not challenge the engines that fetch it.",
	},
	{
		question: "Does Google support IndexNow?",
		answer:
			"No. Google does not use IndexNow. Keep a clean sitemap (app/sitemap.ts in Next.js) and use Search Console for Google.",
	},
];

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Blog", url: `${SITE_URL}/blog` },
	{ name: "IndexNow on Next.js", url: `${SITE_URL}/blog/${SLUG}` },
];

export default function IndexNowNextjsPost() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(SLUG, TITLE)) }} />
				<PostShell
					slug={SLUG}
					category="IndexNow"
					title="How to set up IndexNow on a Next.js site"
					lede="Put your IndexNow key in public/<key>.txt, confirm it is served with status 200 and no redirect, then POST changed URLs to api.indexnow.org after each deploy. That notifies Bing, Yandex, Seznam, Naver and other participating engines. It does not reach Google, and engines still decide what to index."
					outline={[
						{ id: "key", label: "1. Create and host the key" },
						{ id: "check", label: "2. Check it is served cleanly" },
						{ id: "ping", label: "3. Ping after each deploy" },
						{ id: "responses", label: "Response codes" },
						{ id: "automate", label: "Automating it from your sitemap" },
						{ id: "faq", label: "Frequently asked questions" },
					]}
				>
					<h2 id="key">1. Create and host the key</h2>
					<p>
						An IndexNow key is 8 to 128 characters of letters, digits and dashes. Generate one with the{" "}
						<Link href="/tools/indexnow-key-generator">IndexNow Key Generator</Link>, then create a file in your project at{" "}
						<code>public/&lt;key&gt;.txt</code> whose only content is the key. Next.js serves everything in <code>public/</code> from
						the site root, so the file becomes <code>https://your-site.com/&lt;key&gt;.txt</code>.
					</p>

					<h2 id="check">2. Check it is served cleanly</h2>
					<p>
						Engines fetch the key file to confirm you own the host. The most common failure is a redirect: middleware that adds a
						locale prefix, a <code>trailingSlash</code> rule, or a redirect from the apex domain to <code>www</code>. The key must live
						on the exact host you submit URLs for.
					</p>
					<CodeBlock title="terminal" code={verifyCommand} />

					<h2 id="ping">3. Ping after each deploy</h2>
					<p>
						Send the URLs that changed in this deploy. All URLs in one request must be on the same host as the key. You can derive the
						list from your build (for example, the routes whose content changed) or from your sitemap&apos;s <code>lastmod</code>{" "}
						values.
					</p>
					<CodeBlock title="scripts/indexnow.mjs" code={pingScript} />

					<h2 id="responses">Response codes</h2>
					<table>
						<thead>
							<tr>
								<th>Status</th>
								<th>Meaning</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>200 / 202</td>
								<td>Received. 202 means the key is still being validated.</td>
							</tr>
							<tr>
								<td>400</td>
								<td>Bad request, usually malformed JSON.</td>
							</tr>
							<tr>
								<td>403</td>
								<td>Key not valid: the file was missing, redirected or did not match.</td>
							</tr>
							<tr>
								<td>422</td>
								<td>URLs do not belong to the host, or the key does not match the schema.</td>
							</tr>
							<tr>
								<td>429</td>
								<td>Too many requests. Back off and retry later.</td>
							</tr>
						</tbody>
					</table>
					<p>
						Source: <a href="https://www.indexnow.org/documentation" target="_blank" rel="noopener noreferrer">IndexNow documentation</a>.
					</p>

					<h2 id="automate">Automating it from your sitemap</h2>
					<p>
						A deploy script works until you forget which URLs changed, or a burst of pings gets throttled. IndexFast does this from
						your sitemap instead: add your domain, host the key file it generates in <code>public/</code>, and it syncs the sitemap
						on a schedule, sends only new and changed URLs, and parks the queue when an engine answers 429 instead of failing. AI
						agents in Claude Code or Cursor can drive the same workflow through the{" "}
						<Link href="/resources/skill">IndexFast MCP server and SKILL.md</Link>.
					</p>

					<PostFaq items={faqs} />
				</PostShell>
			</main>
			<Footer />
		</>
	);
}
