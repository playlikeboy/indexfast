"use client";

/**
 * App theme toggle as a ghost key. Flips the `.dark` class the no-FOUC script in layout.tsx
 * reads, and remembers the choice; storage can be blocked, so a failed write is ignored and the
 * toggle still works for this page view.
 */
import { Moon, Sun } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function AppThemeToggle() {
	return (
		<button
			type="button"
			aria-label="Toggle dark mode"
			title="Toggle theme"
			className={buttonClass({ variant: "ghost", size: "sm", className: "w-8 px-0" })}
			onClick={() => {
				const isDark = document.documentElement.classList.toggle("dark");
				try {
					localStorage.setItem("theme", isDark ? "dark" : "light");
				} catch {
					// Private mode or blocked storage: the theme still applies until reload.
				}
			}}
		>
			<Sun className="hidden size-4 dark:block" aria-hidden="true" />
			<Moon className="size-4 dark:hidden" aria-hidden="true" />
		</button>
	);
}
