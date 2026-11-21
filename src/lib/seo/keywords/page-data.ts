/*
 * Data for the dashboard Keywords section: saved list, credit balance and whether any provider
 * credentials exist, loaded in parallel. Membership is checked by listSavedKeywords.
 */
import { ensureMonthlyGrant, getCreditBalance } from "@/lib/credits/ledger";
import { requireOrgSite } from "@/lib/org/context";
import { getUserEntitlement } from "@/lib/platform/entitlements";
import { getByokStatus, platformDataforseoCredentials } from "@/lib/providers/credentials";
import { listSavedKeywords } from "@/lib/seo/keywords/service";

export async function getKeywordsPageData(userId: string, siteId: string) {
	const { organization } = await requireOrgSite(userId, siteId);
	await ensureMonthlyGrant(organization);
	const [saved, balance, entitlement, byok] = await Promise.all([listSavedKeywords(userId, siteId), getCreditBalance(organization.id), getUserEntitlement(organization.ownerUserId), getByokStatus(organization.id)]);
	return {
		saved,
		credits: { total: balance.total, monthlyGrant: entitlement.limits.monthlySeoCredits },
		dataAvailable: Boolean(byok) || platformDataforseoCredentials() !== null,
		byok: Boolean(byok),
	};
}
