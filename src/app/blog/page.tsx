/*
 * /blog: the index of every guide, newest first, as a ruled list (the way a publication lists its
 * issues), not a card grid. Reads blogPosts only, so a post added there appears here, in its own
 * header and in the sitemap at once. BreadcrumbJsonLd stays for search results.
 */
import { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { Container } from "@/components/ui";
import { blogPosts } from "@/lib/marketing-data";

const SITE_URL = "https://indexfast.co";

export const metadata: Metadata = {
	title: "Blog | IndexFast",
	description:
		"Practical guides on indexing health, sitemap management, pSEO launch monitoring, and safe discovery workflows.",
};

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Blog", url: `${SITE_URL}/blog` },
];

function formatDate(iso: string) {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export default function BlogPage() {
	// ISO dates sort as strings; copy first so the shared array is never reordered in place.
	const posts = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date));

	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<header className="pt-16 pb-20">
					<Container>
						<div className="max-w-3xl">
							<h1 id="blog-heading" className="text-display-s">
								SEO and indexing guides
							</h1>
							<p className="mt-6 max-w-2xl text-lead text-ink-2">
								Indexing health, sitemaps, pSEO launches and safe discovery, explained plainly.
							</p>
						</div>
					</Container>
				</header>
				<section className="pb-(--section-gap)" id="blog" aria-labelledby="blog-heading">
					<Container>
						<ol className="border-t border-border-strong">
							{posts.map((post) => (
								<li key={post.slug} className="border-b border-border">
									<Link
										href={`/blog/${post.slug}`}
										className="group grid gap-2 py-6 md:grid-cols-[9rem_minmax(0,1fr)_7rem] md:gap-10"
									>
										<time dateTime={post.date} className="num text-sm text-muted md:pt-1">
											{formatDate(post.date)}
										</time>
										<div className="min-w-0">
											<h2 className="text-title font-medium text-ink underline decoration-transparent underline-offset-4 transition-colors duration-(--dur-short) group-hover:decoration-signal">
												{post.title}
											</h2>
											<span className="mt-2 block max-w-[35em] text-md text-ink-2">{post.description}</span>
										</div>
										<span className="text-sm text-muted md:pt-1 md:text-right">{post.readTime}</span>
									</Link>
								</li>
							))}
						</ol>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
