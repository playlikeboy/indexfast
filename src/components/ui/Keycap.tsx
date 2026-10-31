/*
 * Keycap: a <kbd> drawn as a small key, for keyboard shortcuts (Cmd K, Esc). Decorative only:
 * it is not a control, so it has no states.
 */
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Keycap({ className, children }: { className?: string; children: ReactNode }) {
	return (
		<kbd className={cn("inline-flex min-w-6 items-center justify-center rounded-[4px] border border-border-strong bg-key-face px-1.5 py-0.5 font-display text-xs font-medium text-ink-2 shadow-[0_2px_0_0_var(--color-key-edge)]", className)}>
			{children}
		</kbd>
	);
}
