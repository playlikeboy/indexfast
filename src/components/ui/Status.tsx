/*
 * Status and Badge. Cobalt rule: status is text with one icon, never a filled chip and never a
 * decorative dot, so meaning survives without colour. Badge is a quiet cut tag for names and
 * categories (a plan, an engine), not for state.
 */
import type { ReactNode } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "./cn";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClass: Record<StatusTone, string> = {
	neutral: "text-muted",
	info: "text-signal",
	success: "text-success",
	warning: "text-warning",
	danger: "text-danger",
};

const toneIcon: Record<StatusTone, LucideIcon | null> = {
	neutral: null,
	info: Info,
	success: CircleCheck,
	warning: TriangleAlert,
	danger: CircleX,
};

export function Status({ tone = "neutral", className, children }: { tone?: StatusTone; className?: string; children: ReactNode }) {
	const Icon = toneIcon[tone];
	return (
		<span className={cn("inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap", toneClass[tone], className)}>
			{Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
			{children}
		</span>
	);
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
	return <span className={cn("ui-cut ui-cut-sm inline-flex items-center bg-well px-2 py-0.5 text-xs font-medium whitespace-nowrap text-ink-2", className)}>{children}</span>;
}
