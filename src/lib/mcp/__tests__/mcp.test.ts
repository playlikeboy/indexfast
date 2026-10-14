import { describe, expect, it } from "vitest";
import { handleMcpRequest } from "@/lib/mcp/server";
import type { AuthenticatedApiKey } from "@/lib/platform/api-keys";

const mockAuth: AuthenticatedApiKey = {
	apiKeyId: "test-key-id",
	userId: "test-user-id",
	name: "Test Key",
	scopes: ["sites:read", "sites:write", "submissions:write", "diagnostics:write", "resources:read", "billing:read", "mcp:use"],
	billingTier: "growth",
};

describe("MCP Server JSON-RPC Protocol", () => {
	it("handles initialize method correctly", async () => {
		const res = await handleMcpRequest(mockAuth, {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: { protocolVersion: "2025-11-25" },
		});

		expect(res.jsonrpc).toBe("2.0");
		expect(res.id).toBe(1);
		expect("result" in res).toBe(true);
		if ("result" in res) {
			const result = res.result as { serverInfo: { name: string } };
			expect(result.serverInfo.name).toBe("indexfast");
		}
	});

	it("lists available MCP tools", async () => {
		const res = await handleMcpRequest(mockAuth, {
			jsonrpc: "2.0",
			id: 2,
			method: "tools/list",
		});

		expect("result" in res).toBe(true);
		if ("result" in res) {
			const result = res.result as { tools: Array<{ name: string }> };
			expect(Array.isArray(result.tools)).toBe(true);
			expect(result.tools.some((t) => t.name === "list_sites")).toBe(true);
			expect(result.tools.some((t) => t.name === "run_diagnostics")).toBe(true);
			expect(result.tools.some((t) => t.name === "list_directories")).toBe(true);
		}
	});

	it("executes list_directories tool call", async () => {
		const res = await handleMcpRequest(mockAuth, {
			jsonrpc: "2.0",
			id: 3,
			method: "tools/call",
			params: {
				name: "list_directories",
				arguments: { priority: "P0" },
			},
		});

		expect("result" in res).toBe(true);
		if ("result" in res) {
			const result = res.result as { content: Array<{ type: string; text: string }> };
			expect(Array.isArray(result.content)).toBe(true);
			expect(result.content[0].type).toBe("text");
			const parsed = JSON.parse(result.content[0].text);
			expect(Array.isArray(parsed)).toBe(true);
			expect(parsed.length).toBeGreaterThan(0);
		}
	});

	it("lists and gets prompts", async () => {
		const listRes = await handleMcpRequest(mockAuth, {
			jsonrpc: "2.0",
			id: 4,
			method: "prompts/list",
		});
		expect("result" in listRes).toBe(true);
		if ("result" in listRes) {
			const listResult = listRes.result as { prompts: Array<{ name: string }> };
			expect(listResult.prompts.some((p) => p.name === "pseo_launch_audit")).toBe(true);
		}

		const getRes = await handleMcpRequest(mockAuth, {
			jsonrpc: "2.0",
			id: 5,
			method: "prompts/get",
			params: { name: "pseo_launch_audit" },
		});
		expect("result" in getRes).toBe(true);
		if ("result" in getRes) {
			const getResult = getRes.result as { messages: Array<{ content: { text: string } }> };
			expect(getResult.messages[0].content.text).toContain("Audit this pSEO launch");
		}
	});

	it("returns error for unknown method", async () => {
		const res = await handleMcpRequest(mockAuth, {
			jsonrpc: "2.0",
			id: 6,
			method: "non_existent_method",
		});
		expect("error" in res).toBe(true);
		if ("error" in res) {
			expect(res.error?.code).toBe(-32601);
		}
	});
});
