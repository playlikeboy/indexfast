"use client";

/**
 * Admin error boundary. Keeps the AppShell (the admin layout wraps this) instead of falling
 * through to the root boundary. A failed read here changes no data, so a retry is always safe.
 * The digest matches the Worker log entry for the failed render.
 */
import { Button, Panel } from "@/components/ui";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<Panel>
			<div role="alert" className="flex max-w-[65ch] flex-col items-start gap-3">
				<h1 className="text-lg font-semibold">The admin overview could not load</h1>
				<p className="text-sm text-muted">
					A platform query failed. Nothing was changed. Try again, and if it keeps failing, check the Worker logs
					{error.digest ? (
						<>
							{" "}for reference <code className="font-mono text-ink">{error.digest}</code>
						</>
					) : null}
					.
				</p>
				<Button onClick={reset}>Try again</Button>
			</div>
		</Panel>
	);
}
