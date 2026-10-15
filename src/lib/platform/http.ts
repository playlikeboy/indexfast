import { authenticateApiRequest, recordApiUsage, type AuthenticatedApiKey } from "./api-keys";
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

/** Map domain errors to HTTP codes: auth problems 401, quota 429, missing rows 404, else 400. */
export function statusForError(error: unknown) {
	const message = error instanceof Error ? error.message : "";
	if (/limit reached/i.test(message)) return 429;
	if (/bearer|invalid or revoked|missing required scope/i.test(message)) return 401;
	if (/not found/i.test(message)) return 404;
	return 400;
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
		statusCode = statusForError(error);
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
