import { describe, expect, it } from "vitest";
import { dedupeRequeueCandidates, planRequeueSchedule } from "../requeue";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-11-01T00:00:00.000Z");

function jobs(siteId: string, count: number, engine = "indexnow") {
	return Array.from({ length: count }, (_, i) => ({ id: `${siteId}-${i}`, siteId, engine, loc: `https://${siteId}/p${i}` }));
}

describe("planRequeueSchedule", () => {
	it("spreads each site's jobs evenly over 24 hourly slots", () => {
		const slots = planRequeueSchedule(jobs("a.com", 4800), { now });
		expect(slots).toHaveLength(24);
		expect(slots.every((slot) => slot.ids.length === 200)).toBe(true);
		const times = slots.map((slot) => slot.nextRunAt.getTime() - now.getTime()).sort((x, y) => x - y);
		expect(times[0]).toBe(0);
		expect(times[23]).toBe(23 * HOUR);
	});

	it("schedules sites independently and never before an active cooldown", () => {
		const resumeAt = new Map([["b.com:indexnow", new Date(now.getTime() + 2 * HOUR)]]);
		const slots = planRequeueSchedule([...jobs("a.com", 3), ...jobs("b.com", 3)], { now, resumeAt });
		const b = slots.filter((slot) => slot.siteId === "b.com");
		expect(Math.min(...b.map((slot) => slot.nextRunAt.getTime()))).toBe(now.getTime() + 2 * HOUR);
		const a = slots.filter((slot) => slot.siteId === "a.com");
		expect(Math.min(...a.map((slot) => slot.nextRunAt.getTime()))).toBe(now.getTime());
		expect(slots.flatMap((slot) => slot.ids).sort()).toHaveLength(6);
	});

	it("uses fewer slots than hours for small groups", () => {
		expect(planRequeueSchedule(jobs("a.com", 1), { now })).toHaveLength(1);
	});
});

describe("dedupeRequeueCandidates", () => {
	it("keeps the first job per site, engine and URL", () => {
		const list = [
			{ id: "1", siteId: "s", engine: "indexnow", loc: "https://s/a" },
			{ id: "2", siteId: "s", engine: "indexnow", loc: "https://s/a" },
			{ id: "3", siteId: "s", engine: "bing", loc: "https://s/a" },
		];
		expect(dedupeRequeueCandidates(list).map((job) => job.id)).toEqual(["1", "3"]);
	});
});
