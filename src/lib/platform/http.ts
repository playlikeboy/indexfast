/**
 * Shared HTTP plumbing for /api/v1 and /api/mcp: Bearer auth, reserve-then-check quota,
 * error-to-status mapping, and safe parsing of query params.
 *
 * Error rule: only our own domain errors (plain `Error` thrown on purpose by the service
 * layer, or the typed quota error) reach the caller verbatim. Anything else (Drizzle/Neon
 * query errors carry SQL and parameters, runtime TypeErrors, ...) is logged and replaced by
 * a generic message so internals never leak through the API.
 */
import { ApiRequestLimitError, authenticateApiRequest, finalizeApiUsage, reserveApiUsage, type AuthenticatedApiKey } from "./api-keys";
import type { ApiScope } from "./plans";

export const GENERIC_ERROR_MESSAGE = "Something went wrong, please try again.";

export function jsonResponse(data: unknown, status = 200) {
	return Response.json(data, { status });
}

/** True for errors whose message is written for users (thrown deliberately by our code). */
export function isDomainError(error: unknown): error is Error {
	return error instanceof ApiRequestLimitError || (error instanceof Error && error.constructor === Error);
}

/** The message safe to show a caller; logs and hides everything that is not a domain error. */
export function publicErrorMessage(error: unknown) {
	if (isDomainError(error)) return error.message;
	if (error instanceof SyntaxError) return "Invalid JSON body.";
	console.error("Unexpected API error", error);
	return GENERIC_ERROR_MESSAGE;
}

export function errorResponse(error: unknown, status = 400) {
	return jsonResponse({ error: publicErrorMessage(error) }, status);
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

/** Map domain errors to HTTP codes: auth problems 401, quota 429, missing rows 404, else 400; unexpected errors 500. */
export function statusForError(error: unknown) {
	if (error instanceof ApiRequestLimitError) return 429;
	if (error instanceof SyntaxError) return 400;
	if (!isDomainError(error)) return 500;
	const message = error.message;
	if (/bearer|invalid or revoked|missing required scope/i.test(message)) return 401;
	if (/not found/i.test(message)) return 404;
	return 400;
}

/**
 * Integer query param with a fallback: `?limit=abc` must not reach SQL as NaN.
 * Clamped to [min, max] so a caller cannot ask for an unbounded page.
 */
export function intParam(value: string | null | undefined, fallback: number, min: number, max: number) {
	const parsed = value === null || value === undefined || value.trim() === "" ? Number.NaN : Number(value);
	const number = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
	return Math.min(max, Math.max(min, number));
}

/** Upper bound on JSON-RPC batch size: one HTTP request must not fan out into unbounded work. */
export const MCP_MAX_BATCH = 20;

/** MCP methods that do real work and count toward the monthly quota; handshakes and listings are free. */
const BILLABLE_MCP_METHODS = new Set(["tools/call", "resources/read"]);

/**
 * One usage entry per billable JSON-RPC request in the body (single or batch). Notifications
 * (no id) are never executed, so they are not billed. Counting per entry closes the hole
 * where a batch of N tool calls was billed as a single request.
 */
export function mcpUsageEntries(entries: Array<{ id?: unknown; method?: unknown; params?: Record<string, unknown> }>) {
	return entries
		.filter((entry) => entry.id !== undefined && typeof entry.method === "string" && BILLABLE_MCP_METHODS.has(entry.method))
		.map((entry) => {
			const params = entry.params || {};
			const target = entry.method === "tools/call" ? { tool: typeof params.name === "string" ? params.name : null } : { uri: typeof params.uri === "string" ? params.uri : null };
			return { method: "POST", route: "/api/mcp", metadata: { transport: "mcp", rpc: entry.method as string, ...target } };
		});
}

export async function withApiAuth<T>(
	request: Request,
	scopes: ApiScope[],
	handler: (auth: AuthenticatedApiKey) => Promise<T>,
	options?: { requireMcp?: boolean; requireCli?: boolean },
) {
	let usageIds: string[] = [];
	let statusCode = 200;
	try {
		const auth = await authenticateApiRequest(request, scopes, options);
		usageIds = await reserveApiUsage(auth, [{ method: request.method, route: new URL(request.url).pathname }]);
		const result = await handler(auth);
		return jsonResponse(result, statusCode);
	} catch (error) {
		statusCode = statusForError(error);
		return errorResponse(error, statusCode);
	} finally {
		await finalizeApiUsage(usageIds, statusCode).catch(() => undefined);
	}
}
