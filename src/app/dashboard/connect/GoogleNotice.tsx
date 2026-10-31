"use client";

/**
 * One-time result of the Google OAuth redirect. The server reads ?google=&reason= on the first
 * render; this strips them from the URL on mount, so a reload or an action's refresh re-renders
 * without the params and the notice does not come back after it stops being true.
 * history.replaceState (not router.replace) on purpose: it changes the URL without a new server
 * render, so the notice stays visible for this view.
 */
import { useEffect } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { cn } from "@/components/ui";

export type GoogleNoticeData = { ok: boolean; text: string };

export function GoogleNotice({ notice }: { notice: GoogleNoticeData }) {
	useEffect(() => {
		window.history.replaceState(window.history.state, "", window.location.pathname);
	}, []);

	const Icon = notice.ok ? CircleCheck : CircleX;
	return (
		<div role={notice.ok ? "status" : "alert"} className={cn("ui-cut ui-cut-sm mb-6 flex items-start gap-2 border-transparent px-4 py-3 text-sm", notice.ok ? "bg-success-wash" : "bg-danger-wash")}>
			<Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", notice.ok ? "text-success" : "text-danger")} />
			<span className="text-ink">{notice.text}</span>
		</div>
	);
}
