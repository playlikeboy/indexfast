import { describe, expect, it } from "vitest";
import { handleMcpRequest, SUPPORTED_PROTOCOL_VERSIONS } from "@/lib/mcp/server";
import type { AuthenticatedApiKey } from "@/lib/platform/api-keys";

const mockAuth: AuthenticatedApiKey = {
	apiKeyId: "test-key-id",
	userId: "test-user-id",
	name: "Test Key",
	scopes: ["sites:read", "sites:write", "submissions:write", "diagnostics:write", "resources:read", "mcp:use"],
	billingTier: "pro",
};

async function call(method: string, params?: Record<string, unknown>, id: number | undefined = 1) {
	const res = await handleMcpRequest(mockAuth, { jsonrpc: "2.0", id, method, params });
	if (!res) throw new Error("expected a response");
	return res as { id: unknown; result?: Record<string, unknown>; error?: { code: number; message: string } };
}

describe("MCP server", () => {
	it("negotiates a supported protocol version and exposes instructions", async () => {
		const res = await call("initialize", { protocolVersion: "2025-06-18" });
		expect(res.result?.protocolVersion).toBe("2025-06-18");
		expect(String(res.result?.instructions)).toContain("verify_site");
	});

	it("falls back to the latest version for unknown clients", async () => {
		const res = await call("initialize", { protocolVersion: "1999-01-01" });
		expect(res.result?.protocolVersion).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
	});

	it("returns null for notifications so HTTP can answer 202", async () => {
		expect(await handleMcpRequest(mockAuth, { jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
	});

	it("lists the vibe-coder tools", async () => {
		const res = await call("tools/list");
		const names = (res.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
		expect(names).toEqual(expect.arrayContaining(["account_status", "add_site", "verify_site", "submit_urls", "list_urls"]));
	});

	it("runs static resource tools without a database", async () => {
		const res = await call("tools/call", { name: "list_directories", arguments: { priority: "P0" } });
		const content = res.result?.content as Array<{ text: string }>;
		expect(res.result?.isError).toBe(false);
		expect(JSON.parse(content[0].text).length).toBeGreaterThan(0);
	});

	it("reports unknown tools as tool errors, not protocol errors", async () => {
		const res = await call("tools/call", { name: "does_not_exist", arguments: {} });
		expect(res.result?.isError).toBe(true);
	});

	it("answers ping and rejects unknown methods", async () => {
		expect((await call("ping")).result).toEqual({});
		expect((await call("nope")).error?.code).toBe(-32601);
	});

	it("renders the setup prompt with the domain", async () => {
		const res = await call("prompts/get", { name: "setup_indexing", arguments: { domain: "example.com" } });
		expect(JSON.stringify(res.result)).toContain("example.com");
	});

	it("lists Bing and search engine automation tools", async () => {
		const res = await call("tools/list");
		const names = (res.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"set_bing_api_key",
				"get_bing_status",
				"set_bing_auto_submit",
				"remove_bing_api_key",
				"list_search_engines",
				"get_submission_queue",
				"process_submission_queue",
			]),
		);
	});

	it("calls list_search_engines tool and returns specifications", async () => {
		const res = await call("tools/call", { name: "list_search_engines", arguments: { engineId: "bing" } });
		const content = res.result?.content as Array<{ text: string }>;
		expect(res.result?.isError).toBe(false);
		const data = JSON.parse(content[0].text);
		expect(data.id).toBe("bing");
		expect(data.name).toBe("Microsoft Bing");
	});

	it("reads search-engines resource via URI", async () => {
		const res = await call("resources/read", { uri: "indexfast://resources/search-engines" });
		const contents = res.result?.contents as Array<{ text: string }>;
		expect(contents).toBeDefined();
		const engines = JSON.parse(contents[0].text);
		expect(Array.isArray(engines)).toBe(true);
		expect(engines.length).toBeGreaterThanOrEqual(6);
	});
});
