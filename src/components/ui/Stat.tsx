/*
 * Stat: one real figure and its label in tabular numerals. No icon tile, no trend arrow nobody
 * measured, no card: siblings part with a top hairline, so lay several out in a grid.
 * Only pass figures the product actually computed; never a placeholder that reads as a claim.
 */
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Stat({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
	return (
		<div className={cn("min-w-0 border-t border-border pt-3", className)}>
			<div className="truncate text-sm text-muted">{label}</div>
			<div className="num mt-1 font-display text-2xl leading-none font-semibold tracking-display">{value}</div>
			{hint ? <div className="mt-1 text-sm text-muted">{hint}</div> : null}
		</div>
	);
}
