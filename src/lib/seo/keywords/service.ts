/*
 * Keyword research and saved keyword lists, per site (project). Shared by the dashboard server
 * actions, the MCP tools and the REST API so the three never drift.
 *
 * Rules:
 * - Every call starts with requireOrgSite: the user must belong to the site's organization, and
 *   every saved-keyword query is filtered by both organizationId and siteId.
 * - Research is a paid DataForSEO call: a cache hit is free; otherwise credits are reserved from
 *   an estimate, then settled on the cost DataForSEO reports (src/lib/credits/ledger.ts).
 * - Without platform or BYOK credentials the feature says so (KeywordDataUnavailableError); it
 *   never returns made-up numbers.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { savedKeywords } from "@/db/schema";
import { estimateLabsCredits } from "@/lib/credits/pricing";
import { meterProviderCall } from "@/lib/credits/ledger";
import { requireOrgSite } from "@/lib/org/context";
import { CACHE_TTL_SECONDS, providerCacheKey, readProviderCache, writeProviderCache } from "@/lib/providers/cache";
import { resolveDataforseoCredentials } from "@/lib/providers/credentials";
import { fetchKeywordResearch, KEYWORD_ENDPOINTS, normalizeKeyword, type KeywordResearchMode, type KeywordRow } from "@/lib/providers/dataforseo/labs";

export class KeywordDataUnavailableError extends Error {
	constructor() {
		super("Keyword data is not available yet: no DataForSEO account is configured. Add your own DataForSEO login in Settings, or ask the IndexFast team to enable platform data.");
		this.name = "KeywordDataUnavailableError";
	}
}

// DataForSEO location codes (https://docs.dataforseo.com/v3/appendix/locations/) for the
// markets offered in the UI. Any valid code is accepted from the API and MCP.
export const KEYWORD_LOCATIONS = [
	{ code: 2840, name: "United States" },
	{ code: 2826, name: "United Kingdom" },
	{ code: 2356, name: "India" },
	{ code: 2124, name: "Canada" },
	{ code: 2036, name: "Australia" },
	{ code: 2276, name: "Germany" },
	{ code: 2250, name: "France" },
	{ code: 2724, name: "Spain" },
	{ code: 2076, name: "Brazil" },
	{ code: 2392, name: "Japan" },
] as const;
export const KEYWORD_LANGUAGES = ["en", "de", "fr", "es", "pt", "ja", "hi"] as const;
export const KEYWORD_MODES: KeywordResearchMode[] = ["suggestions", "related", "ideas"];
export const KEYWORD_LIMITS = { seedMax: 80, defaultLimit: 50, maxLimit: 200, saveMax: 200 } as const;

export type ResearchInput = { siteId: string; keyword: string; mode?: string; locationCode?: number; languageCode?: string; limit?: number };
export type ResearchResult = { rows: KeywordRow[]; credits: number; cached: boolean; mode: KeywordResearchMode; locationCode: number; languageCode: string };

export function parseResearchInput(input: ResearchInput) {
	const keyword = normalizeKeyword(String(input.keyword ?? ""));
	if (!keyword) throw new Error("Enter a seed keyword.");
	if (keyword.length > KEYWORD_LIMITS.seedMax) throw new Error(`Keep the seed keyword under ${KEYWORD_LIMITS.seedMax} characters.`);
	const mode = (KEYWORD_MODES as string[]).includes(input.mode ?? "") ? (input.mode as KeywordResearchMode) : "suggestions";
	const locationCode = Number.isInteger(input.locationCode) && (input.locationCode as number) > 0 ? (input.locationCode as number) : 2840;
	const languageCode = /^[a-z]{2}(-[a-z]{2,4})?$/i.test(input.languageCode ?? "") ? (input.languageCode as string).toLowerCase() : "en";
	const rawLimit = Number(input.limit ?? KEYWORD_LIMITS.defaultLimit);
	const limit = Math.min(KEYWORD_LIMITS.maxLimit, Math.max(10, Number.isFinite(rawLimit) ? Math.round(rawLimit) : KEYWORD_LIMITS.defaultLimit));
	return { keyword, mode, locationCode, languageCode, limit };
}

/** Credits a research call would reserve before it runs (shown in the UI and MCP). */
export function estimateResearchCredits(limit: number) {
	return estimateLabsCredits(limit);
}

