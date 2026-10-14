"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function DashboardError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("Dashboard caught error:", error);
	}, [error]);

	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
			<div className="mx-auto max-w-md space-y-5 rounded-sm border border-border bg-card p-8 shadow-xl">
				<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
					<AlertCircle className="h-6 w-6" />
				</div>

				<div className="space-y-2">
					<h2 className="font-mono text-lg font-black uppercase tracking-tight text-ink">
						Dashboard Connection Error
					</h2>
					<p className="font-mono text-xs text-muted">
						{error.message || "An unexpected error occurred while loading your dashboard resources."}
					</p>
					{error.digest && (
						<div className="font-mono text-[10px] text-muted/60">Digest: {error.digest}</div>
					)}
				</div>

				<div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
					<button
						type="button"
						onClick={() => reset()}
						className="inline-flex items-center justify-center gap-2 rounded-sm bg-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent-foreground transition-all hover:bg-accent-dark"
					>
						<RefreshCw className="h-3.5 w-3.5" />
						Retry Connection
					</button>

					<Link
						href="/"
						className="inline-flex items-center justify-center gap-2 rounded-sm border border-border px-4 py-2 font-mono text-xs font-bold uppercase text-muted transition-all hover:bg-surface hover:text-ink"
					>
						<Home className="h-3.5 w-3.5" />
						Return Home
					</Link>
				</div>
			</div>
		</div>
	);
}
