/*
 * Guards the comparison catalog: unique slugs, a dated fact check and a source link per entry,
 * and no competitor price figures (we never state them; see marketing-data.ts).
 */
import { describe, expect, it } from "vitest";
import { comparisons } from "@/lib/marketing-data";

describe("comparisons", () => {
	it("has unique slugs, a checked date and an https source", () => {
		expect(new Set(comparisons.map((c) => c.slug)).size).toBe(comparisons.length);
		for (const item of comparisons) {
			expect(item.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(item.competitorUrl).toMatch(/^https:\/\//);
		}
	});

	it("never states a competitor price figure", () => {
		for (const item of comparisons) {
			const competitorText = [item.competitorPricing, ...item.rows.map((r) => r.competitor)].join(" ");
			expect(competitorText).not.toMatch(/[$€£]\s?\d/);
		}
	});
});
