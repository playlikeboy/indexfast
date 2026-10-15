export default function Loading() {
	return (
		<div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
			<div className="h-8 w-48 rounded-lg bg-[var(--app-subtle)]" />
			<div className="h-32 rounded-xl bg-[var(--app-subtle)]" />
			<div className="h-64 rounded-xl bg-[var(--app-subtle)]" />
		</div>
	);
}
