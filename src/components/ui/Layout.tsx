/*
 * Layout helpers so every page shares one container recipe and one spacing scale.
 * Container caps the measure and centres it (at 1920 the gutters grow, the grid does not);
 * width="app" is the dashboard/admin width. Stack spaces siblings on the token scale only.
 * Section gives marketing bands their vertical rhythm from the section-gap tokens.
 */
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Container({ width = "page", className, children }: { width?: "page" | "app"; className?: string; children: ReactNode }) {
	return <div className={cn("mx-auto w-full px-(--gutter)", width === "app" ? "max-w-app" : "max-w-page", className)}>{children}</div>;
}

export type StackGap = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

// Each step equals the matching --space-* token (Tailwind's 4px unit).
const gapClass: Record<StackGap, string> = {
	"2xs": "gap-1",
	xs: "gap-2",
	sm: "gap-3",
	md: "gap-4",
	lg: "gap-6",
	xl: "gap-10",
	"2xl": "gap-16",
};

export function Stack({ gap = "md", direction = "column", className, children }: { gap?: StackGap; direction?: "column" | "row"; className?: string; children: ReactNode }) {
	return <div className={cn("flex min-w-0", direction === "row" ? "flex-row flex-wrap items-center" : "flex-col", gapClass[gap], className)}>{children}</div>;
}

const sectionGapClass = {
	s: "py-(--section-gap-s)",
	m: "py-(--section-gap)",
	l: "py-(--section-gap-l)",
} as const;

export function Section({
	gap = "m",
	id,
	labelledBy,
	className,
	children,
}: {
	gap?: keyof typeof sectionGapClass;
	id?: string;
	labelledBy?: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<section id={id} aria-labelledby={labelledBy} className={cn(sectionGapClass[gap], className)}>
			<Container>{children}</Container>
		</section>
	);
}
