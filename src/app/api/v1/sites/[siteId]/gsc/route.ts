/**
 * Google Search Console for one site.
 * - GET: connection status and the property this site matched (re-matched live).
 * - POST { sitemapUrl? }: submit one sitemap, or every active sitemap of the site.
 * Connecting Google itself is a browser OAuth flow at /api/integrations/google/start.
 */
import { getGoogleConnectionForApi, submitSitemapToGscForApi } from "@/lib/platform/operations";
import { readJsonBody, withApiAuth } from "@/lib/platform/http";

type RouteContext = { params: Promise<{ siteId: string }> };

export async function GET(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:read"], (auth) => getGoogleConnectionForApi(auth.userId, siteId));
}

export async function POST(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["submissions:write"], async (auth) => {
		const body = await readJsonBody<{ sitemapUrl?: unknown }>(request);
		return submitSitemapToGscForApi(auth.userId, siteId, typeof body.sitemapUrl === "string" ? body.sitemapUrl : undefined);
	});
}
