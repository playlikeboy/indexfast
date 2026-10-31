/**
 * Dashboard loading state: a skeleton in the shape of what is coming (page title, a row of
 * figures, a table), so the layout does not jump when the data lands.
 */
export default function Loading() {
	return (
		<div role="status">
			{/* Shapes are decoration; the one sr-only line below is what assistive tech announces. */}
			<div className="animate-pulse" aria-hidden="true">
				<div className="h-8 w-48 rounded-(--radius-input) bg-well" />
				<div className="mt-2 h-4 w-72 max-w-full rounded-(--radius-input) bg-well" />
				<div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
					{Array.from({ length: 4 }, (_, index) => (
						<div key={index} className="border-t border-border pt-3">
							<div className="h-4 w-24 rounded-(--radius-input) bg-well" />
							<div className="mt-2 h-7 w-16 rounded-(--radius-input) bg-well" />
						</div>
					))}
				</div>
				<div className="ui-cut mt-8">
					<div className="border-b border-border px-5 py-4">
						<div className="h-5 w-40 rounded-(--radius-input) bg-well" />
					</div>
					{Array.from({ length: 4 }, (_, index) => (
						<div key={index} className="flex items-center gap-4 border-b border-border px-5 py-3 last:border-b-0">
							<div className="size-9 shrink-0 rounded-(--radius-input) bg-well" />
							<div className="h-4 flex-1 rounded-(--radius-input) bg-well" />
							<div className="hidden h-4 w-24 rounded-(--radius-input) bg-well sm:block" />
						</div>
					))}
				</div>
			</div>
			<span className="sr-only">Loading</span>
		</div>
	);
}
