/**
 * MCP endpoint (Streamable HTTP, stateless JSON responses). Auth is an IndexFast API key
 * sent as `Authorization: Bearer idxf_...`. Available on every plan; the monthly request
 * quota in plans.ts is the only gate. Setup instructions: /dashboard/connect, docs/mcp.md.
 */
import { authenticateApiRequest, recordApiUsage, type AuthenticatedApiKey } from "@/lib/platform/api-keys";
import { statusForError } from "@/lib/platform/http";
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

export async function POST(request: Request) {
	let auth: AuthenticatedApiKey | null = null;
	let statusCode = 200;
	let toolName: string | undefined;
	try {
		auth = await authenticateApiRequest(request, ["mcp:use"], { requireMcp: true });
		const authenticated = auth;
		const body = (await request.json()) as JsonRpcRequest | JsonRpcRequest[];
		if (!Array.isArray(body) && body.method === "tools/call") {
			toolName = typeof body.params?.name === "string" ? body.params.name : undefined;
		}

		const responses = (
			await Promise.all((Array.isArray(body) ? body : [body]).map((entry) => handleMcpRequest(authenticated, entry)))
		).filter((response) => response !== null);

		if (responses.length === 0) {
			statusCode = 202;
			return new Response(null, { status: 202 });
		}
		return Response.json(Array.isArray(body) ? responses : responses[0]);
	} catch (error) {
		statusCode = statusForError(error);
		return Response.json(
			{
				jsonrpc: "2.0",
				id: null,
				error: { code: statusCode === 401 ? -32001 : -32000, message: error instanceof Error ? error.message : "Unknown MCP error" },
			},
			{ status: statusCode, headers: statusCode === 401 ? { "WWW-Authenticate": 'Bearer realm="indexfast"' } : undefined },
		);
	} finally {
		// Only tool calls count toward the monthly quota; handshakes and listings are free.
		if (auth && toolName) {
			await recordApiUsage({
				apiKeyId: auth.apiKeyId,
				userId: auth.userId,
				method: request.method,
				route: "/api/mcp",
				statusCode,
				metadata: { transport: "mcp", tool: toolName },
			}).catch(() => undefined);
		}
	}
}
