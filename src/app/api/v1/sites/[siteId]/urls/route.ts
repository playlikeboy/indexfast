import { listUrlsForUser, type UrlFilter } from "@/lib/platform/operations";
import { withApiAuth } from "@/lib/platform/http";

type RouteContext = {
	params: Promise<{ siteId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	const url = new URL(request.url);
	const limit = Number(url.searchParams.get("limit") || 100);

	return withApiAuth(request, ["sites:read"], async (auth) => ({
		urls: await listUrlsForUser(auth.userId, siteId, limit, (url.searchParams.get("filter") || "all") as UrlFilter),
	}));
}
