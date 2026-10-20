import Link from "next/link";

export function Hero() {
	return (
		<section className="relative overflow-hidden border-b border-border/40 bg-grid py-16 sm:py-20 lg:py-24">
			<div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
				<div>
					<p className="label-mono mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[10px] font-bold tracking-wider">
						<span className="h-1.5 w-1.5 rounded-full bg-accent" />
						SEO indexing operations
					</p>
					<h1 className="display max-w-2xl text-5xl sm:text-6xl lg:text-7xl">
						Find indexing issues.
						<span className="mt-3 block"><span className="text-highlight">Ship fixes faster.</span></span>
					</h1>
					<p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
						Add your site, drop in one file, and every new or updated page is sent to search engines automatically. Works from the dashboard or straight from your AI editor.
					</p>
					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<Link
							href="/signup"
							className="inline-flex items-center justify-center gap-2 rounded-sm bg-accent px-6 py-3 text-xs font-mono font-bold uppercase tracking-wide text-accent-foreground transition hover:bg-accent-dark"
						>
							Start free <span aria-hidden="true">↗</span>
						</Link>
						<Link
							href="/tools"
							className="inline-flex items-center justify-center rounded-sm border border-border bg-card/50 px-6 py-3 text-xs font-mono font-bold uppercase tracking-wide text-ink transition hover:border-ink"
						>
							Explore free tools
						</Link>
					</div>
					<p className="mt-4 text-xs text-muted">Free plan included. No credit card needed.</p>
				</div>

				<ProductVideo />
			</div>
		</section>
	);
}

/**
 * Product video in the hero. preload="metadata" keeps the 9 MB file off the critical path
 * (only headers + first frame load until the visitor presses play); the #t=4 fragment
 * shows the "You ship 40 new pages" frame instead of the near-blank intro.
 */
function ProductVideo() {
	return (
		<div className="relative mx-auto w-full max-w-xl lg:max-w-none">
			<div className="absolute -inset-4 rounded-2xl bg-accent/10 blur-2xl" aria-hidden="true" />
			<div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
				<div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5">
					<div className="flex items-center gap-1.5" aria-hidden="true">
						<span className="h-2.5 w-2.5 rounded-full bg-red-400" />
						<span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
						<span className="h-2.5 w-2.5 rounded-full bg-green-500" />
					</div>
					<span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">See IndexFast in action</span>
					<span className="w-10" aria-hidden="true" />
				</div>
				<video
					className="block aspect-video w-full bg-black"
					src="/IndexFast-Editorial-v2.mp4#t=4"
					controls
					playsInline
					preload="metadata"
					aria-label="IndexFast product walkthrough video"
				>
					<a href="/IndexFast-Editorial-v2.mp4">Watch the IndexFast walkthrough</a>
				</video>
			</div>
		</div>
	);
}
