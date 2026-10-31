/**
 * Formatting and tone rules shared by the admin panels, so a status reads the same in every
 * table. Numbers use a pinned "en-US" locale: the server's locale is not the admin's.
 */
import type { StatusTone } from "@/components/ui";
import type { CronRunState } from "@/db/admin-queries";

export const formatCount = new Intl.NumberFormat("en-US").format;

/** Whole US dollars, for list prices and MRR (PLANS prices are whole-dollar). */
export const formatUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format;

/** Whole-percent share, or null when there is nothing to divide (shown as "None yet"). */
export function percent(part: number, total: number) {
	return total > 0 ? Math.round((part / total) * 100) : null;
}

export function formatDuration(ms: number | null | undefined) {
	if (ms === null || ms === undefined) return "Unknown";
	if (ms < 1000) return `${ms} ms`;
	const seconds = Math.round(ms / 1000);
	return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export const cronStateView: Record<CronRunState, { tone: StatusTone; label: string }> = {
	success: { tone: "success", label: "Succeeded" },
	failed: { tone: "danger", label: "Failed" },
	timed_out: { tone: "danger", label: "Timed out" },
	running: { tone: "info", label: "Running" },
};

/** submissions.status / payments.status / integration status to a Status tone. */
export function statusTone(status: string): StatusTone {
	if (status === "success" || status === "paid" || status === "verified") return "success";
	if (status === "failed") return "danger";
	if (status === "refunded" || status === "pending" || status === "submitted") return "warning";
	return "neutral";
}
