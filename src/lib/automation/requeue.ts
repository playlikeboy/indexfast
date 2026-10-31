/**
 * Recovery plan for jobs that an older release marked failed on IndexNow/Bing 429s (before
 * rate limits stopped counting as failures). Pure so it is unit tested; the DB side lives in
 * scripts/requeue-throttled-jobs.ts.
 *
 * Re-queueing thousands of URLs as due-now would re-trigger the very ban that failed them, so
 * each site+engine's jobs are spread evenly over hourly slots (24h by default), starting no
 * earlier than any cooldown that site+engine is still serving.
 */
const HOUR_MS = 60 * 60 * 1000;

export type RequeueCandidate = { id: string; siteId: string; engine: string };
export type RequeueSlot = { siteId: string; engine: string; nextRunAt: Date; ids: string[] };

export function planRequeueSchedule(
	jobs: RequeueCandidate[],
	options: { now: Date; spreadHours?: number; resumeAt?: Map<string, Date> },
): RequeueSlot[] {
	const spreadHours = Math.max(1, Math.floor(options.spreadHours ?? 24));
	const groups = new Map<string, RequeueCandidate[]>();
	for (const job of jobs) {
		const key = `${job.siteId}:${job.engine}`;
		groups.set(key, [...(groups.get(key) ?? []), job]);
	}

	return Array.from(groups.entries()).flatMap(([key, group]) => {
		const cooldown = options.resumeAt?.get(key);
		const start = cooldown && cooldown > options.now ? cooldown : options.now;
		const slots = new Map<number, string[]>();
		group.forEach((job, index) => {
			const slot = Math.floor((index * spreadHours) / group.length);
			slots.set(slot, [...(slots.get(slot) ?? []), job.id]);
		});
		return Array.from(slots.entries()).map(([slot, ids]) => ({
			siteId: group[0].siteId,
			engine: group[0].engine,
			nextRunAt: new Date(start.getTime() + slot * HOUR_MS),
			ids,
		}));
	});
}

/** One failed job per (site, loc, engine): the open-job unique index allows only one to be queued. */
export function dedupeRequeueCandidates<T extends RequeueCandidate & { loc: string }>(jobs: T[]): T[] {
	const seen = new Set<string>();
	return jobs.filter((job) => {
		const key = `${job.siteId}\u0000${job.engine}\u0000${job.loc}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
