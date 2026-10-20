import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function Logo({ className = "h-6 w-6" }: { className?: string }) {
	return (
		<span className={"grid grid-cols-2 grid-rows-2 gap-[2px] " + className} aria-hidden="true">
			<span className="bg-ink" />
			<span className="bg-accent" />
			<span className="bg-ink" />
			<span className="bg-ink" />
		</span>
	);
}

export function Navbar() {
	return (
		<nav className="sticky top-0 z-50 w-full border-b border-border/60 bg-surface/90 backdrop-blur-md" aria-label="Main navigation">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
				<Link href="/" className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-ink">
					<Logo />
					IndexFast
				</Link>
				<div className="hidden items-center gap-6 md:flex">
					<a href="#features" className="text-sm text-muted transition-colors hover:text-ink">Features</a>
					<Link href="/tools" className="text-sm text-muted transition-colors hover:text-ink">Free tools</Link>
					<a href="#pricing" className="text-sm text-muted transition-colors hover:text-ink">Pricing</a>
					<Link href="/resources" className="text-sm text-muted transition-colors hover:text-ink">Resources</Link>
					<Link href="/dashboard" className="text-sm text-muted transition-colors hover:text-ink">Console</Link>
					<ThemeToggle />
					<Link href="/signup" className="rounded-sm bg-accent px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wide text-accent-foreground transition hover:bg-accent-dark">
						Start free <span aria-hidden="true">↗</span>
					</Link>
				</div>
				<div className="flex items-center gap-2 md:hidden">
					<ThemeToggle />
					<Link href="/dashboard" className="rounded-sm border border-border px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide text-ink">Console</Link>
					<Link href="/signup" className="rounded-sm bg-accent px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide text-accent-foreground">Start free</Link>
				</div>
			</div>
		</nav>
	);
}
