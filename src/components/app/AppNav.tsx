"use client";

/**
 * Top navigation for the app. Four destinations only; anything else belongs inside them.
 * Links, not tabs: each destination is a route, so the current one is aria-current="page"
 * and carries the cobalt underline (accent marks current selection, per DESIGN.md).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
	const pathname = usePathname();
	const items = [
		{ href: "/dashboard", label: "Websites", active: pathname === "/dashboard" || pathname.startsWith("/dashboard/sites") },
		{ href: "/dashboard/connect", label: "Connect", active: pathname.startsWith("/dashboard/connect") },
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
						"border-b-2 px-3 pt-1 pb-2.5 text-sm whitespace-nowrap transition-colors duration-(--dur-short)",
						item.active ? "border-signal font-medium text-ink" : "border-transparent text-muted hover:text-ink",
					)}
				>
					{item.label}
				</Link>
			))}
		</nav>
	);
}
