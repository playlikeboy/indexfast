import { ApiRequestLimitError, authenticateApiRequest, recordApiUsage } from "@/lib/platform/api-keys";
import { handleMcpRequest, type JsonRpcRequest } from "@/lib/mcp/server";
import type { AuthenticatedApiKey } from "@/lib/platform/api-keys";

export async function GET() {
	return Response.json({
		name: "IndexFast MCP",
		endpoint: "https://indexfast.co/api/mcp",
		transport: "streamable-http",
		authentication: "Bearer API key",
	});
}

export async function POST(request: Request) {
	let auth: AuthenticatedApiKey | null = null;
	let statusCode = 200;
	try {
		auth = await authenticateApiRequest(request, ["mcp:use"], { requireMcp: true });
		const authenticated = auth;
		const body = (await request.json()) as JsonRpcRequest | JsonRpcRequest[];
		const result = Array.isArray(body)
			? await Promise.all(body.map((entry) => handleMcpRequest(authenticated, entry)))
			: await handleMcpRequest(authenticated, body);
		return Response.json(result, { status: statusCode });
	} catch (error) {
		statusCode = error instanceof ApiRequestLimitError ? 429 : error instanceof Error && /missing|invalid|revoked|scope|requires/i.test(error.message) ? 401 : 400;
		return Response.json(
			{
				jsonrpc: "2.0",
				id: null,
				error: {
					code: statusCode === 401 ? -32001 : statusCode === 429 ? -32002 : -32000,
					message: error instanceof Error ? error.message : "Unknown MCP error",
				},
			},
			{ status: statusCode },
		);
	} finally {
		if (auth) {
			await recordApiUsage({
				apiKeyId: auth.apiKeyId,
				userId: auth.userId,
				method: request.method,
				route: new URL(request.url).pathname,
				statusCode,
				metadata: { transport: "mcp" },
			});
		}
	}
}
