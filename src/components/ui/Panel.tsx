/*
 * Panel: the Cobalt cut-corner surface (bevelled on two opposite corners where corner-shape is
 * supported, plain radius elsewhere). Use it for content that is independently interactive or of
 * a different kind from its neighbours; never put a Panel inside a Panel (separate with hairlines).
 * Optional header carries a title, a one-line description and up to two actions.
 */
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Panel({
	title,
	description,
	action,
	padded = true,
	as: Tag = "section",
	className,
	children,
}: {
	title?: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	padded?: boolean;
	as?: "section" | "div" | "article";
	className?: string;
	children?: ReactNode;
}) {
	return (
		<Tag className={cn("ui-cut min-w-0", className)}>
			{title || action ? (
				<header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
					<div className="min-w-0">
						{title ? <h2 className="font-display text-md font-semibold">{title}</h2> : null}
						{description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
					</div>
					{action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
				</header>
			) : null}
			{padded ? <div className="p-5">{children}</div> : children}
		</Tag>
	);
}
