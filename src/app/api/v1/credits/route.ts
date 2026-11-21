/*
 * /api/v1/credits: SEO data credit balance for the caller's organization and the recent usage
 * ledger, so an agent can check spend before running paid research.
 */
import { intParam, withApiAuth } from "@/lib/platform/http";
import { getCreditUsageForApi } from "@/lib/platform/seo-operations";

export async function GET(request: Request) {
	return withApiAuth(request, ["billing:read"], async (auth) => getCreditUsageForApi(auth.userId, intParam(new URL(request.url).searchParams.get("limit"), 50, 1, 200)));
}
