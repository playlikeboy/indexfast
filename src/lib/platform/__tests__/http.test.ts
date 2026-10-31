import { describe, expect, it, vi } from "vitest";
import { ApiRequestLimitError } from "@/lib/platform/api-keys";
import { GENERIC_ERROR_MESSAGE, intParam, mcpUsageEntries, publicErrorMessage, statusForError } from "@/lib/platform/http";

class FakeDrizzleQueryError extends Error {}

describe("error mapping", () => {
	it("passes domain errors through with their status", () => {
		expect(publicErrorMessage(new Error("Site not found"))).toBe("Site not found");
		expect(statusForError(new Error("Site not found"))).toBe(404);
		expect(statusForError(new Error("Missing required scope: sites:write"))).toBe(401);
		expect(statusForError(new ApiRequestLimitError("limit"))).toBe(429);
		expect(statusForError(new SyntaxError("bad json"))).toBe(400);
	});

	it("hides DB and runtime errors behind a generic 500", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const dbError = new FakeDrizzleQueryError('Failed query: select * from "users" where id = $1');
		expect(publicErrorMessage(dbError)).toBe(GENERIC_ERROR_MESSAGE);
		expect(statusForError(dbError)).toBe(500);
		expect(statusForError(new TypeError("x is undefined"))).toBe(500);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});

describe("intParam", () => {
	it("falls back on junk and clamps to the range", () => {
		expect(intParam("abc", 50, 1, 100)).toBe(50);
		expect(intParam(null, 50, 1, 100)).toBe(50);
		expect(intParam("500", 50, 1, 100)).toBe(100);
		expect(intParam("-3", 50, 1, 100)).toBe(1);
		expect(intParam("7.9", 50, 1, 100)).toBe(7);
	});
});

describe("mcpUsageEntries", () => {
	it("bills each tools/call and resources/read request in a batch", () => {
		const entries = mcpUsageEntries([
			{ id: 1, method: "initialize" },
			{ id: 2, method: "tools/call", params: { name: "list_sites" } },
			{ id: 3, method: "tools/call", params: { name: "submit_urls" } },
			{ id: 4, method: "resources/read", params: { uri: "indexfast://sites" } },
			{ id: 5, method: "tools/list" },
		]);
		expect(entries).toHaveLength(3);
		expect(entries.map((entry) => entry.metadata)).toEqual([
			{ transport: "mcp", rpc: "tools/call", tool: "list_sites" },
			{ transport: "mcp", rpc: "tools/call", tool: "submit_urls" },
			{ transport: "mcp", rpc: "resources/read", uri: "indexfast://sites" },
		]);
	});

	it("does not bill notifications, which are never executed", () => {
		expect(mcpUsageEntries([{ method: "tools/call", params: { name: "x" } }])).toHaveLength(0);
	});
});
