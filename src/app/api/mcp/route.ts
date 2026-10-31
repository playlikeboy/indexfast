/**
 * MCP endpoint (Streamable HTTP, stateless JSON responses). Auth is an IndexFast API key
 * sent as `Authorization: Bearer idxf_...`. Available on every plan; the monthly request
 * quota in plans.ts is the only gate. Setup instructions: /dashboard/connect, docs/mcp.md.
 *
 * Billing rules: every tools/call and resources/read entry (also inside a JSON-RPC batch) is
 * one usage row, reserved before any entry runs, so a batch cannot exceed the quota. Batches
 * are capped at MCP_MAX_BATCH entries. Errors never carry raw DB/runtime text.
 */
import { authenticateApiRequest, finalizeApiUsage, reserveApiUsage } from "@/lib/platform/api-keys";
import { MCP_MAX_BATCH, mcpUsageEntries, publicErrorMessage, statusForError } from "@/lib/platform/http";
import { handleMcpRequest, type JsonRpcRequest } from "@/lib/mcp/server";

export async function GET(request: Request) {
	// Spec: a server without a server-initiated SSE stream answers GET with 405.
	if (request.headers.get("accept")?.includes("text/event-stream")) {
		return new Response(null, { status: 405, headers: { Allow: "POST" } });
	}
	return Response.json({
		name: "IndexFast MCP",
		endpoint: "https://indexfast.co/api/mcp",
		transport: "streamable-http",
		authentication: "Authorization: Bearer <IndexFast API key>",
		setup: "https://indexfast.co/dashboard/connect",
	});
}

export async function DELETE() {
	return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

function rpcError(status: number, code: number, message: string) {
	return Response.json(
		{ jsonrpc: "2.0", id: null, error: { code, message } },
		{ status, headers: status === 401 ? { "WWW-Authenticate": 'Bearer realm="indexfast"' } : undefined },
	);
}

export async function POST(request: Request) {
	let usageIds: string[] = [];
	let statusCode = 200;
	try {
		const auth = await authenticateApiRequest(request, ["mcp:use"], { requireMcp: true });
		const body = (await request.json()) as JsonRpcRequest | JsonRpcRequest[];
		const entries = Array.isArray(body) ? body : [body];
		if (entries.length === 0 || entries.length > MCP_MAX_BATCH || entries.some((entry) => !entry || typeof entry !== "object")) {
			statusCode = 400;
			return rpcError(400, -32600, `Invalid request: send one JSON-RPC object or a batch of 1-${MCP_MAX_BATCH}.`);
		}

		usageIds = await reserveApiUsage(auth, mcpUsageEntries(entries));

		const responses = (await Promise.all(entries.map((entry) => handleMcpRequest(auth, entry)))).filter((response) => response !== null);

		if (responses.length === 0) {
			statusCode = 202;
			return new Response(null, { status: 202 });
		}
		return Response.json(Array.isArray(body) ? responses : responses[0]);
	} catch (error) {
		statusCode = statusForError(error);
		if (error instanceof SyntaxError) {
			return rpcError(400, -32700, "Parse error: invalid JSON");
		}
		const code = statusCode === 401 ? -32001 : statusCode === 429 ? -32002 : -32000;
		return rpcError(statusCode, code, publicErrorMessage(error));
	} finally {
		await finalizeApiUsage(usageIds, statusCode).catch(() => undefined);
	}
}
