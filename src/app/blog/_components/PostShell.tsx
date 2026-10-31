/*
 * The reading surface every blog post shares, so long-form guides read the same way and only the
 * words differ per file. Rules it enforces: one measure for running text (about 70ch), date and
 * read time come from `blogPosts` (one source, so the index and the post never disagree), the
 * outline is a plain list of anchors in an aside (the old in-body box, not site navigation), and post bodies stay unstyled markup that this wrapper
 * dresses in Cobalt tokens. No eyebrow over the title: the category sits in the meta line below.
 */
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { getBlogPostBySlug } from "@/lib/marketing-data";

export type OutlineItem = { id: string; label: string };

// Descendant styles for the post body (h2 stays on the --text-2xl step until globals.css has an
// in-article head role between text-title and text-section): headings on the display face, body at 16px with reading
// leading, lists with quiet markers, inline code on the well, tables ruled like the app tables.
const proseClass = [
	"min-w-0 max-w-[35rem] text-md leading-relaxed text-ink-2",
	"[&_p]:mt-5 [&_ul]:mt-5 [&_ol]:mt-5 [&>:first-child]:mt-0 [&>h2:first-child]:border-t-0 [&>h2:first-child]:pt-0",
	"[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mt-2 [&_li]:pl-1 [&_li::marker]:text-muted",
	"[&_h2]:mt-16 [&_h2]:scroll-mt-24 [&_h2]:border-t [&_h2]:border-border [&_h2]:pt-10 [&_h2]:text-2xl [&_h2]:text-ink",
	"[&_h3]:mt-10 [&_h3]:scroll-mt-24 [&_h3]:text-title [&_h3]:text-ink",
	"[&_strong]:font-medium [&_strong]:text-ink",
	"[&_a]:text-ink [&_a]:underline [&_a]:decoration-border-strong [&_a:hover]:decoration-signal",
	"[&_code]:rounded-input [&_code]:bg-well [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.875em] [&_code]:text-ink [&_code]:wrap-anywhere",
	"[&_table]:mt-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm",
	"[&_th]:border-b [&_th]:border-border-strong [&_th]:px-3 [&_th]:py-2 [&_th]:font-display [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-muted",
	"[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top",
].join(" ");

// Reading width plus the outline column, so the outline sits beside the text instead of at the far
// edge of a 1440 screen, and the header shares the body's left edge and width.
const readingGrid = "lg:max-w-[calc(35rem+16rem+4rem)]";

function formatDate(iso: string) {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function PostShell({
	slug,
	category,
	title,
	lede,
	outline,
	children,
}: {
	slug: string;
	category: string;
	title: ReactNode;
	lede: ReactNode;
	outline?: OutlineItem[];
	children: ReactNode;
}) {
	const post = getBlogPostBySlug(slug);
	// A post page without its index entry would drift from /blog and the sitemap; fail loudly.
	if (!post) notFound();

	return (
		<article aria-labelledby="post-heading">
			<header className="pt-16 pb-20">
				<Container>
					<div className={readingGrid}>
						<h1 id="post-heading" className="text-display-s">
							{title}
						</h1>
						{/* rem, not em: text-lead is larger than body, and the lede must share the body's measure. */}
						<p className="mt-6 max-w-[35rem] text-lead text-ink-2">{lede}</p>
					</div>
				</Container>
			</header>
			<Container className="pb-(--section-gap)">
				<div className={`${readingGrid} border-t border-border pt-4`}>
					{/* Meta first in DOM order so on a phone it stays next to the title, above the outline. */}
					<p className="pt-2 text-sm text-muted">
						{category}. Published <time dateTime={post.date}>{formatDate(post.date)}</time>. {post.readTime}.
					</p>
					<div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,35rem)_16rem] lg:gap-16">
						{outline?.length ? (
							<>
								{/* Below lg the outline folds away so the first paragraph is not a screen of anchors away. */}
								<details className="border-y border-border py-3 lg:hidden">
									<summary className="cursor-pointer font-display text-sm font-medium text-ink">In this guide</summary>
									<Outline items={outline} />
								</details>
								<aside aria-label="In this guide" className="hidden min-w-0 lg:order-2 lg:block">
									<div className="lg:sticky lg:top-24">
										<h2 className="font-display text-sm font-medium text-muted">In this guide</h2>
										<Outline items={outline} />
									</div>
								</aside>
							</>
						) : null}
						<div className={proseClass}>{children}</div>
					</div>
				</div>
			</Container>
		</article>
	);
}

function Outline({ items }: { items: OutlineItem[] }) {
	return (
		<ol className="mt-3 border-l border-border">
			{items.map((item) => (
				<li key={item.id} className="-ml-px border-l border-transparent py-1.5 pl-4 text-sm has-[a:hover]:border-signal">
					{/* Inline, not block: outline entries are post headings and may wrap like text. */}
					<a href={`#${item.id}`} className="text-ink-2 transition-colors duration-(--dur-short) hover:text-ink">
						{item.label}
					</a>
				</li>
			))}
		</ol>
	);
}
