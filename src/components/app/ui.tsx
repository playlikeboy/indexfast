/**
 * Minimal server-safe UI kit for the dashboard and admin panel. Keep this small: if a page
 * needs something bespoke, build it in the page. Interactive pieces live in client.tsx.
 */
import Link from "next/link";
import type { ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
	return classes.filter(Boolean).join(" ");
}

export function Card({ children, className, title, action, description }: { children?: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; description?: ReactNode }) {
	return (
		<section className={cn("rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_1px_2px_rgba(0,0,0,0.03)]", className)}>
			{title || action ? (
				<header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4">
					<div className="min-w-0">
						<h2 className="text-[15px] font-semibold">{title}</h2>
						{description ? <p className="mt-0.5 text-sm text-[var(--app-muted)]">{description}</p> : null}
					</div>
					{action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
				</header>
			) : null}
			{children}
		</section>
	);
}

type Tone = "neutral" | "ok" | "warn" | "bad" | "accent";

const toneClass: Record<Tone, string> = {
	neutral: "bg-[var(--app-subtle)] text-[var(--app-muted)]",
	ok: "bg-[var(--app-ok-bg)] text-[var(--app-ok)]",
	warn: "bg-[var(--app-warn-bg)] text-[var(--app-warn)]",
	bad: "bg-[var(--app-bad-bg)] text-[var(--app-bad)]",
	accent: "bg-accent text-accent-foreground",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
	return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", toneClass[tone])}>{children}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
	return (
		<div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
			<div className="text-xs font-medium text-[var(--app-muted)]">{label}</div>
			<div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
			{hint ? <div className="mt-0.5 text-xs text-[var(--app-muted)]">{hint}</div> : null}
		</div>
	);
}

export function PageHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
	return (
		<div className="mb-6 flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0">
				<h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
				{description ? <p className="mt-1 text-sm text-[var(--app-muted)]">{description}</p> : null}
			</div>
			{action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
		</div>
	);
}

// Shared focus ring: keyboard users must always see where they are.
const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]";

export const buttonClass = {
	primary: `inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`,
	secondary: `inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3.5 py-2 text-sm font-medium shadow-sm transition hover:bg-[var(--app-subtle)] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`,
	ghost: `inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--app-muted)] transition hover:bg-[var(--app-subtle)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`,
	danger: `inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--app-bad)]/30 px-3.5 py-2 text-sm font-medium text-[var(--app-bad)] transition hover:bg-[var(--app-bad-bg)] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`,
};

export const inputClass =
	"w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-text)] focus:ring-2 focus:ring-[var(--app-text)]/10";

/** Inline code chip for file names and paths inside prose. */
export function Code({ children }: { children: ReactNode }) {
	return <code className="rounded bg-[var(--app-subtle)] px-1 py-0.5 font-mono text-[0.85em]">{children}</code>;
}

export function ButtonLink({ href, children, variant = "secondary", external }: { href: string; children: ReactNode; variant?: keyof typeof buttonClass; external?: boolean }) {
	return external ? (
		<a href={href} target="_blank" rel="noreferrer" className={buttonClass[variant]}>
			{children}
		</a>
	) : (
		<Link href={href} className={buttonClass[variant]}>
			{children}
		</Link>
	);
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
	return (
		<div className="px-5 py-10 text-center">
			<p className="text-sm font-medium">{title}</p>
			{children ? <div className="mt-1 text-sm text-[var(--app-muted)]">{children}</div> : null}
		</div>
	);
}

/** Sentence-case a machine status ("paid" -> "Paid") for badges. */
export function statusLabel(status: string) {
	return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") : status;
}

export function formatDate(value: Date | string | null | undefined) {
	if (!value) return "Never";
	const date = new Date(value);
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "3h ago" style. Server-rendered relative to request time; precise enough for logs. */
export function timeAgo(value: Date | string | null | undefined) {
	if (!value) return "Never";
	const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
	if (seconds < 0) {
		const ahead = -seconds;
		if (ahead < 3600) return `in ${Math.max(1, Math.round(ahead / 60))}m`;
		if (ahead < 86400) return `in ${Math.round(ahead / 3600)}h`;
		return `in ${Math.round(ahead / 86400)}d`;
	}
	if (seconds < 60) return "just now";
	if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
	if (seconds < 86400 * 30) return `${Math.round(seconds / 86400)}d ago`;
	return formatDate(value);
}

export function formatMoney(minor: number, currency: string) {
	return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}
