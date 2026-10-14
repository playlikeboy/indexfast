import { ApiRequestLimitError, authenticateApiRequest, recordApiUsage, type AuthenticatedApiKey } from "./api-keys";
import type { ApiScope } from "./plans";

export function jsonResponse(data: unknown, status = 200) {
	return Response.json(data, { status });
}

export function errorResponse(error: unknown, status = 400) {
	return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, status);
}

export async function readJsonBody<T extends Record<string, unknown>>(request: Request): Promise<T> {
	if (request.headers.get("content-type")?.includes("application/json") === false) {
		return {} as T;
	}

	const text = await request.text();
	if (!text.trim()) {
		return {} as T;
	}

	return JSON.parse(text) as T;
}

export async function withApiAuth<T>(
	request: Request,
	scopes: ApiScope[],
	handler: (auth: AuthenticatedApiKey) => Promise<T>,
	options?: { requireMcp?: boolean; requireCli?: boolean },
) {
	let auth: AuthenticatedApiKey | null = null;
	let statusCode = 200;
	try {
		auth = await authenticateApiRequest(request, scopes, options);
		const result = await handler(auth);
		return jsonResponse(result, statusCode);
	} catch (error) {
		statusCode = error instanceof ApiRequestLimitError ? 429 : error instanceof Error && /missing|invalid|revoked|scope|requires/i.test(error.message) ? 401 : 400;
		return errorResponse(error, statusCode);
	} finally {
		if (auth) {
			await recordApiUsage({
				apiKeyId: auth.apiKeyId,
				userId: auth.userId,
				method: request.method,
				route: new URL(request.url).pathname,
				statusCode,
			});
		}
	}
}
