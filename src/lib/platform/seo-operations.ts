/*
 * SEO platform operations shared by REST (/api/v1) and MCP (/api/mcp). Like operations.ts, this
 * is a thin layer: it turns a "site" reference (domain or id) into an owned site, then calls the
 * feature services, which re-check organization membership themselves.
 */
import { resolveSiteForUser } from "@/lib/automation/service";
import { getCreditBalance, ensureMonthlyGrant, listLedger } from "@/lib/credits/ledger";
import { getPersonalOrganization } from "@/lib/org/context";
import { getUserEntitlement } from "@/lib/platform/entitlements";
import { estimateResearchCredits, listSavedKeywords, parseResearchInput, removeSavedKeywords, researchKeywords, saveKeywords, type SaveKeywordInput } from "@/lib/seo/keywords/service";

async function siteIdFor(userId: string, siteRef: string) {
	return (await resolveSiteForUser(userId, siteRef)).id;
}

export async function researchKeywordsForApi(userId: string, siteRef: string, args: { keyword: string; mode?: string; locationCode?: number; languageCode?: string; limit?: number }) {
	const siteId = await siteIdFor(userId, siteRef);
	return researchKeywords(userId, { siteId, ...args });
}

export function estimateKeywordResearchForApi(args: { keyword: string; limit?: number }) {
	const { limit } = parseResearchInput({ siteId: "", keyword: args.keyword || "estimate", limit: args.limit });
	return { estimatedCredits: estimateResearchCredits(limit), note: "Estimate reserved before the call; the charge settles on the provider's reported cost and a cached result costs 0." };
}

export async function saveKeywordsForApi(userId: string, siteRef: string, args: { keywords: SaveKeywordInput[]; locationCode?: number; languageCode?: string; tags?: string[] }) {
	const siteId = await siteIdFor(userId, siteRef);
	return saveKeywords(userId, { siteId, ...args });
}

export async function listSavedKeywordsForApi(userId: string, siteRef: string) {
	const siteId = await siteIdFor(userId, siteRef);
	return { keywords: await listSavedKeywords(userId, siteId) };
}

export async function removeSavedKeywordsForApi(userId: string, siteRef: string, ids: string[]) {
	const siteId = await siteIdFor(userId, siteRef);
	return removeSavedKeywords(userId, siteId, ids);
}

export async function getCreditUsageForApi(userId: string, limit = 50) {
	const organization = await getPersonalOrganization(userId);
	await ensureMonthlyGrant(organization);
	const [balance, entitlement, ledger] = await Promise.all([getCreditBalance(organization.id), getUserEntitlement(organization.ownerUserId), listLedger(organization.id, limit)]);
	return {
		organizationId: organization.id,
		period: balance.period,
		monthlyGrant: entitlement.limits.monthlySeoCredits,
		monthlyRemaining: balance.monthly,
		purchasedRemaining: balance.purchased,
		totalRemaining: balance.total,
		ledger: ledger.map((row) => ({
			id: row.id,
			at: row.createdAt,
			kind: row.kind,
			feature: row.feature,
			endpoint: row.endpoint,
			credits: row.credits,
			byok: row.byok,
			metadata: row.metadata,
		})),
	};
}
