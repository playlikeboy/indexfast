import { createSiteForUser, listSitesForUser } from "@/lib/platform/operations";
import { readJsonBody, withApiAuth } from "@/lib/platform/http";

export async function GET(request: Request) {
	return withApiAuth(request, ["sites:read"], async (auth) => ({
		sites: await listSitesForUser(auth.userId),
	}));
}

export async function POST(request: Request) {
	return withApiAuth(request, ["sites:write"], async (auth) => {
		const body = await readJsonBody<{ domain?: string; name?: string; sitemapUrl?: string }>(request);
		// Returns { site, sitemaps, sync, warning, setup } so a script can finish onboarding in one call.
		return createSiteForUser({
			userId: auth.userId,
			domain: body.domain || "",
			name: body.name,
			sitemapUrl: body.sitemapUrl,
		});
	});
}
