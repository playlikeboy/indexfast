/*
 * Shared marketing footer (every public page imports it): the wordmark over the real site links
 * and the legal line. FinalCTA is re-exported here because /pricing and the home page import it
 * from this module; its source lives in FinalCTA.tsx.
 */
import Link from "next/link";
import { Container } from "@/components/ui";
import { Logo } from "./Navbar";

export { FinalCTA } from "./FinalCTA";

const linkClass = "text-ink-2 underline decoration-transparent underline-offset-4 transition-colors duration-(--dur-short) hover:decoration-signal";

export function Footer() {
	return (
		<footer className="border-t border-border">
			<Container className="py-(--space-2xl)">
				<div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-(--gap-columns)">
					<div className="min-w-0 lg:col-span-6">
						<Link href="/" className="inline-flex items-center gap-3 font-display text-section font-semibold tracking-display text-ink">
							<Logo className="size-9" />
							IndexFast
						</Link>
						<p className="mt-4 max-w-[40ch] text-ink-2">Automatic page discovery for sites that ship fast. IndexNow, Bing and MCP in one place.</p>
					</div>
					<nav aria-label="Product" className="lg:col-span-3">
						<h3 className="font-body text-sm font-medium tracking-normal text-muted">
							Product
						</h3>
						<ul className="mt-4 space-y-3">
							<li><Link href="/#features" className={linkClass}>Features</Link></li>
							<li><Link href="/#pricing" className={linkClass}>Pricing</Link></li>
							<li><Link href="/dashboard" className={linkClass}>Console</Link></li>
							<li><Link href="/dashboard/connect" className={linkClass}>MCP integration</Link></li>
							<li><Link href="/resources" className={linkClass}>Resources</Link></li>
						</ul>
					</nav>
					<nav aria-label="Explore" className="lg:col-span-3">
						<h3 className="font-body text-sm font-medium tracking-normal text-muted">
							Explore
						</h3>
						<ul className="mt-4 space-y-3">
							<li><Link href="/tools" className={linkClass}>Free SEO tools</Link></li>
							<li><Link href="/blog" className={linkClass}>Blog</Link></li>
							<li><Link href="/about" className={linkClass}>About</Link></li>
							<li><Link href="/privacy" className={linkClass}>Privacy</Link></li>
							<li><Link href="/terms" className={linkClass}>Terms</Link></li>
						</ul>
					</nav>
				</div>
				<div className="mt-16 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
					<span>© {new Date().getFullYear()} IndexFast</span>
					<span>Discover. Diagnose. Submit.</span>
				</div>
			</Container>
		</footer>
	);
}
