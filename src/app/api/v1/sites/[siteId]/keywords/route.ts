/*
 * /api/v1/sites/:siteId/keywords: keyword research and the site's saved keyword list.
 * GET lists saved keywords. POST { action: "research" | "save" | "remove" | "estimate", ... }.
 * Research spends SEO data credits (402 when the balance is short); see docs/PROVIDER-COST-MODEL.md.
 */
import { readJsonBody, withApiAuth } from "@/lib/platform/http";
import { estimateKeywordResearchForApi, listSavedKeywordsForApi, removeSavedKeywordsForApi, researchKeywordsForApi, saveKeywordsForApi } from "@/lib/platform/seo-operations";
import type { SaveKeywordInput } from "@/lib/seo/keywords/service";

type RouteContext = { params: Promise<{ siteId: string }> };

export async function GET(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:read"], async (auth) => listSavedKeywordsForApi(auth.userId, siteId));
}

export async function POST(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:write"], async (auth) => {
		const body = await readJsonBody<{
			action?: "research" | "save" | "remove" | "estimate";
			keyword?: string;
			mode?: string;
			locationCode?: number;
			languageCode?: string;
			limit?: number;
			keywords?: SaveKeywordInput[];
			tags?: string[];
			ids?: string[];
		}>(request);
		switch (body.action ?? "research") {
			case "estimate":
				return estimateKeywordResearchForApi({ keyword: body.keyword ?? "", limit: body.limit });
			case "save":
				return saveKeywordsForApi(auth.userId, siteId, { keywords: Array.isArray(body.keywords) ? body.keywords : [], locationCode: body.locationCode, languageCode: body.languageCode, tags: body.tags });
			case "remove":
				return removeSavedKeywordsForApi(auth.userId, siteId, Array.isArray(body.ids) ? body.ids : []);
			case "research":
				return researchKeywordsForApi(auth.userId, siteId, { keyword: body.keyword ?? "", mode: body.mode, locationCode: body.locationCode, languageCode: body.languageCode, limit: body.limit });
			default:
				throw new Error("Unknown action. Use research, save, remove or estimate.");
		}
	});
}
