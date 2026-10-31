/*
 * Empty state for any region that loads data: says what is empty, why it matters, and offers the
 * one action that fills it. A well, not a card, so it never reads as content.
 */
import type { ReactNode } from "react";
import { cn } from "./cn";

export function EmptyState({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
	return (
		<div className={cn("flex flex-col items-start gap-3 rounded-(--radius-card) bg-well px-5 py-8", className)}>
			<h3 className="font-display text-md font-medium">{title}</h3>
			{description ? <p className="max-w-[60ch] text-sm text-muted">{description}</p> : null}
			{action ? <div className="mt-1">{action}</div> : null}
		</div>
	);
}
