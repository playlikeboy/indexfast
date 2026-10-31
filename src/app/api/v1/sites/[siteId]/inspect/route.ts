/**
 * Google Search Console URL Inspection for one URL (POST { url } or { urlId }). Returns
 * Google's own verdict and stores it on the URL. Counts toward the property's daily quota.
 */
import { inspectUrlForApi } from "@/lib/platform/operations";
import { readJsonBody, withApiAuth } from "@/lib/platform/http";

type RouteContext = { params: Promise<{ siteId: string }> };

export async function POST(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["diagnostics:write"], async (auth) => {
		const body = await readJsonBody<{ url?: unknown; urlId?: unknown }>(request);
		const url = typeof body.url === "string" ? body.url : undefined;
		const urlId = typeof body.urlId === "string" ? body.urlId : undefined;
		if (!url && !urlId) throw new Error("url or urlId is required.");
		return inspectUrlForApi(auth.userId, siteId, { url, urlId });
	});
}
