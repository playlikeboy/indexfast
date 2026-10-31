/*
 * Keycap button. One primary per screen (the solid cobalt key); everything else is a key-face
 * secondary, a ghost, or a danger key. Covers the eight states: hover lift, focus ring, press
 * sink, disabled (native attribute + opacity + cursor), loading (aria-busy, label stays, width
 * does not jump); error and success belong to the form around it, never to the button.
 * Server-compatible: no hooks. Use buttonClass() to dress a Link as a button.
 */
import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
	primary: "ui-key--primary",
	secondary: "",
	ghost: "ui-key--ghost",
	danger: "ui-key--danger",
};

const sizeClass: Record<ButtonSize, string> = {
	sm: "ui-key--sm",
	md: "",
	lg: "ui-key--lg",
};

export function buttonClass({ variant = "secondary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
	return cn("ui-key", variantClass[variant], sizeClass[size], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
};

export function Button({ variant = "secondary", size = "md", loading = false, type = "button", disabled, className, children, ...rest }: ButtonProps) {
	return (
		<button
			type={type}
			// A busy button stays in the tab order but cannot submit twice.
			disabled={disabled || loading}
			aria-busy={loading || undefined}
			className={buttonClass({ variant, size, className })}
			{...rest}
		>
			{loading ? <LoaderCircle aria-hidden="true" className="keep-motion size-4 shrink-0 animate-spin" /> : null}
			{children}
		</button>
	);
}
