/*
 * Shared marketing nav (every public page imports it): wordmark left, the real destinations and
 * the sign-up key right, on one sticky line. At lg the key is secondary because the hero's
 * "Add your site free" is the screen's one primary; below lg it stays primary since the hero
 * action scrolls away. Section links are root-relative so they work from every page. Logo is the four-square mark drawn in tokens, so it
 * follows the theme in both modes instead of the retired lime PNG.
 */
import Link from "next/link";
import { buttonClass, cn } from "@/components/ui";
import { ThemeToggle } from "./ThemeToggle";

export function Logo({ className = "size-6" }: { className?: string }) {
	return (
		<span className={cn("grid shrink-0 grid-cols-2 grid-rows-2 gap-0.5", className)} aria-hidden="true">
			<span className="rounded-[2px] bg-ink" />
			<span className="rounded-[2px] bg-signal" />
			<span className="rounded-[2px] bg-ink" />
			<span className="rounded-[2px] bg-ink" />
		</span>
	);
}

const linkClass = "rounded-[4px] text-sm whitespace-nowrap text-ink-2 transition-colors duration-(--dur-short) hover:text-ink";

export function Navbar() {
	return (
		<nav className="sticky top-0 z-(--z-sticky-nav) w-full border-b border-border bg-background" aria-label="Main navigation">
			<div className="mx-auto flex h-16 w-full max-w-page items-center justify-between gap-6 px-(--gutter)">
				<Link href="/" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-display text-ink">
					<Logo />
					IndexFast
				</Link>
				<div className="hidden items-center gap-6 lg:flex">
					<Link href="/#features" className={linkClass}>Features</Link>
					<Link href="/tools" className={linkClass}>Free tools</Link>
					<Link href="/#pricing" className={linkClass}>Pricing</Link>
					<Link href="/resources" className={linkClass}>Resources</Link>
					<Link href="/dashboard" className={linkClass}>Console</Link>
					<ThemeToggle size="lg" />
					<Link href="/signup" className={buttonClass({ variant: "secondary", size: "lg" })}>
						Start free
					</Link>
				</div>
				<div className="flex items-center gap-2 lg:hidden">
					<ThemeToggle />
					<Link href="/dashboard" className={buttonClass({ variant: "ghost", size: "sm" })}>
						Console
					</Link>
					<Link href="/signup" className={buttonClass({ variant: "primary", size: "sm" })}>
						Start free
					</Link>
				</div>
			</div>
		</nav>
	);
}
