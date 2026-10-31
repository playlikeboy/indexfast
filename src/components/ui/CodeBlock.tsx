"use client";

/*
 * CodeBlock: graphite mono panel for commands, config and API responses, with a working copy key.
 * The header shows a real filename or language only; never invent one. Copy reports its result
 * in a live region, and a failed copy says so instead of pretending.
 */
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "./cn";

type CopyState = "idle" | "copied" | "failed";

const COPY_RESET_MS = 2000;

export function CodeBlock({ code, title, className }: { code: string; title?: string; className?: string }) {
	const [state, setState] = useState<CopyState>("idle");

	useEffect(() => {
		if (state === "idle") return;
		const timer = setTimeout(() => setState("idle"), COPY_RESET_MS);
		return () => clearTimeout(timer);
	}, [state]);

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			setState("copied");
		} catch {
			// Clipboard can be blocked (insecure origin, permissions); tell the user to select instead.
			setState("failed");
		}
	}

	const label = state === "copied" ? "Copied" : state === "failed" ? "Copy failed, select the text" : "Copy";

	return (
		<div className={cn("ui-cut min-w-0 overflow-hidden border-code-bg-2 bg-code-bg text-code-fg", className)}>
			<div className="flex items-center justify-between gap-3 bg-code-bg-2 px-4 py-1.5">
				<span className="truncate font-mono text-xs text-code-muted">{title}</span>
				<button
					type="button"
					onClick={copy}
					className="relative inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-[4px] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] px-2 font-display text-xs font-medium text-code-fg transition-colors duration-(--dur-short) hover:bg-code-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
				>
					{state === "copied" ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
					<span aria-live="polite">{label}</span>
				</button>
			</div>
			<pre className="overflow-x-auto px-4 py-3 font-mono text-sm leading-relaxed" tabIndex={0}>
				<code>{code}</code>
			</pre>
		</div>
	);
}
