/**
 * Server-safe dashboard and admin kit, now a thin adapter over the Cobalt primitives in
 * @/components/ui. The exported names and props are the old ones on purpose: SiteView,
 * AdminView and other app screens import them, and they keep compiling while each screen moves
 * to @/components/ui directly. New code should import from @/components/ui.
 * Rules carried over from DESIGN.md: state is text plus an icon (Status), names are quiet tags
 * (Badge), one cut Panel per region, no colour outside the tokens.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import {
	Badge as UiBadge,
	EmptyState as UiEmptyState,
	Panel,
	Stat as UiStat,
	Status,
	buttonClass as uiButtonClass,
	cn,
	type ButtonVariant,
	type StatusTone,
} from "@/components/ui";

export { cn };

export function Card({ children, className, title, action, description }: { children?: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; description?: ReactNode }) {
	// Callers pad their own content (tables and lists run edge to edge), so the Panel is unpadded.
	return (
		<Panel title={title} description={description} action={action} padded={false} className={className}>
			{children}
		</Panel>
	);
}

export type Tone = "neutral" | "ok" | "warn" | "bad" | "accent";

const statusTone: Record<Exclude<Tone, "neutral" | "accent">, StatusTone> = {
	ok: "success",
	warn: "warning",
	bad: "danger",
};

/**
 * Legacy Badge. A tone that carries state (ok, warn, bad) renders as Status so meaning never
 * depends on a filled colour; neutral and accent are names or categories and stay quiet tags.
 */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
	if (tone === "neutral" || tone === "accent") return <UiBadge>{children}</UiBadge>;
	return <Status tone={statusTone[tone]}>{children}</Status>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
	return <UiStat label={label} value={value} hint={hint} />;
}

export function PageHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
	return (
		<div className="mb-6 flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0">
				<h1 className="truncate text-2xl font-semibold">{title}</h1>
				{description ? <p className="mt-1 max-w-[75ch] text-sm text-muted">{description}</p> : null}
			</div>
			{action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
		</div>
	);
}

/**
 * Class strings per variant for code that dresses its own element. Ghost is the 32px key used
 * in rows and toolbars; the rest are the 40px app key.
 */
export const buttonClass: Record<ButtonVariant, string> = {
	primary: uiButtonClass({ variant: "primary" }),
	secondary: uiButtonClass({ variant: "secondary" }),
	ghost: uiButtonClass({ variant: "ghost", size: "sm" }),
	danger: uiButtonClass({ variant: "danger" }),
};

export const inputClass = "ui-field";

/** For a Table placed edge to edge in an unpadded Panel: align outer cells with the Panel header, drop the last rule. */
export const tableInPanel = "[&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:last-child]:pr-5 [&_tbody_tr:last-child_td]:border-b-0";

/** Inline code for file names and paths inside prose. */
export function Code({ children }: { children: ReactNode }) {
	return <code className="rounded-[4px] bg-well px-1 py-0.5 font-mono text-[0.875em] break-all">{children}</code>;
}

export function ButtonLink({ href, children, variant = "secondary", external }: { href: string; children: ReactNode; variant?: ButtonVariant; external?: boolean }) {
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

/** Letter tile for a site: recognisable at a glance without fetching third-party favicons. */
export function SiteAvatar({ host, size = "md" }: { host: string; size?: "md" | "lg" }) {
	const letter = host.replace(/^www\./, "").charAt(0).toUpperCase() || "?";
	return (
		<span aria-hidden="true" className={cn("ui-cut ui-cut-sm grid shrink-0 place-items-center bg-well font-display font-semibold text-ink-2", size === "lg" ? "size-10 text-md" : "size-9 text-sm")}>
			{letter}
		</span>
	);
}

/** Thin progress bar (submitted / tracked). Ink, not cobalt: cobalt is kept for the one primary action. */
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
	const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
	return (
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
			<div className="h-full rounded-full bg-ink-2" style={{ width: `${percent}%` }} />
		</div>
	);
}

/** Legacy EmptyState: inset inside an unpadded Card so the well never touches the panel edge. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
	return (
		<div className="p-4">
			<UiEmptyState title={title} description={children} action={action} />
		</div>
	);
}

/** Sentence-case a machine status ("paid" -> "Paid") for badges. */
export function statusLabel(status: string) {
	return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") : status;
}

// Days before a paid period ends that the plan banner starts reminding; Billing quotes the same number.
// shortcut: lives here because plans.ts is outside this screen set; move it there with the other plan policy.
export const RENEW_REMINDER_DAYS = 5;

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
