/**
 * Outreach attribution identifiers (client-safe: no server imports).
 *
 * Outreach CTA links carry three query params:
 * - ifb: the send batch, a date (YYYYMMDD) — one batch per send day.
 * - ifl: the lead key, the first 8 hex chars of SHA-256(lowercase email), computed by
 *   the outreach side. The site never sees the email address.
 * - ifs: the sequence stage that carried the link: 'e2' (Angle), 'e3' (Breakup) or
 *   'reply'. E1 carries no link by design (Sellbird method).
 *
 * The params are captured into sessionStorage on landing and attached to the named
 * conversion events (see /api/track). Same-tab only: if the visitor closes the tab
 * before signing up, the signup is unattributed. First touch wins within a tab, so a
 * conversion is never counted against two batches. Nothing is fingerprinted beyond
 * the daily-rotating visitor hash the page-view beacon already computes.
 */

export type Attribution = { batch: string; leadKey: string; stage: string };

export const ATTRIBUTION_EVENTS = ["landing_viewed", "tool_used", "account_created", "trial_started"] as const;
export type AttributionEvent = (typeof ATTRIBUTION_EVENTS)[number];

const STORAGE_KEY = "if_attr";

const BATCH_PATTERN = /^\d{8}$/;
const LEAD_KEY_PATTERN = /^[0-9a-f]{8}$/;
const STAGES = new Set(["e2", "e3", "reply"]);

export function isAttributionEvent(value: unknown): value is AttributionEvent {
	return typeof value === "string" && (ATTRIBUTION_EVENTS as readonly string[]).includes(value);
}

/** Validate raw params (from a URL or a beacon body) into an Attribution, or null. */
export function parseAttribution(input: { ifb?: unknown; ifl?: unknown; ifs?: unknown }): Attribution | null {
	const batch = typeof input.ifb === "string" ? input.ifb : "";
	const leadKey = typeof input.ifl === "string" ? input.ifl : "";
	const stage = typeof input.ifs === "string" ? input.ifs : "";
	if (!BATCH_PATTERN.test(batch) || !LEAD_KEY_PATTERN.test(leadKey) || !STAGES.has(stage)) return null;
	return { batch, leadKey, stage };
}

/** Capture ?ifb/ifl/ifs from the current URL into sessionStorage (first touch wins). */
export function captureAttributionFromUrl(): Attribution | null {
	try {
		const params = new URLSearchParams(window.location.search);
		const found = parseAttribution({ ifb: params.get("ifb"), ifl: params.get("ifl"), ifs: params.get("ifs") });
		const existing = getAttribution();
		if (found && !existing) {
			window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
			return found;
		}
		return existing;
	} catch {
		return null;
	}
}

/** Read the attribution captured for this tab, if any. */
export function getAttribution(): Attribution | null {
	try {
		const raw = window.sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) return null;
		const { batch, leadKey, stage } = parsed as Record<string, unknown>;
		return parseAttribution({ ifb: batch, ifl: leadKey, ifs: stage });
	} catch {
		return null;
	}
}

/** Send a named conversion event to /api/track. Never throws; analytics must not break pages. */
export function sendAttributionEvent(event: AttributionEvent, path: string, userId?: string) {
	try {
		const attribution = getAttribution();
		const body = JSON.stringify({
			path,
			event,
			userId: userId || undefined,
			...(attribution ? { ifb: attribution.batch, ifl: attribution.leadKey, ifs: attribution.stage } : {}),
		});
		if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
			void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
		}
	} catch {
		// ignore
	}
}
