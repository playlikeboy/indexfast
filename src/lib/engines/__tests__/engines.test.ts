import { describe, expect, it } from "vitest";
import { resolveExtraEngines } from "../extra-engines";
import { quotaDay, quotaMinute, secondsUntilMidnight } from "../quota-windows";

describe("resolveExtraEngines", () => {
	const ready = { ready: true, automationEnabled: true };
	const state = { google_indexing_api: ready, yandex: ready, baidu: { ready: true, automationEnabled: false } };
	const paid = { googleIndexingApi: true, yandex: true, baidu: true };

	it("needs the plan flag and complete setup", () => {
		expect(resolveExtraEngines(state, paid, false)).toEqual(["google_indexing_api", "yandex"]);
		expect(resolveExtraEngines(state, { googleIndexingApi: false, yandex: false, baidu: false }, true)).toEqual([]);
		expect(resolveExtraEngines({ yandex: { ready: false, automationEnabled: true } }, paid, true)).toEqual([]);
		expect(resolveExtraEngines(undefined, paid, true)).toEqual([]);
	});

	it("manual submits ignore the Yandex/Baidu toggle but never switch on the Google Indexing API", () => {
		expect(resolveExtraEngines(state, paid, true)).toEqual(["google_indexing_api", "yandex", "baidu"]);
		const googleOff = { ...state, google_indexing_api: { ready: true, automationEnabled: false } };
		expect(resolveExtraEngines(googleOff, paid, true)).toEqual(["yandex", "baidu"]);
	});
});

describe("quota windows", () => {
	it("uses the engine's own calendar day", () => {
		const instant = new Date("2026-11-01T05:30:00Z");
		expect(quotaDay(instant, "America/Los_Angeles")).toBe("2026-10-31");
		expect(quotaDay(instant, "Asia/Shanghai")).toBe("2026-11-01");
		expect(quotaMinute(instant)).toBe("2026-11-01T05:30");
	});

	it("counts down to local midnight", () => {
		expect(secondsUntilMidnight("UTC", new Date("2026-11-01T23:00:00Z"))).toBe(3600);
		expect(secondsUntilMidnight("UTC", new Date("2026-11-01T23:59:30Z"))).toBe(60);
	});
});
