/*
 * Data table: full width, horizontal hairlines only, no outer box, sentence-case heads that never
 * wrap. Wide tables scroll sideways inside their own focusable region instead of the page.
 * Numeric columns take `numeric` for tabular figures and right alignment so values compare.
 */
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

export function Table({ caption, className, children }: { caption?: ReactNode; className?: string; children: ReactNode }) {
	return (
		<div className={cn("min-w-0 overflow-x-auto", className)} tabIndex={0} role="region" aria-label={typeof caption === "string" ? caption : "Table"}>
			<table className="w-full border-collapse text-left text-sm">
				{caption ? <caption className="visually-hidden">{caption}</caption> : null}
				{children}
			</table>
		</div>
	);
}

export function Th({ numeric = false, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
	return <th scope="col" className={cn("border-b border-border-strong px-3 py-2 font-display text-sm font-medium whitespace-nowrap text-muted", numeric && "text-right", className)} {...rest} />;
}

export function Td({ numeric = false, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
	return <td className={cn("border-b border-border px-3 py-2.5 align-top", numeric && "num text-right", className)} {...rest} />;
}
