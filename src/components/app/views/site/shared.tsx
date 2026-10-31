/**
 * Small pieces every site section shares, kept in one place so the sections cannot drift:
 * the URL builder for linkable view state (?view, ?tab, ?q, ?page), path and engine labels,
 * the pager, the key-file re-check, engine status wording, the plan upgrade note and the paused note.
 * Plan names come from plans.ts so a renamed or re-limited plan never leaves stale copy here.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { verifySiteAction } from "@/app/actions";
import { ActionButton } from "@/components/app/client";
import { buttonClass, type StatusTone } from "@/components/ui";
import { VISIBLE_PLANS, type PlanLimits } from "@/lib/platform/plans";

export type SiteSection = "overview" | "urls" | "queue" | "sitemaps" | "settings";

/** Inline text link inside prose: ink by default, cobalt on hover (DESIGN.md: links on hover). */
export const textLink = "text-ink underline underline-offset-2 transition-colors duration-(--dur-micro) hover:text-signal";

export function siteBase(siteId: string) {
	return `/dashboard/sites/${siteId}`;
}

/** Builds a linkable site URL; defaults (overview, tab "all", page 1) are left out so links stay short. */
export function siteHref(siteId: string, state: { view?: SiteSection; tab?: string; q?: string; page?: number } = {}) {
	const params = new URLSearchParams();
	if (state.view && state.view !== "overview") params.set("view", state.view);
	if (state.tab && state.tab !== "all") params.set("tab", state.tab);
	if (state.q) params.set("q", state.q);
	if (state.page && state.page > 1) params.set("page", String(state.page));
	const query = params.toString();
	return query ? `${siteBase(siteId)}?${query}` : siteBase(siteId);
}

export function pathOf(loc: string, host: string) {
	return loc.replace(`https://${host}`, "") || "/";
}

export function engineName(engine: string) {
	if (engine === "bing") return "Bing";
	if (engine === "google_indexing_api") return "Google Indexing API";
	if (engine === "yandex") return "Yandex";
	if (engine === "baidu") return "Baidu";
	return "IndexNow";
}

/** Engine integration status as Status text: failure must read as failure, not as "off". */
export function engineStatus(status: string): { tone: StatusTone; label: string } {
	if (status === "verified") return { tone: "success", label: "Connected" };
	if (status === "failed") return { tone: "danger", label: "Failing" };
	if (status === "pending") return { tone: "warning", label: "Pending" };
	return { tone: "neutral", label: "Not connected" };
}

export function Pager({ pageNumber, totalPages, total, unit, hrefFor }: { pageNumber: number; totalPages: number; total: number; unit: string; hrefFor: (page: number) => string }) {
	if (totalPages <= 1) return null;
	return (
		<nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-muted">
			<span className="num">
				Page {pageNumber} of {totalPages}, {total.toLocaleString()} {unit}
			</span>
			<span className="flex gap-2">
				{pageNumber > 1 ? (
					<Link href={hrefFor(pageNumber - 1)} className={buttonClass({ size: "sm" })}>
						Previous
					</Link>
				) : null}
				{pageNumber < totalPages ? (
					<Link href={hrefFor(pageNumber + 1)} className={buttonClass({ size: "sm" })}>
						Next
					</Link>
				) : null}
			</span>
		</nav>
	);
}

/** Fetches the key file again. Callers hide it for paused sites: a paused site sends nothing. */
export function RecheckKeyButton({ siteId, label = "Re-check key file" }: { siteId: string; label?: string }) {
	return (
		<ActionButton action={verifySiteAction.bind(null, siteId)} variant="secondary" pendingLabel="Checking...">
			{label}
		</ActionButton>
	);
}

/** Names the visible plans that include a feature, read from plans.ts, with a link to billing. */
export function UpgradeNote({ feature, limit }: { feature: ReactNode; limit: keyof Pick<PlanLimits, "bing" | "yandex" | "baidu" | "googleIndexingApi"> }) {
	const plans = VISIBLE_PLANS.filter((plan) => plan.limits[limit]).map((plan) => plan.name);
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-card) bg-well px-4 py-3 text-sm">
			<p className="text-ink-2">
				{feature} is included on {plans.join(" and ") || "paid plans"}.
			</p>
			<Link href="/dashboard/billing" className={buttonClass({ size: "sm" })}>
				See plans
			</Link>
		</div>
	);
}

/** Why a paused site offers no send or verify path: the backend refuses them until the site is back under the limit. */
export function PausedNote({ planName, task }: { planName: string; task: string }) {
	return (
		<p className="text-muted">
			This site is paused because it is over the {planName} site limit. Upgrade or remove another site to {task}.{" "}
			<Link href="/dashboard/billing" className={textLink}>
				See plans
			</Link>
		</p>
	);
}

/** One reserved line for an engine's or check's last error, in the danger wash. */
export function ErrorNote({ children }: { children: ReactNode }) {
	if (!children) return null;
	return <p className="rounded-(--radius-input) bg-danger-wash px-3 py-2 text-sm break-words text-danger">{children}</p>;
}

/** Native checkbox in the accent colour; the label wraps it so the whole line is the hit target. */
export function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
	return (
		<label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-ink-2">
			<input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 shrink-0 accent-signal" />
			<span>{label}</span>
		</label>
	);
}
