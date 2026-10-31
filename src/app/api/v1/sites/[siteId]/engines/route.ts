/**
 * Every indexing engine for a site (IndexNow, Bing, Google Search Console, Google Indexing
 * API, Yandex, Baidu): status, plan availability and auto-submit toggles for the optional ones.
 * - GET: list engines.
 * - PATCH { engine, autoSubmit }: turn google_indexing_api / yandex / baidu on or off.
 * - DELETE ?engine=: disconnect an optional engine from this site.
 */
import { listEnginesForApi, removeEngineForApi, setEngineAutoSubmitForApi } from "@/lib/platform/operations";
import { readJsonBody, withApiAuth } from "@/lib/platform/http";

type RouteContext = { params: Promise<{ siteId: string }> };

export async function GET(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:read"], (auth) => listEnginesForApi(auth.userId, siteId));
}

export async function PATCH(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:write"], async (auth) => {
		const body = await readJsonBody<{ engine?: unknown; autoSubmit?: unknown }>(request);
		if (typeof body.engine !== "string" || typeof body.autoSubmit !== "boolean") {
			throw new Error("engine (string) and autoSubmit (boolean) are required.");
		}
		return setEngineAutoSubmitForApi(auth.userId, siteId, body.engine, body.autoSubmit);
	});
}

export async function DELETE(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:write"], async (auth) => {
		const engine = new URL(request.url).searchParams.get("engine");
		if (!engine) throw new Error("engine query parameter is required.");
		return removeEngineForApi(auth.userId, siteId, engine);
	});
}
