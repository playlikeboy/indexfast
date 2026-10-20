/**
 * First-party page view beacon for the admin analytics panel. Cookie-less: visitors are
 * counted with a daily-rotating SHA-256 of ip + user agent, and only the referrer host is
 * kept. Bots and admin/API paths are dropped. Always returns 204 so it never breaks pages.
 */
import { db } from "@/db";
import { pageViews } from "@/db/schema";

const BOT_PATTERN = /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|monitor|curl|wget|python|axios/i;

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
		if (!ua || BOT_PATTERN.test(ua)) {
			return new Response(null, { status: 204 });
		}

		const body = (await request.json().catch(() => ({}))) as { path?: unknown; referrer?: unknown };
		const path = typeof body.path === "string" ? body.path.split("?")[0].slice(0, 300) : "";
		if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) {
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
		await db.insert(pageViews).values({
			path,
			referrer,
			country: request.headers.get("cf-ipcountry") || null,
			device: deviceFromUserAgent(ua),
			visitorHash: await sha256(`${day}|${ip}|${ua}|${process.env.STACK_SECRET_SERVER_KEY || "indexfast"}`),
		});
	} catch {
		// Analytics must never surface errors to visitors.
	}
	return new Response(null, { status: 204 });
}
