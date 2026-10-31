/*
 * Form fields. Field owns the label, the hint line and the error line, and hands the control the
 * ids it needs (aria-describedby, aria-invalid) through a render function so the wiring cannot be
 * forgotten. The error replaces the hint in the same reserved line, so nothing reflows when it
 * appears. Input, Textarea and Select are cut, keep a constant 1px border, and take the ring inset.
 * Server-compatible: useId works in server components.
 */
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

export type FieldControlProps = {
	id: string;
	"aria-describedby"?: string;
	"aria-invalid"?: true;
	"aria-required"?: true;
	required?: boolean;
};

export function Field({
	label,
	hint,
	error,
	required = false,
	className,
	children,
}: {
	label: ReactNode;
	hint?: ReactNode;
	error?: ReactNode;
	required?: boolean;
	className?: string;
	children: (control: FieldControlProps) => ReactNode;
}) {
	const id = useId();
	const messageId = `${id}-message`;
	const message = error || hint;
	return (
		<div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
			<label htmlFor={id} className="font-display text-sm font-medium text-ink">
				{label}
				{required ? <span className="font-body font-normal text-muted"> (required)</span> : null}
			</label>
			{children({
				id,
				"aria-describedby": message ? messageId : undefined,
				"aria-invalid": error ? true : undefined,
				"aria-required": required ? true : undefined,
				required,
			})}
			<p id={messageId} className={cn("min-h-[1lh] text-sm", error ? "text-danger" : "text-muted")} role={error ? "alert" : undefined}>
				{message}
			</p>
		</div>
	);
}

type FieldSize = "md" | "lg";

export function Input({ size = "md", className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: FieldSize }) {
	return <input className={cn("ui-field", size === "lg" && "ui-field--lg", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return <textarea className={cn("ui-field", className)} {...rest} />;
}

export function Select({ size = "md", className, children, ...rest }: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: FieldSize }) {
	// Native select keeps keyboard and screen-reader behaviour; only the chevron is ours.
	return (
		<span className={cn("relative block", className)}>
			<select className={cn("ui-field", size === "lg" && "ui-field--lg")} {...rest}>
				{children}
			</select>
			<ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
		</span>
	);
}
