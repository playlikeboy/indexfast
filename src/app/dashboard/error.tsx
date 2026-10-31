"use client";

/**
 * Dashboard error boundary: says what broke, that nothing was lost, and the one thing to try.
 * The digest is shown so a support request can be matched to the server log.
 */
import { Button, Panel } from "@/components/ui";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<Panel>
			<div role="alert" className="flex max-w-[65ch] flex-col items-start gap-3">
				<h1 className="text-lg font-semibold">This page could not load</h1>
				<p className="text-sm text-muted">
					Your sites and queue are safe; background submissions keep running. Try again, and if it keeps failing,{" "}
					<a href={`mailto:support@indexfast.co${error.digest ? `?subject=${encodeURIComponent(`Dashboard error ${error.digest}`)}` : ""}`} className="font-medium text-ink underline hover:text-signal">
						contact support
					</a>
					{error.digest ? (
						<>
							{" "}with reference <code className="font-mono text-ink">{error.digest}</code>
						</>
					) : null}
					.
				</p>
				<Button onClick={reset}>Try again</Button>
			</div>
		</Panel>
	);
}
