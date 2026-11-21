/*
 * DataForSEO transport: one authenticated fetch, response envelope checks and cost extraction.
 *
 * Adapted from OpenSEO (https://github.com/every-app/open-seo), src/server/lib/dataforseo/core.ts
 * and envelope.ts. Copyright (c) 2026 Ben Senescu. MIT License; see THIRD_PARTY_NOTICES.md.
 * Changes: no Every App gateway or reseller proxy, credentials passed in per call (platform key
 * or the organization's own key), errors carry the charged cost for the credit ledger.
 *
 * Rules:
 * - Idempotent reads retry twice on 5xx. A timeout is never retried: the provider may already
 *   have charged for it.
 * - A task that failed after DataForSEO billed it throws DataforseoError with chargedCostUsd, so
 *   meterProviderCall settles that charge instead of refunding it.
 * - "No search results" is an empty success, not a failure.
 */

const API_BASE = "https://api.dataforseo.com";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = 250;
const MAX_ERROR_BODY = 1600;

export type DataforseoCredentials = { login: string; password: string; source: "platform" | "byok" };

export type DataforseoErrorCode = "not_configured" | "auth_failed" | "rate_limited" | "upstream_unavailable" | "invalid_request" | "internal";

export class DataforseoError extends Error {
	constructor(
		public readonly code: DataforseoErrorCode,
		message: string,
		public readonly chargedCostUsd = 0,
	) {
		super(message);
		this.name = "DataforseoError";
	}
}

export interface DataforseoTask {
	id?: string;
	status_code?: number;
	status_message?: string;
	path?: string[];
	cost?: number;
	result_count?: number;
	result?: unknown[] | null;
	data?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface DataforseoResponse {
	status_code?: number;
	status_message?: string;
	cost?: number;
	tasks?: DataforseoTask[];
}

// Provider-side failures returned on HTTP 200 (https://docs.dataforseo.com/v3/appendix/errors/).
const UPSTREAM_FAILURE_CODES = new Set([40101, 40103, 50000, 50301, 50302, 50303, 50304, 50401, 50402]);

function authHeader(credentials: DataforseoCredentials) {
	return `Basic ${btoa(`${credentials.login}:${credentials.password}`)}`;
}

async function readText(response: Response) {
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes);
	const inflated = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
	return new Response(inflated).text();
}

export async function dataforseoPost(credentials: DataforseoCredentials, path: string, tasks: unknown[], options: { retries?: number; fetchImpl?: typeof fetch } = {}): Promise<DataforseoResponse> {
	const doFetch = options.fetchImpl ?? fetch;
	const retries = options.retries ?? MAX_RETRIES;
	const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
	for (let attempt = 0; ; attempt++) {
		let response: Response;
		try {
			response = await doFetch(`${API_BASE}${path}`, {
				method: "POST",
				headers: { Authorization: authHeader(credentials), Accept: "application/json", "Content-Type": "application/json", "Accept-Encoding": "gzip" },
				body: JSON.stringify(tasks),
				signal,
			});
		} catch (error) {
			const name = error instanceof Error ? error.name : "";
			if (name === "TimeoutError" || name === "AbortError") throw new DataforseoError("upstream_unavailable", `DataForSEO timed out on ${path}`);
			throw new DataforseoError("upstream_unavailable", `DataForSEO request failed: ${error instanceof Error ? error.message : String(error)}`);
		}
		if (response.ok) {
			const text = await readText(response);
			if (!text) throw new DataforseoError("internal", "DataForSEO returned an empty response");
			return JSON.parse(text) as DataforseoResponse;
		}
		if (response.status >= 500 && attempt < retries) {
			await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS * (attempt + 1)));
			continue;
		}
		const body = (await readText(response)).slice(0, MAX_ERROR_BODY);
		// An unverified account (status_code 40104) answers 403, not 401.
		const code: DataforseoErrorCode =
			response.status === 401 || response.status === 403 ? "auth_failed" : response.status === 429 ? "rate_limited" : response.status >= 500 ? "upstream_unavailable" : "internal";
		throw new DataforseoError(code, `DataForSEO HTTP ${response.status} on ${path}${body ? `: ${body}` : ""}`);
	}
}

export function isNoResultsTask(task: DataforseoTask) {
	return task.status_message?.toLowerCase().includes("no search results") ?? false;
}

/** The first task after checking the response and task status; throws DataforseoError otherwise. */
export function assertOkTask(response: DataforseoResponse, okStatus = 20000): DataforseoTask {
	if (response.status_code !== 20000) {
		const upstream = UPSTREAM_FAILURE_CODES.has(response.status_code ?? 0);
		throw new DataforseoError(upstream ? "upstream_unavailable" : statusToCode(response.status_code), response.status_message || "DataForSEO request failed");
	}
	const task = response.tasks?.[0];
	if (!task) throw new DataforseoError("internal", "DataForSEO response has no task");
	if (task.status_code === okStatus || isNoResultsTask(task)) return task;
	const message = task.status_message || "DataForSEO task failed";
	const code = UPSTREAM_FAILURE_CODES.has(task.status_code ?? 0) ? "upstream_unavailable" : /invalid field/i.test(message) ? "invalid_request" : statusToCode(task.status_code);
	throw new DataforseoError(code, message, typeof task.cost === "number" ? task.cost : 0);
}

function statusToCode(status: number | undefined): DataforseoErrorCode {
	if (status === 40100 || status === 40104 || status === 40200 || status === 40210) return "auth_failed"; // 40200/40210: balance / payment required
	if (status === 40202) return "rate_limited";
	return "internal";
}

/** Cost DataForSEO billed for the response (USD). */
export function responseCostUsd(response: DataforseoResponse): number {
	if (typeof response.cost === "number") return response.cost;
	return (response.tasks ?? []).reduce((sum, task) => sum + (typeof task.cost === "number" ? task.cost : 0), 0);
}

export function firstResult<T = Record<string, unknown>>(task: DataforseoTask): T | null {
	const first = task.result?.[0];
	return first && typeof first === "object" ? (first as T) : null;
}

/**
 * Checks a login against the free appendix/user_data endpoint (no charge). Used before a BYOK
 * credential is saved, so a typo fails at save time instead of on the first paid call.
 */
export async function validateDataforseoCredentials(credentials: DataforseoCredentials, fetchImpl: typeof fetch = fetch) {
	const response = await fetchImpl(`${API_BASE}/v3/appendix/user_data`, {
		headers: { Authorization: authHeader(credentials), Accept: "application/json" },
		signal: AbortSignal.timeout(15_000),
	});
	if (response.status === 401 || response.status === 403) return { ok: false as const, error: "DataForSEO rejected this login and password." };
	if (!response.ok) return { ok: false as const, error: `DataForSEO answered HTTP ${response.status}. Try again later.` };
	const body = JSON.parse(await readText(response)) as DataforseoResponse;
	if (body.status_code !== 20000) return { ok: false as const, error: body.status_message || "DataForSEO did not accept this login." };
	return { ok: true as const };
}
