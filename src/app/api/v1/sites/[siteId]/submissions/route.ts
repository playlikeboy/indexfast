import { bulkSubmitUrlsForApi, listSubmissionsForUser, submitPendingForApi, submitUrlForApi } from "@/lib/platform/operations";
import { readJsonBody, withApiAuth } from "@/lib/platform/http";

type RouteContext = {
	params: Promise<{ siteId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	const url = new URL(request.url);
	const limit = Number(url.searchParams.get("limit") || 100);

	return withApiAuth(request, ["sites:read"], async (auth) => ({
		submissions: await listSubmissionsForUser(auth.userId, siteId, limit),
	}));
}

export async function POST(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["submissions:write"], async (auth) => {
		const body = await readJsonBody<{ url?: string; urls?: string[]; pending?: boolean }>(request);
		if (body.pending) {
			return { submission: await submitPendingForApi(auth.userId, siteId) };
		}
		if (Array.isArray(body.urls)) {
			return { submissions: await bulkSubmitUrlsForApi(auth.userId, siteId, body.urls) };
		}

		return { submission: await submitUrlForApi(auth.userId, siteId, body.url || "") };
	});
}
