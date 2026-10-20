"use client";

/** Sends one beacon per client-side route change to /api/track (see that route for privacy notes). */
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function PageViewTracker() {
	const pathname = usePathname();

	useEffect(() => {
		if (!pathname || pathname.startsWith("/admin")) return;
		const body = JSON.stringify({ path: pathname, referrer: document.referrer });
		try {
			if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
				void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
			}
		} catch {
			// ignore
		}
	}, [pathname]);

	return null;
}
