/**
 * One-off recovery: move submission jobs that an older release marked `failed` on a rate
 * limit (http_status = 429) back to `queued`, with attempts and throttle_count reset and
 * next_run_at spread over 24 hourly slots per site+engine (see src/lib/automation/requeue.ts),
 * so recovery does not re-trigger the IndexNow ban that failed them.
 *
 * Dry run by default (prints the plan, writes nothing):
 *   bun run scripts/requeue-throttled-jobs.ts
 * Apply:
 *   bun run scripts/requeue-throttled-jobs.ts --apply [--spread-hours=24]
 *
 * Safety: a job is only re-queued when no open (queued/processing) job exists for the same
 * site+URL+engine; that rule is re-checked inside each UPDATE, so a job enqueued by the cron
 * meanwhile cannot violate submission_jobs_open_unique_idx. Only one failed row per
 * site+URL+engine is revived; older duplicates stay failed.
 */
import { neon } from "@neondatabase/serverless";
import { and, desc, eq, gt, inArray, max, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { alias } from "drizzle-orm/pg-core";
import { submissionJobs } from "../src/db/schema";
import { dedupeRequeueCandidates, planRequeueSchedule } from "../src/lib/automation/requeue";

const apply = process.argv.includes("--apply");
const spreadArg = process.argv.find((arg) => arg.startsWith("--spread-hours="));
const spreadHours = spreadArg ? Number(spreadArg.split("=")[1]) : 24;

async function main() {
	const url = process.env.DATABASE_URL?.trim();
	if (!url) throw new Error("DATABASE_URL is not set.");
	if (!Number.isFinite(spreadHours) || spreadHours < 1 || spreadHours > 24 * 7) {
		throw new Error("--spread-hours must be between 1 and 168.");
	}
	const db = drizzle(neon(url));
	const now = new Date();

	const open = alias(submissionJobs, "open_job");
	const noOpenJob = sql`not exists (select 1 from ${open} where ${open.siteId} = ${submissionJobs.siteId} and ${open.loc} = ${submissionJobs.loc} and ${open.engine} = ${submissionJobs.engine} and ${open.status} in ('queued', 'processing'))`;
	const isThrottledFailure = and(eq(submissionJobs.status, "failed"), eq(submissionJobs.httpStatus, 429));

	const failed = await db
		.select({ id: submissionJobs.id, siteId: submissionJobs.siteId, engine: submissionJobs.engine, loc: submissionJobs.loc })
		.from(submissionJobs)
		.where(and(isThrottledFailure, noOpenJob))
		.orderBy(desc(submissionJobs.updatedAt));
	const candidates = dedupeRequeueCandidates(failed);

	// Never schedule ahead of a cooldown a site+engine is still serving.
	const cooldowns = await db
		.select({ siteId: submissionJobs.siteId, engine: submissionJobs.engine, resumeAt: max(submissionJobs.nextRunAt) })
		.from(submissionJobs)
		.where(and(eq(submissionJobs.status, "queued"), eq(submissionJobs.httpStatus, 429), gt(submissionJobs.nextRunAt, now)))
		.groupBy(submissionJobs.siteId, submissionJobs.engine);
	const resumeAt = new Map(
		cooldowns.filter((row) => row.resumeAt).map((row) => [`${row.siteId}:${row.engine}`, new Date(row.resumeAt as Date)]),
	);

	const slots = planRequeueSchedule(candidates, { now, spreadHours, resumeAt });
	const perSite = new Map<string, number>();
	for (const slot of slots) perSite.set(`${slot.siteId} ${slot.engine}`, (perSite.get(`${slot.siteId} ${slot.engine}`) ?? 0) + slot.ids.length);

	console.log(`Failed 429 jobs found: ${failed.length}; revivable after dedup: ${candidates.length}; spread over ${spreadHours}h.`);
	for (const [key, count] of perSite) console.log(`  ${key}: ${count} job(s)`);
	if (!apply) {
		console.log("Dry run: nothing written. Re-run with --apply to re-queue.");
		return;
	}

	let requeued = 0;
	for (const slot of slots) {
		for (let offset = 0; offset < slot.ids.length; offset += 500) {
			const ids = slot.ids.slice(offset, offset + 500);
			try {
				const rows = await db
					.update(submissionJobs)
					.set({
						status: "queued",
						attempts: 0,
						throttleCount: 0,
						lockedAt: null,
						httpStatus: null,
						retryAfterAt: null,
						nextRunAt: slot.nextRunAt,
						lastErrorMessage: "Re-queued after rate-limit recovery.",
						updatedAt: now,
					})
					.where(and(inArray(submissionJobs.id, ids), isThrottledFailure, noOpenJob))
					.returning({ id: submissionJobs.id });
				requeued += rows.length;
			} catch (error) {
				// A concurrent enqueue can still race one statement; skip that chunk, keep going.
				console.error(`Chunk for ${slot.siteId} at ${slot.nextRunAt.toISOString()} skipped:`, error instanceof Error ? error.message : error);
			}
		}
	}
	console.log(`Re-queued ${requeued} job(s).`);
}

main().catch((error) => {
	console.error("requeue-throttled-jobs failed:", error);
	process.exit(1);
});
