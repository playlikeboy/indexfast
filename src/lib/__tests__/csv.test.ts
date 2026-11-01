import { describe, expect, it } from "vitest";
import { csvField, toCsv } from "@/lib/csv";

describe("csv", () => {
	it("quotes commas, quotes and newlines", () => {
		expect(csvField('a,"b"\nc')).toBe('"a,""b""\nc"');
		expect(csvField("plain")).toBe("plain");
		expect(csvField(null)).toBe("");
		expect(csvField(404)).toBe("404");
	});

	it("neutralises formula injection", () => {
		expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
		expect(csvField("-1")).toBe("'-1");
	});

	it("joins rows with CRLF", () => {
		expect(toCsv(["url", "status"], [["https://a.com/", "pass"]])).toBe("url,status\r\nhttps://a.com/,pass\r\n");
	});
});
