"use client";

/*
 * Light/dark switch for the marketing chrome. It flips the `dark` class the no-FOUC script in
 * layout.tsx reads, and remembers the choice; storage can be blocked, so that write may fail quietly.
 */
import { Moon, Sun } from "lucide-react";
import { buttonClass } from "@/components/ui";

// Marketing chrome passes "lg" so the key matches the 48px nav action; small screens keep "sm" with its 44px hit target.
export function ThemeToggle({ size = "sm" }: { size?: "sm" | "lg" }) {
	function toggle() {
		const isDark = document.documentElement.classList.toggle("dark");
		try {
			localStorage.setItem("theme", isDark ? "dark" : "light");
		} catch {}
	}

	return (
		<button type="button" onClick={toggle} aria-label="Toggle dark mode" title="Toggle theme" className={buttonClass({ variant: "ghost", size, className: size === "lg" ? "w-12 px-0" : "w-8 px-0" })}>
			<Moon className="size-4 dark:hidden" aria-hidden="true" />
			<Sun className="hidden size-4 dark:block" aria-hidden="true" />
		</button>
	);
}
