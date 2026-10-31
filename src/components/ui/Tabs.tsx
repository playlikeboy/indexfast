"use client";

/*
 * Tabs for switching views inside one screen: keys on a sunken tray, the chosen one pressed.
 * WAI-ARIA tabs pattern: roving tabindex, Left/Right/Home/End move and activate, each tab names
 * its panel with aria-controls. When the view must survive a reload or be linkable (the site
 * page's ?view=), use links with aria-current instead; state that matters lives in the URL.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export type TabItem = { id: string; label: ReactNode; content: ReactNode };

export function Tabs({ items, label, defaultId, className }: { items: TabItem[]; label: string; defaultId?: string; className?: string }) {
	const baseId = useId();
	const [activeId, setActiveId] = useState(defaultId ?? items[0]?.id);
	const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

	function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
		const last = items.length - 1;
		const next =
			event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
			: event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
			: event.key === "Home" ? 0
			: event.key === "End" ? last
			: null;
		if (next === null) return;
		event.preventDefault();
		setActiveId(items[next].id);
		tabRefs.current[next]?.focus();
	}

	return (
		<div className={cn("flex min-w-0 flex-col gap-4", className)}>
			<div role="tablist" aria-label={label} className="ui-cut ui-cut-sm inline-flex max-w-full gap-1 self-start overflow-x-auto border-transparent bg-sunken p-1">
				{items.map((item, index) => {
					const selected = item.id === activeId;
					return (
						<button
							key={item.id}
							ref={(node) => {
								tabRefs.current[index] = node;
							}}
							type="button"
							role="tab"
							id={`${baseId}-tab-${item.id}`}
							aria-selected={selected}
							aria-controls={`${baseId}-panel-${item.id}`}
							tabIndex={selected ? 0 : -1}
							onClick={() => setActiveId(item.id)}
							onKeyDown={(event) => onKeyDown(event, index)}
							className={cn("ui-key ui-key--sm", !selected && "ui-key--ghost")}
						>
							{item.label}
						</button>
					);
				})}
			</div>
			{items.map((item) => (
				<div
					key={item.id}
					role="tabpanel"
					id={`${baseId}-panel-${item.id}`}
					aria-labelledby={`${baseId}-tab-${item.id}`}
					hidden={item.id !== activeId}
					tabIndex={0}
					className="min-w-0"
				>
					{item.content}
				</div>
			))}
		</div>
	);
}
