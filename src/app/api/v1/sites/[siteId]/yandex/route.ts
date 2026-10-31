/**
 * Yandex Webmaster recrawl: POST { token, autoSubmit? } saves the user's Yandex OAuth token and links this
 * site to its verified Yandex host. Paid plans.
 * Toggle or remove it through /api/v1/sites/:siteId/engines.
 */
import { setYandexTokenForApi } from "@/lib/platform/operations";
import { readJsonBody, withApiAuth } from "@/lib/platform/http";

type RouteContext = { params: Promise<{ siteId: string }> };

export async function POST(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:write"], async (auth) => {
		const body = await readJsonBody<{ token?: unknown; autoSubmit?: unknown }>(request);
		if (typeof body.token !== "string" || !body.token.trim()) throw new Error("token is required.");
		return setYandexTokenForApi(auth.userId, siteId, body.token, body.autoSubmit !== false);
	});
}
