import { getSiteDetailsForUser, verifySiteForApi } from "@/lib/platform/operations";
import { withApiAuth } from "@/lib/platform/http";

type RouteContext = {
	params: Promise<{ siteId: string }>;
};

/** GET: setup instructions + status. POST: check the key file and enable automation. */
export async function GET(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:read"], async (auth) => ({ site: await getSiteDetailsForUser(auth.userId, siteId) }));
}

export async function POST(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:write"], async (auth) => ({ verification: await verifySiteForApi(auth.userId, siteId) }));
}
