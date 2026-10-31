/**
 * Baidu URL push: POST { token, autoSubmit? } saves this site's Baidu Ziyuan token, validated by
 * pushing the homepage once. Paid plans; the site must be verified.
 * Toggle or remove it through /api/v1/sites/:siteId/engines.
 */
import { setBaiduTokenForApi } from "@/lib/platform/operations";
import { readJsonBody, withApiAuth } from "@/lib/platform/http";

type RouteContext = { params: Promise<{ siteId: string }> };

export async function POST(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:write"], async (auth) => {
		const body = await readJsonBody<{ token?: unknown; autoSubmit?: unknown }>(request);
		if (typeof body.token !== "string" || !body.token.trim()) throw new Error("token is required.");
		return setBaiduTokenForApi(auth.userId, siteId, body.token, body.autoSubmit !== false);
	});
}
