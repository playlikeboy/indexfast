import { drainSiteQueueForApi, getSiteQueueForApi } from "@/lib/platform/operations";
import { intParam, readJsonBody, withApiAuth } from "@/lib/platform/http";

type RouteContext = {
	params: Promise<{ siteId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	const url = new URL(request.url);
	// intParam: a non-numeric page/limit would otherwise become a NaN OFFSET/LIMIT and a 500.
	const page = intParam(url.searchParams.get("page"), 1, 1, 100_000);
	const limit = intParam(url.searchParams.get("limit"), 50, 1, 100);
	const status = url.searchParams.get("status") || undefined;
	const engine = url.searchParams.get("engine") || undefined;

	return withApiAuth(request, ["sites:read"], async (auth) => {
		return getSiteQueueForApi(auth.userId, siteId, { page, limit, status, engine });
	});
}

export async function POST(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["submissions:write"], async (auth) => {
		const body = await readJsonBody<{ maxJobs?: number }>(request).catch(() => null);
		const maxJobs = typeof body?.maxJobs === "number" ? Math.min(1000, Math.max(1, Math.trunc(body.maxJobs) || 1)) : 1000;
		return drainSiteQueueForApi(auth.userId, siteId, maxJobs);
	});
}
