"use client";

/**
 * Fires the account_created conversion event once, on the dashboard visit that created
 * the user's mirror row (mounted by the dashboard layout only when ensureUserRow
 * reports created). Carries the tab's outreach attribution (if any) and the Stack
 * user id so a later trial_started event can be joined back to this signup.
 */
import { useEffect, useRef } from "react";
import { sendAttributionEvent } from "@/lib/attribution";

export function AttributionBeacon({ userId }: { userId: string }) {
	const fired = useRef(false);
	useEffect(() => {
		if (fired.current) return;
		fired.current = true;
		sendAttributionEvent("account_created", "/dashboard", userId);
	}, [userId]);
	return null;
}
