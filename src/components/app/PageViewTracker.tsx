"use client";

/**
 * Sends one beacon per client-side route change to /api/track (see that route for
 * privacy notes). Also captures outreach attribution params (?ifb/ifl/ifs) into
 * sessionStorage and fires the landing_viewed conversion event on "/".
 */
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { captureAttributionFromUrl, sendAttributionEvent } from "@/lib/attribution";

export function PageViewTracker() {
	const pathname = usePathname();

	useEffect(() => {
		if (!pathname || pathname.startsWith("/admin")) return;
		captureAttributionFromUrl();
		const body = JSON.stringify({ path: pathname, referrer: document.referrer });
		try {
			if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
				void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
			}
		} catch {
			// ignore
		}
		if (pathname === "/") {
			sendAttributionEvent("landing_viewed", "/");
		}
	}, [pathname]);

	return null;
}
