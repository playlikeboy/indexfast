"use client";

/**
 * Client primitives for the dashboard. Every mutation goes through ActionForm/ActionButton so
 * pending state and the ActionResult message are shown consistently next to the control.
 */
import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Loader2 } from "lucide-react";
import type { ActionResult } from "@/app/actions";
import { buttonClass, cn } from "./ui";

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

export function ResultMessage({ result }: { result: ActionResult }) {
	if (!result) return null;
	return (
		<p role="status" className={cn("text-sm", result.ok ? "text-[var(--app-ok)]" : "text-[var(--app-bad)]")}>
			{result.ok ? result.message : result.error}
		</p>
	);
}

function SubmitButton({ children, variant, pendingLabel }: { children: ReactNode; variant: keyof typeof buttonClass; pendingLabel?: string }) {
	const { pending } = useFormStatus();
	return (
		<button type="submit" disabled={pending} className={buttonClass[variant]}>
			{pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
			{pending && pendingLabel ? pendingLabel : children}
		</button>
	);
}

/** Form with inputs (children) + submit button + inline result. */
export function ActionForm({
	action,
	children,
	submitLabel,
	pendingLabel,
	variant = "primary",
	className,
	inline,
	onDone,
}: {
	action: FormAction;
	children?: ReactNode;
	submitLabel: ReactNode;
	pendingLabel?: string;
	variant?: keyof typeof buttonClass;
	className?: string;
	inline?: boolean;
	onDone?: (result: ActionResult) => ReactNode;
}) {
	const [result, formAction] = useActionState(action, null);
	return (
		<form action={formAction} className={cn("flex gap-2", inline ? "flex-wrap items-center" : "flex-col items-stretch", className)}>
			{children}
			<div className={cn(inline ? "contents" : "flex flex-wrap items-center gap-3")}>
				<SubmitButton variant={variant} pendingLabel={pendingLabel}>
					{submitLabel}
				</SubmitButton>
				{onDone && result?.ok ? null : <ResultMessage result={result} />}
			</div>
			{onDone && result?.ok ? onDone(result) : null}
		</form>
	);
}

/** One-click mutation (bound server action) with optional confirm. */
export function ActionButton({
	action,
	children,
	pendingLabel,
	variant = "secondary",
	confirm,
	showResult = true,
}: {
	action: () => Promise<ActionResult>;
	children: ReactNode;
	pendingLabel?: string;
	variant?: keyof typeof buttonClass;
	confirm?: string;
	showResult?: boolean;
}) {
	const [result, formAction] = useActionState(async () => action(), null);
	return (
		<form
			action={formAction}
			onSubmit={(event) => {
				if (confirm && !window.confirm(confirm)) event.preventDefault();
			}}
			className="inline-flex flex-wrap items-center gap-2"
		>
			<SubmitButton variant={variant} pendingLabel={pendingLabel}>
				{children}
			</SubmitButton>
			{showResult ? <ResultMessage result={result} /> : null}
		</form>
	);
}

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			className={cn(buttonClass.ghost, className)}
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(value);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				} catch {
					// Clipboard can be blocked; the value is visible to copy by hand.
				}
			}}
		>
			{copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
			{copied ? "Copied" : label}
		</button>
	);
}

export function CodeBlock({ code, label }: { code: string; label?: string }) {
	return (
		<div className="overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-subtle)]">
			<div className="flex items-center justify-between border-b border-[var(--app-border)] px-3 py-1">
				<span className="font-mono text-xs text-[var(--app-muted)]">{label}</span>
				<CopyButton value={code} />
			</div>
			<pre className="overflow-x-auto px-3 py-2.5 font-mono text-xs leading-relaxed">
				<code>{code}</code>
			</pre>
		</div>
	);
}

export function Tabs({ tabs }: { tabs: Array<{ id: string; label: string; content: ReactNode }> }) {
	const [active, setActive] = useState(tabs[0]?.id);
	return (
		<div>
			<div role="tablist" className="mb-3 flex gap-1 overflow-x-auto border-b border-[var(--app-border)]">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={active === tab.id}
						onClick={() => setActive(tab.id)}
						className={cn(
							"-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition",
							active === tab.id ? "border-[var(--app-text)] font-medium" : "border-transparent text-[var(--app-muted)] hover:text-[var(--app-text)]",
						)}
					>
						{tab.label}
					</button>
				))}
			</div>
			{tabs.find((tab) => tab.id === active)?.content}
		</div>
	);
}
