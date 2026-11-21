/*
 * DataForSEO Labs keyword endpoints and the normalized keyword row every surface (dashboard,
 * MCP, REST) returns.
 *
 * Request shapes and field mapping adapted from OpenSEO (https://github.com/every-app/open-seo),
 * src/server/lib/dataforseo/labs.ts and features/keywords/services/research/helpers.ts.
 * Copyright (c) 2026 Ben Senescu. MIT License; see THIRD_PARTY_NOTICES.md.
 *
 * Clickstream-normalized volumes double the request price, so they are never requested here.
 */
import { assertOkTask, dataforseoPost, firstResult, responseCostUsd, type DataforseoCredentials } from "@/lib/providers/dataforseo/client";

export type KeywordIntent = "informational" | "commercial" | "transactional" | "navigational" | "unknown";
export type KeywordResearchMode = "related" | "suggestions" | "ideas";

export type KeywordRow = {
	keyword: string;
	searchVolume: number | null;
	cpc: number | null;
	competition: number | null; // 0-1 paid competition ratio
	keywordDifficulty: number | null; // 0-100
	intent: KeywordIntent;
	monthlySearches: Array<{ year: number; month: number; volume: number | null }>;
};

export const KEYWORD_ENDPOINTS: Record<KeywordResearchMode, string> = {
	related: "/v3/dataforseo_labs/google/related_keywords/live",
	suggestions: "/v3/dataforseo_labs/google/keyword_suggestions/live",
	ideas: "/v3/dataforseo_labs/google/keyword_ideas/live",
};

type LabsKeywordItem = {
	keyword?: string | null;
	keyword_info?: {
		search_volume?: number | null;
		cpc?: number | null;
		competition?: number | null;
		monthly_searches?: Array<{ year?: number | null; month?: number | null; search_volume?: number | null }> | null;
	} | null;
	keyword_properties?: { keyword_difficulty?: number | null } | null;
	search_intent_info?: { main_intent?: string | null } | null;
};

export function normalizeKeyword(input: string) {
	return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeIntent(raw: string | null | undefined): KeywordIntent {
	const value = raw?.toLowerCase() ?? "";
	if (value.includes("inform")) return "informational";
	if (value.includes("commerc")) return "commercial";
	if (value.includes("transact")) return "transactional";
	if (value.includes("navig")) return "navigational";
	return "unknown";
}

function num(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toKeywordRow(item: LabsKeywordItem | null | undefined): KeywordRow | null {
	const keyword = item?.keyword ? normalizeKeyword(item.keyword) : "";
	if (!keyword) return null;
	const info = item?.keyword_info ?? null;
	return {
		keyword,
		searchVolume: num(info?.search_volume),
		cpc: num(info?.cpc),
		competition: num(info?.competition),
		keywordDifficulty: num(item?.keyword_properties?.keyword_difficulty),
		intent: normalizeIntent(item?.search_intent_info?.main_intent),
		monthlySearches: (info?.monthly_searches ?? [])
			.filter((entry) => typeof entry?.year === "number" && typeof entry?.month === "number")
			.map((entry) => ({ year: entry.year as number, month: entry.month as number, volume: num(entry.search_volume) })),
	};
}

/** Rows from a Labs task result for any of the three modes, deduped, seed first when present. */
export function rowsFromLabsResult(mode: KeywordResearchMode, result: Record<string, unknown> | null, limit: number): KeywordRow[] {
	if (!result) return [];
	const rawItems = (Array.isArray(result.items) ? result.items : []) as Array<Record<string, unknown>>;
	// related_keywords nests the keyword payload one level deeper.
	const items: LabsKeywordItem[] = mode === "related" ? rawItems.map((item) => (item.keyword_data ?? null) as LabsKeywordItem) : (rawItems as LabsKeywordItem[]);
	if (mode === "suggestions" && result.seed_keyword_data) items.unshift(result.seed_keyword_data as LabsKeywordItem);
	const seen = new Set<string>();
	const rows: KeywordRow[] = [];
	for (const item of items) {
		const row = toKeywordRow(item);
		if (!row || seen.has(row.keyword)) continue;
		seen.add(row.keyword);
		rows.push(row);
		if (rows.length >= limit) break;
	}
	return rows;
}

export function keywordTaskBody(mode: KeywordResearchMode, input: { keyword: string; locationCode: number; languageCode: string; limit: number }) {
	const common = { location_code: input.locationCode, language_code: input.languageCode, limit: input.limit, include_clickstream_data: false, include_serp_info: false, ignore_synonyms: false };
	if (mode === "related") return { ...common, keyword: input.keyword, depth: 3 };
	if (mode === "suggestions") return { ...common, keyword: input.keyword, include_seed_keyword: true, exact_match: false };
	return { ...common, keywords: [input.keyword], closely_variants: false };
}

export async function fetchKeywordResearch(
	credentials: DataforseoCredentials,
	mode: KeywordResearchMode,
	input: { keyword: string; locationCode: number; languageCode: string; limit: number },
	fetchImpl?: typeof fetch,
) {
	const response = await dataforseoPost(credentials, KEYWORD_ENDPOINTS[mode], [keywordTaskBody(mode, input)], { fetchImpl });
	const task = assertOkTask(response);
	return { rows: rowsFromLabsResult(mode, firstResult(task), input.limit), costUsd: responseCostUsd(response) };
}
