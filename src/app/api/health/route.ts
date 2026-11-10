/**
 * Public liveness + freshness probe for uptime monitors and the daily smoke test.
 *
 * Why: a missing cron trigger or a missing DATABASE_URL secret makes the scheduled handler throw
 * before it writes a cron_runs row, so nothing in the app ever shows the outage. This endpoint
 * turns "the database is unreachable" and "no successful cron run in 2 hours" into a 503 that an
 * external monitor can alert on. It exposes only coarse status and timestamps, never errors or data.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cronRuns } from "@/db/schema";

export const dynamic = "force-dynamic";

// The cron is hourly; two missed runs in a row is an outage, one can be a slow run.
const CRON_STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export async function GET() {
	const headers = { "Cache-Control": "no-store" };
	try {
		const [lastSuccess] = await db
			.select({ finishedAt: cronRuns.finishedAt })
			.from(cronRuns)
			.where(eq(cronRuns.status, "success"))
			.orderBy(desc(cronRuns.startedAt))
			.limit(1);
		const lastCronAt = lastSuccess?.finishedAt ?? null;
		const cronFresh = Boolean(lastCronAt && Date.now() - lastCronAt.getTime() < CRON_STALE_AFTER_MS);
		return Response.json(
			{ status: cronFresh ? "ok" : "degraded", database: "ok", cron: cronFresh ? "ok" : "stale", lastCronAt },
			{ status: cronFresh ? 200 : 503, headers },
		);
	} catch {
		return Response.json({ status: "down", database: "unreachable" }, { status: 503, headers });
	}
}
