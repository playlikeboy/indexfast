"use client";

/**
 * Minimal toast system for one-click actions. Results of row-level buttons ("Submit",
 * "Check", "Sync now") used to render inline and broke table/header layouts; they now
 * surface here instead. Module-level emitter, no context provider needed.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

type Toast = { id: number; ok: boolean; text: string };
type Listener = (toast: Toast) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function showToast(ok: boolean, text: string) {
	if (!text) return;
	const toast = { id: nextId++, ok, text };
	for (const listener of listeners) listener(toast);
}

export function Toaster() {
	const [toasts, setToasts] = useState<Toast[]>([]);

	useEffect(() => {
		const listener: Listener = (toast) => {
			setToasts((current) => [...current.slice(-3), toast]);
			// Errors stay longer: they usually carry the instruction needed to fix them.
			setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), toast.ok ? 4000 : 9000);
		};
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);

	return (
		<div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
			{toasts.map((toast) => (
				<div
					key={toast.id}
					role="status"
					className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3 text-sm text-[var(--app-text)] shadow-lg"
				>
					{toast.ok ? (
						<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-ok)]" aria-hidden />
					) : (
						<XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-bad)]" aria-hidden />
					)}
					<span className="min-w-0 flex-1 break-words">{toast.text}</span>
					<button
						type="button"
						aria-label="Dismiss"
						onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
						className="text-[var(--app-muted)] hover:text-[var(--app-text)]"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			))}
		</div>
	);
}
