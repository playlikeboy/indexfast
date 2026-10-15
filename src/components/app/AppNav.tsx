"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

/** Top navigation for the app. Four destinations only; anything else belongs inside them. */
export function AppNav({ isAdmin }: { isAdmin: boolean }) {
	const pathname = usePathname();
	const items = [
		{ href: "/dashboard", label: "Websites", active: pathname === "/dashboard" || pathname.startsWith("/dashboard/sites") },
		{ href: "/dashboard/connect", label: "Connect AI", active: pathname.startsWith("/dashboard/connect") },
		{ href: "/dashboard/billing", label: "Billing", active: pathname.startsWith("/dashboard/billing") },
		...(isAdmin ? [{ href: "/admin", label: "Admin", active: pathname.startsWith("/admin") }] : []),
	];

	return (
		<nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Main">
			{items.map((item) => (
				<Link
					key={item.href}
					href={item.href}
					aria-current={item.active ? "page" : undefined}
					className={cn(
						"whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm transition",
						item.active ? "border-[var(--app-text)] font-medium text-[var(--app-text)]" : "border-transparent text-[var(--app-muted)] hover:text-[var(--app-text)]",
					)}
				>
					{item.label}
				</Link>
			))}
		</nav>
	);
}
