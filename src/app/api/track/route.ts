/**
 * First-party page view beacon for the admin analytics panel. Cookie-less: visitors are
 * counted with a daily-rotating SHA-256 of ip + user agent, and only the referrer host is
 * kept. Bots and admin/API paths are dropped. Always returns 204 so it never breaks pages.
 *
 * The same endpoint also accepts the four named conversion events
 * (landing_viewed, tool_used, account_created, trial_started) with optional outreach
 * attribution (?ifb/ifl/ifs, see src/lib/attribution.ts), stored in conversion_events
 * under the same guards. trial_started is recorded server-side instead (see
 * activatePaidOrder in razorpay-billing.ts), never from the browser.
 *
 * Abuse guards (the endpoint is public and unauthenticated): only same-origin beacons are
 * accepted, paths are bounded, and a repeat of the same visitor + path within 60 seconds is
 * dropped so a reload loop or script cannot inflate the admin numbers.
 */
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { conversionEvents, pageViews } from "@/db/schema";
import { isAttributionEvent, parseAttribution } from "@/lib/attribution";

const MAX_PATH_LENGTH = 300;
const MAX_BODY_BYTES = 2048;
const DEDUPE_WINDOW_MS = 60_000;

const BOT_PATTERN = /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|monitor|curl|wget|python|axios/i;

/** Browsers send Origin on POST (sendBeacon included); Sec-Fetch-Site covers the rest. */
function isSameOrigin(request: Request) {
	if (request.headers.get("sec-fetch-site") === "same-origin") return true;
	const origin = request.headers.get("origin");
	if (!origin) return false;
	try {
		return new URL(origin).host === new URL(request.url).host;
	} catch {
		return false;
	}
}

function deviceFromUserAgent(ua: string) {
	if (/ipad|tablet/i.test(ua)) return "tablet";
	if (/mobi|android|iphone/i.test(ua)) return "mobile";
	return "desktop";
}

async function sha256(value: string) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function POST(request: Request) {
	try {
		const ua = request.headers.get("user-agent") || "";
		if (!ua || BOT_PATTERN.test(ua) || !isSameOrigin(request)) {
			return new Response(null, { status: 204 });
		}

		// A real beacon is a few hundred bytes; refuse to buffer anything larger.
		if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
			return new Response(null, { status: 204 });
		}
		const raw = await request.text();
		if (raw.length > MAX_BODY_BYTES) {
			return new Response(null, { status: 204 });
		}
		let body: { path?: unknown; referrer?: unknown; event?: unknown; ifb?: unknown; ifl?: unknown; ifs?: unknown; userId?: unknown } = {};
		try {
			body = JSON.parse(raw);
		} catch {
			body = {};
		}
		const path = typeof body.path === "string" ? body.path.split("?")[0] : "";
		if (!path.startsWith("/") || path.length >= MAX_PATH_LENGTH || path.startsWith("/admin") || path.startsWith("/api")) {
			return new Response(null, { status: 204 });
		}

		let referrer: string | null = null;
		if (typeof body.referrer === "string" && body.referrer) {
			try {
				const host = new URL(body.referrer).hostname.replace(/^www\./, "");
				referrer = host && host !== "indexfast.co" ? host : null;
			} catch {
				referrer = null;
			}
		}

		const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "";
		const day = new Date().toISOString().slice(0, 10);
		const visitorHash = await sha256(`${day}|${ip}|${ua}|${process.env.STACK_SECRET_SERVER_KEY || "indexfast"}`);
		const event = isAttributionEvent(body.event) ? body.event : null;
		if (event) {
			// A malformed attribution is dropped but the event is still recorded:
			// funnel counts stay honest, only fully-valid attribution is stored.
			const attribution = parseAttribution({ ifb: body.ifb, ifl: body.ifl, ifs: body.ifs });
			const userId =
				event === "account_created" && typeof body.userId === "string" && body.userId.length > 0 && body.userId.length <= 128
					? body.userId
					: null;
			const [recentEvent] = await db
				.select({ id: conversionEvents.id })
				.from(conversionEvents)
				.where(
					and(
						eq(conversionEvents.visitorHash, visitorHash),
						eq(conversionEvents.event, event),
						eq(conversionEvents.path, path),
						gt(conversionEvents.createdAt, new Date(Date.now() - DEDUPE_WINDOW_MS)),
					),
				)
				.limit(1);
			if (!recentEvent) {
				await db.insert(conversionEvents).values({
					event,
					path,
					visitorHash,
					userId,
					batch: attribution?.batch ?? null,
					leadKey: attribution?.leadKey ?? null,
					stage: attribution?.stage ?? null,
					country: request.headers.get("cf-ipcountry") || null,
					device: deviceFromUserAgent(ua),
				});
			}
			return new Response(null, { status: 204 });
		}
		const [recent] = await db
			.select({ id: pageViews.id })
			.from(pageViews)
			.where(and(eq(pageViews.visitorHash, visitorHash), eq(pageViews.path, path), gt(pageViews.createdAt, new Date(Date.now() - DEDUPE_WINDOW_MS))))
			.limit(1);
		if (recent) {
			return new Response(null, { status: 204 });
		}
		await db.insert(pageViews).values({
			path,
			referrer,
			country: request.headers.get("cf-ipcountry") || null,
			device: deviceFromUserAgent(ua),
			visitorHash,
		});
	} catch {
		// Analytics must never surface errors to visitors.
	}
	return new Response(null, { status: 204 });
}
