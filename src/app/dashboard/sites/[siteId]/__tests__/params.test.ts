import { describe, expect, it } from "vitest";
import { MAX_PAGE, firstParam, isUuid, parsePageNumber } from "../params";

describe("site page params", () => {
	it("takes the first value of a repeated param", () => {
		expect(firstParam(["urls", "queue"])).toBe("urls");
		expect(firstParam("urls")).toBe("urls");
		expect(firstParam(undefined)).toBeUndefined();
		expect(firstParam([])).toBeUndefined();
	});

	it("clamps the page to 1..MAX_PAGE and floors fractions", () => {
		expect(parsePageNumber(undefined)).toBe(1);
		expect(parsePageNumber("abc")).toBe(1);
		expect(parsePageNumber("0")).toBe(1);
		expect(parsePageNumber("-5")).toBe(1);
		expect(parsePageNumber("2.9")).toBe(2);
		expect(parsePageNumber("1e9")).toBe(MAX_PAGE);
		expect(parsePageNumber("Infinity")).toBe(MAX_PAGE);
		expect(parsePageNumber("7")).toBe(7);
	});

	it("accepts only canonical UUIDs", () => {
		expect(isUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
		expect(isUuid("example.com")).toBe(false);
		expect(isUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301x")).toBe(false);
		expect(isUuid("' or 1=1 --")).toBe(false);
	});
});
