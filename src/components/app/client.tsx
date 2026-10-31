"use client";

/**
 * Client primitives for the dashboard, built on @/components/ui. Every mutation goes through
 * ActionForm or ActionButton so pending state and the ActionResult message look the same on
 * every screen. Exported names and props are kept stable: other app screens import them.
 *
 * Forms dispatch by hand inside a transition instead of using <form action>. React 19 resets a
 * form after an action submit even when the action returned an error, which wiped what the user
 * typed; here the form is reset only after a successful result.
 */
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, CircleCheck, CircleX, Copy } from "lucide-react";
import type { ActionResult } from "@/app/actions";
import { Button, CodeBlock as UiCodeBlock, Tabs as UiTabs, cn, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { showToast } from "./toast";

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

const COPY_RESET_MS = 1500;

/** Ghost keys sit in rows and toolbars at 32px; every other variant is the 40px app key. */
function defaultSize(variant: ButtonVariant): ButtonSize {
	return variant === "ghost" ? "sm" : "md";
}

export function ResultMessage({ result, className }: { result: ActionResult; className?: string }) {
	if (!result) return null;
	const text = result.ok ? result.message : result.error;
	if (!text) return null;
	const Icon = result.ok ? CircleCheck : CircleX;
	return (
		<p role={result.ok ? "status" : "alert"} className={cn("flex min-w-0 items-start gap-1.5 text-sm", result.ok ? "text-success" : "text-danger", className)}>
			<Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
			<span className="min-w-0 break-words">{text}</span>
		</p>
	);
}

/** Form with inputs (children) + submit key + inline result. */
export function ActionForm({
	action,
	children,
	submitLabel,
	pendingLabel,
	variant = "primary",
	size,
	className,
	inline,
	onDone,
	footer,
}: {
	action: FormAction;
	children?: ReactNode;
	submitLabel: ReactNode;
	pendingLabel?: string;
	variant?: ButtonVariant;
	size?: ButtonSize;
	className?: string;
	inline?: boolean;
	onDone?: (result: ActionResult) => ReactNode;
	footer?: ReactNode;
}) {
	const formRef = useRef<HTMLFormElement>(null);
	const [result, dispatch, isPending] = useActionState(action, null);

	useEffect(() => {
		// Clear the inputs only once the server accepted them; an error keeps them for a fix.
		if (result?.ok) formRef.current?.reset();
	}, [result]);

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		startTransition(() => dispatch(formData));
	}

	const done = Boolean(onDone && result?.ok);

	return (
		<form ref={formRef} onSubmit={onSubmit} aria-busy={isPending || undefined} className={cn("flex gap-2", inline ? "flex-wrap items-start" : "flex-col items-stretch", className)}>
			{children}
			<div className={cn(inline ? "contents" : "flex flex-wrap items-center gap-3")}>
				<Button type="submit" variant={variant} size={size ?? defaultSize(variant)} loading={isPending}>
					{isPending && pendingLabel ? pendingLabel : submitLabel}
				</Button>
				{done ? null : <ResultMessage result={result} className={inline ? "basis-full" : undefined} />}
			</div>
			{footer}
			{done && onDone ? onDone(result) : null}
		</form>
	);
}

/**
 * One-click mutation (bound server action) with optional confirm. The result is shown as a
 * toast so keys in headers and table rows never reflow their container.
 */
export function ActionButton({
	action,
	children,
	pendingLabel,
	variant = "secondary",
	size,
	confirm,
	showResult = true,
	className,
}: {
	action: () => Promise<ActionResult>;
	children: ReactNode;
	pendingLabel?: string;
	variant?: ButtonVariant;
	size?: ButtonSize;
	confirm?: string;
	showResult?: boolean;
	className?: string;
}) {
	const [result, dispatch, isPending] = useActionState(async () => action(), null);

	useEffect(() => {
		// Errors always surface: they usually carry the instruction needed to fix them.
		if (result && (showResult || !result.ok)) showToast(result.ok, (result.ok ? result.message : result.error) || "");
	}, [result, showResult]);

	function run() {
		if (confirm && !window.confirm(confirm)) return;
		startTransition(() => dispatch());
	}

	return (
		<span className={cn("inline-flex", className)}>
			<Button variant={variant} size={size ?? defaultSize(variant)} loading={isPending} onClick={run}>
				{isPending && pendingLabel ? pendingLabel : children}
			</Button>
		</span>
	);
}

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
	const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

	useEffect(() => {
		if (state === "idle") return;
		const timer = setTimeout(() => setState("idle"), COPY_RESET_MS);
		return () => clearTimeout(timer);
	}, [state]);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setState("copied");
		} catch {
			// Clipboard can be blocked (insecure origin, permissions); the value is visible to select.
			setState("failed");
		}
	}

	return (
		<Button variant="ghost" size="sm" onClick={copy} className={cn("shrink-0", className)}>
			{state === "copied" ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
			<span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed, select the text" : label}</span>
		</Button>
	);
}

/** wrap: soft-wrap prose-like content (AI prompts, key values); commands keep horizontal scroll. */
export function CodeBlock({ code, label, wrap }: { code: string; label?: string; wrap?: boolean }) {
	return <UiCodeBlock code={code} title={label} className={wrap ? "[&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]" : undefined} />;
}

/** In-screen view switcher; arrow keys, Home/End and aria-controls come from the Cobalt Tabs. */
export function Tabs({ tabs, label = "Views" }: { tabs: Array<{ id: string; label: string; content: ReactNode }>; label?: string }) {
	return <UiTabs items={tabs} label={label} />;
}
