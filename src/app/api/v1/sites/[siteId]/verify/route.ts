import { getSiteDetailsForUser, verifySiteForApi } from "@/lib/platform/operations";
import { readJsonBody, withApiAuth } from "@/lib/platform/http";

type RouteContext = {
	params: Promise<{ siteId: string }>;
};

/** GET: setup instructions + status. POST: check the key file and enable automation; body { existingKey } to use a key the site already hosts. */
export async function GET(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:read"], async (auth) => ({ site: await getSiteDetailsForUser(auth.userId, siteId) }));
}

export async function POST(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:write"], async (auth) => {
		const body = await readJsonBody<{ existingKey?: string }>(request);
		return { verification: await verifySiteForApi(auth.userId, siteId, body.existingKey) };
	});
}