export async function researchKeywords(userId: string, input: ResearchInput): Promise<ResearchResult> {
	const params = parseResearchInput(input);
	const { site, organization } = await requireOrgSite(userId, input.siteId);
	const endpoint = KEYWORD_ENDPOINTS[params.mode];
	const cacheKey = await providerCacheKey("dataforseo", endpoint, params);

	const cached = await readProviderCache<KeywordRow[]>(cacheKey);
	if (cached) return { rows: cached, credits: 0, cached: true, mode: params.mode, locationCode: params.locationCode, languageCode: params.languageCode };

	const credentials = await resolveDataforseoCredentials(organization.id);
	if (!credentials) throw new KeywordDataUnavailableError();

	const result = await meterProviderCall(
		{ organization, userId, siteId: site.id },
		{ feature: "keyword_research", provider: "dataforseo", endpoint, estimateCredits: estimateResearchCredits(params.limit), byok: credentials.source === "byok", metadata: { keyword: params.keyword, mode: params.mode, locationCode: params.locationCode } },
		async () => {
			const { rows, costUsd } = await fetchKeywordResearch(credentials, params.mode, params);
			// BYOK results are paid by that customer's own provider account, so they are not shared.
			if (credentials.source === "platform") await writeProviderCache(cacheKey, "dataforseo", endpoint, rows, CACHE_TTL_SECONDS.keywordResearch);
			return { data: rows, costUsd, cached: false };
		},
	);
	return { rows: result.data, credits: result.credits, cached: false, mode: params.mode, locationCode: params.locationCode, languageCode: params.languageCode };
}

export type SaveKeywordInput = Partial<KeywordRow> & { keyword: string };

export async function saveKeywords(userId: string, input: { siteId: string; locationCode?: number; languageCode?: string; keywords: SaveKeywordInput[]; tags?: string[] }) {
	const { site, organization } = await requireOrgSite(userId, input.siteId);
	const locationCode = Number.isInteger(input.locationCode) ? (input.locationCode as number) : 2840;
	const languageCode = input.languageCode || "en";
	const tags = (input.tags ?? []).map((tag) => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 10);
	const now = new Date();
	const seen = new Set<string>();
	const values = input.keywords
		.map((row) => ({ ...row, keyword: normalizeKeyword(row.keyword ?? "") }))
		.filter((row) => row.keyword && row.keyword.length <= KEYWORD_LIMITS.seedMax && !seen.has(row.keyword) && seen.add(row.keyword))
		.slice(0, KEYWORD_LIMITS.saveMax)
		.map((row) => ({
			organizationId: organization.id,
			siteId: site.id,
			keyword: row.keyword,
			locationCode,
			languageCode,
			searchVolume: typeof row.searchVolume === "number" ? Math.round(row.searchVolume) : null,
			cpc: typeof row.cpc === "number" ? String(row.cpc) : null,
			competition: typeof row.competition === "number" ? String(row.competition) : null,
			keywordDifficulty: typeof row.keywordDifficulty === "number" ? Math.round(row.keywordDifficulty) : null,
			intent: row.intent ?? null,
			monthlySearches: row.monthlySearches ?? null,
			tags,
			metricsAt: typeof row.searchVolume === "number" ? now : null,
			createdByUserId: userId,
			updatedAt: now,
		}));
	if (values.length === 0) throw new Error("No valid keywords to save.");
	await db
		.insert(savedKeywords)
		.values(values)
		.onConflictDoNothing({ target: [savedKeywords.siteId, savedKeywords.keyword, savedKeywords.locationCode, savedKeywords.languageCode] });
	return { saved: values.length };
}

export async function listSavedKeywords(userId: string, siteId: string) {
	const { site, organization } = await requireOrgSite(userId, siteId);
	return db
		.select()
		.from(savedKeywords)
		.where(and(eq(savedKeywords.organizationId, organization.id), eq(savedKeywords.siteId, site.id)))
		.orderBy(asc(savedKeywords.keyword))
		.limit(1000);
}

export async function removeSavedKeywords(userId: string, siteId: string, ids: string[]) {
	const { site, organization } = await requireOrgSite(userId, siteId);
	const valid = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500);
	if (valid.length === 0) return { removed: 0 };
	const removed = await db
		.delete(savedKeywords)
		.where(and(eq(savedKeywords.organizationId, organization.id), eq(savedKeywords.siteId, site.id), inArray(savedKeywords.id, valid)))
		.returning({ id: savedKeywords.id });
	return { removed: removed.length };
}
