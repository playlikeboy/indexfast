"use client";

import { buttonClass } from "@/components/app/ui";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-8 text-center">
			<h1 className="text-lg font-semibold">Something went wrong</h1>
			<p className="mt-2 text-sm text-[var(--app-muted)]">The page could not load. Your data is safe. {error.digest ? `Reference: ${error.digest}` : null}</p>
			<button type="button" onClick={reset} className={`${buttonClass.secondary} mt-5`}>
				Try again
			</button>
		</div>
	);
}
