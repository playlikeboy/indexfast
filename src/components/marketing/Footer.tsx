import Link from "next/link";
import { Logo } from "./Navbar";

export function FinalCTA() {
	return (
		<section className="px-4 py-12 sm:px-6 sm:py-16" id="cta" aria-labelledby="cta-heading">
			<div className="relative mx-auto max-w-6xl overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-7 text-zinc-100 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-12">
				<div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
				<div className="relative">
					<p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Get started</p>
					<h2 id="cta-heading" className="display mt-3 max-w-2xl text-3xl text-zinc-100 sm:text-4xl">
						Make indexing part of your release workflow.
					</h2>
					<p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">Find blockers, track URL changes, and automate discovery from one place.</p>
				</div>
				<div className="relative mt-6 flex shrink-0 flex-col gap-3 sm:flex-row lg:mt-0">
					<Link href="/signup" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-accent px-5 py-3 text-xs font-mono font-bold uppercase tracking-wide text-accent-foreground transition hover:bg-accent-dark">
						Start free <span aria-hidden="true">↗</span>
					</Link>
					<Link href="/dashboard/connect" className="inline-flex min-h-11 items-center justify-center rounded-sm border border-zinc-700 px-5 py-3 text-xs font-mono font-bold uppercase tracking-wide text-zinc-200 transition hover:border-zinc-400">
						Connect MCP
					</Link>
				</div>
			</div>
		</section>
	);
}

export function Footer() {
	return (
		<footer className="border-t border-border/60 bg-surface py-9 sm:py-11">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
					<div>
						<Link href="/" className="inline-flex items-center gap-2.5 text-base font-extrabold tracking-tight text-ink">
							<Logo />
							IndexFast
						</Link>
						<p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">Sitemap monitoring, indexing diagnostics, and URL submission workflows for teams that ship fast.</p>
					</div>
					<div>
						<h3 className="text-xs font-bold uppercase tracking-wider text-ink">Product</h3>
						<ul className="mt-3 space-y-2 text-sm text-muted">
							<li><a href="#features" className="transition hover:text-ink">Features</a></li>
							<li><a href="#pricing" className="transition hover:text-ink">Pricing</a></li>
							<li><Link href="/dashboard" className="transition hover:text-ink">Console</Link></li>
							<li><Link href="/dashboard/connect" className="transition hover:text-ink">MCP integration</Link></li>
							<li><Link href="/resources" className="transition hover:text-ink">Resources</Link></li>
						</ul>
					</div>
					<div>
						<h3 className="text-xs font-bold uppercase tracking-wider text-ink">Explore</h3>
						<ul className="mt-3 space-y-2 text-sm text-muted">
							<li><Link href="/tools" className="transition hover:text-ink">Free SEO tools</Link></li>
							<li><Link href="/blog" className="transition hover:text-ink">Blog</Link></li>
							<li><Link href="/about" className="transition hover:text-ink">About</Link></li>
							<li><Link href="/privacy" className="transition hover:text-ink">Privacy</Link></li>
							<li><Link href="/terms" className="transition hover:text-ink">Terms</Link></li>
						</ul>
					</div>
				</div>
				<div className="mt-8 flex flex-col gap-2 border-t border-border/50 pt-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
					<span>© {new Date().getFullYear()} IndexFast. All rights reserved.</span>
					<span>Discover. Diagnose. Submit.</span>
				</div>
			</div>
		</footer>
	);
}
