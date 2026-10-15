"use client";

/** App-styled theme toggle; the marketing ThemeToggle uses brutalist styles that clash here. */
import { Moon, Sun } from "lucide-react";
import { buttonClass, cn } from "./ui";

export function AppThemeToggle() {
	return (
		<button
			type="button"
			aria-label="Toggle dark mode"
			title="Toggle theme"
			className={cn(buttonClass.ghost, "h-8 w-8 px-0")}
			onClick={() => {
				const isDark = document.documentElement.classList.toggle("dark");
				try {
					localStorage.setItem("theme", isDark ? "dark" : "light");
				} catch {}
			}}
		>
			<Sun className="hidden h-4 w-4 dark:block" aria-hidden />
			<Moon className="h-4 w-4 dark:hidden" aria-hidden />
		</button>
	);
}
