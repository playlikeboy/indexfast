/**
 * Quota window keys for engines whose daily quotas reset at local midnight in their own time
 * zone (Google: Pacific, Yandex: Moscow, Baidu: Beijing). Using the engine's zone instead of
 * UTC keeps our counters in step with the engine's, so we neither stop early nor overshoot.
 * Pure functions: no DB, safe to unit test.
 */

function zonedParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).formatToParts(date);
	const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
	return {
		day: `${get("year")}-${get("month")}-${get("day")}`,
		// Some runtimes print midnight as "24".
		hour: Number(get("hour")) % 24,
		minute: Number(get("minute")),
		second: Number(get("second")),
	};
}

/** "2026-11-01" in the given zone. */
export function quotaDay(date: Date, timeZone: string) {
	return zonedParts(date, timeZone).day;
}

/** "2026-11-01T10:05" (UTC); per-minute windows do not depend on the zone. */
export function quotaMinute(date: Date) {
	return date.toISOString().slice(0, 16);
}

/** Seconds until the next local midnight in the zone (at least 60, so callers never spin). */
export function secondsUntilMidnight(timeZone: string, now = new Date()) {
	const { hour, minute, second } = zonedParts(now, timeZone);
	return Math.max(60, 24 * 3600 - (hour * 3600 + minute * 60 + second));
}
