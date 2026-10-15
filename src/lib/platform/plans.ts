/**
 * Plan catalog and limits. This is the single source of truth for pricing, plan gates, and
 * what each tier unlocks; the dashboard, marketing pricing, Razorpay checkout, the cron, and
 * the API/MCP gates all read from here. See docs/billing.md.
 *
 * Product intent:
 * - Only three plans are sold: Free, Pro ($19/mo) and Unlimited ($99/mo).
 * - Legacy tiers (indie/growth/agency/scale) from the Dodo era are hidden, never deleted:
 *   existing subscribers keep working and are mapped onto equivalent limits.
 */

export type BillingTier = "free" | "pro" | "unlimited" | "indie" | "growth" | "agency" | "scale";
export type PaidPlan = "pro" | "unlimited";

export type ApiScope =
	| "sites:read"
	| "sites:write"
	| "submissions:write"
	| "diagnostics:write"
	| "resources:read"
	| "billing:read"
	| "mcp:use";

const ALL_SCOPES: ApiScope[] = [
	"sites:read",
	"sites:write",
	"submissions:write",
	"diagnostics:write",
	"resources:read",
	"billing:read",
	"mcp:use",
];

export const DEFAULT_API_SCOPES: ApiScope[] = ALL_SCOPES.filter((scope) => scope !== "billing:read");

// Infinity is used for "unlimited" so comparisons stay simple (`count >= limit`).
export type PlanLimits = {
	sites: number;
	urlsPerSite: number; // Max URLs ingested per site per sync
	syncIntervalMinutes: number; // How often the cron re-crawls sitemaps
	apiKeys: number;
	monthlyApiRequests: number; // REST + MCP calls
	bing: boolean; // Direct Bing Webmaster API submissions
};

export type PlanDefinition = {
	id: BillingTier;
	name: string;
	priceUsd: number; // Monthly, display + default checkout amount
	visible: boolean; // Shown on pricing + billing pages
	tagline: string;
	features: string[];
	limits: PlanLimits;
};

const FREE_LIMITS: PlanLimits = {
	sites: 1,
	urlsPerSite: 500,
	syncIntervalMinutes: 24 * 60,
	apiKeys: 1,
	monthlyApiRequests: 300,
	bing: false,
};

const PRO_LIMITS: PlanLimits = {
	sites: 10,
	urlsPerSite: 10_000,
	syncIntervalMinutes: 60,
	apiKeys: 5,
	monthlyApiRequests: 20_000,
	bing: true,
};

const UNLIMITED_LIMITS: PlanLimits = {
	sites: Infinity,
	urlsPerSite: 50_000, // Fair-use ceiling per sync, bounded by Worker CPU, not by billing
	syncIntervalMinutes: 60,
	apiKeys: Infinity,
	monthlyApiRequests: Infinity,
	bing: true,
};

export const PLANS: Record<BillingTier, PlanDefinition> = {
	free: {
		id: "free",
		name: "Free",
		priceUsd: 0,
		visible: true,
		tagline: "Try it on one site.",
		features: ["1 website", "500 URLs tracked", "Daily sitemap check", "IndexNow auto-submit", "MCP + API access"],
		limits: FREE_LIMITS,
	},
	pro: {
		id: "pro",
		name: "Pro",
		priceUsd: 19,
		visible: true,
		tagline: "For builders shipping a few sites.",
		features: ["10 websites", "10,000 URLs per site", "Hourly sitemap checks", "IndexNow + Bing auto-submit", "MCP + API (20k calls/mo)"],
		limits: PRO_LIMITS,
	},
	unlimited: {
		id: "unlimited",
		name: "Unlimited",
		priceUsd: 99,
		visible: true,
		tagline: "Everything on the platform, no caps.",
		features: ["Unlimited websites", "50,000 URLs per site per sync", "Hourly sitemap checks", "IndexNow + Bing auto-submit", "Unlimited MCP + API calls", "Priority support"],
		limits: UNLIMITED_LIMITS,
	},
	// Hidden legacy tiers: kept so existing Dodo subscribers retain access.
	indie: { id: "indie", name: "Indie (legacy)", priceUsd: 19, visible: false, tagline: "", features: [], limits: PRO_LIMITS },
	growth: { id: "growth", name: "Growth (legacy)", priceUsd: 49, visible: false, tagline: "", features: [], limits: PRO_LIMITS },
	agency: { id: "agency", name: "Agency (legacy)", priceUsd: 99, visible: false, tagline: "", features: [], limits: UNLIMITED_LIMITS },
	scale: { id: "scale", name: "Scale (legacy)", priceUsd: 249, visible: false, tagline: "", features: [], limits: UNLIMITED_LIMITS },
};

export const VISIBLE_PLANS = Object.values(PLANS).filter((plan) => plan.visible);
export const PAID_PLANS: PaidPlan[] = ["pro", "unlimited"];

/** Days a paid plan keeps working after expiry before the cron downgrades it to Free. */
export const PLAN_GRACE_DAYS = 3;
/** Length of one prepaid Razorpay period. */
export const PLAN_PERIOD_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeBillingTier(value: string | null | undefined): BillingTier {
	return value && value in PLANS ? (value as BillingTier) : "free";
}

export function isPaidPlan(value: unknown): value is PaidPlan {
	return value === "pro" || value === "unlimited";
}

export type PlanStatus = "free" | "active" | "grace" | "expired";

export type Entitlement = {
	tier: BillingTier; // Tier the limits are computed from (free once expired past grace)
	purchasedTier: BillingTier; // Tier stored on the user row
	status: PlanStatus;
	expiresAt: Date | null;
	graceEndsAt: Date | null;
	daysLeft: number | null;
	limits: PlanLimits;
	plan: PlanDefinition;
};

/**
 * Resolve what a user can do *right now*. Computed at read time so access is correct even
 * if the hourly cron has not yet run its downgrade sweep.
 *
 * Expiry policy (also documented in docs/billing.md):
 * 1. Active until planExpiresAt.
 * 2. Grace for PLAN_GRACE_DAYS: full access, dashboard shows a renew banner.
 * 3. After grace: Free limits. Nothing is deleted. Sites beyond the Free limit are paused
 *    (oldest site stays active), extra API keys keep existing but count toward the limit.
 * 4. A null expiry on a paid tier is a legacy Dodo subscription and stays active.
 */
export function resolveEntitlement(
	user: { billingTier: string | null | undefined; planExpiresAt: Date | null | undefined } | null | undefined,
	now = new Date(),
): Entitlement {
	const purchasedTier = normalizeBillingTier(user?.billingTier);
	const expiresAt = user?.planExpiresAt ?? null;

	if (purchasedTier === "free") {
		return build("free", purchasedTier, "free", null);
	}

	if (!expiresAt) {
		return build(purchasedTier, purchasedTier, "active", null);
	}

	const graceEndsAt = new Date(expiresAt.getTime() + PLAN_GRACE_DAYS * DAY_MS);
	if (now < expiresAt) {
		return build(purchasedTier, purchasedTier, "active", expiresAt, graceEndsAt);
	}
	if (now < graceEndsAt) {
		return build(purchasedTier, purchasedTier, "grace", expiresAt, graceEndsAt);
	}
	return build("free", purchasedTier, "expired", expiresAt, graceEndsAt);

	function build(tier: BillingTier, purchased: BillingTier, status: PlanStatus, expires: Date | null, grace: Date | null = null): Entitlement {
		return {
			tier,
			purchasedTier: purchased,
			status,
			expiresAt: expires,
			graceEndsAt: grace,
			daysLeft: expires ? Math.ceil((expires.getTime() - now.getTime()) / DAY_MS) : null,
			limits: PLANS[tier].limits,
			plan: PLANS[tier],
		};
	}
}

/**
 * Where a new paid period starts. Renewing the same plan stacks onto the remaining time;
 * switching plans starts immediately so an upgrade takes effect the moment it is paid.
 */
export function computeNextPeriod(
	current: { billingTier: string | null | undefined; planExpiresAt: Date | null | undefined },
	plan: PaidPlan,
	now = new Date(),
) {
	const sameTier = normalizeBillingTier(current.billingTier) === plan;
	const start = sameTier && current.planExpiresAt && current.planExpiresAt > now ? current.planExpiresAt : now;
	return { start, end: new Date(start.getTime() + PLAN_PERIOD_DAYS * DAY_MS) };
}

export function formatLimit(value: number) {
	return Number.isFinite(value) ? value.toLocaleString("en-US") : "Unlimited";
}

export function normalizeApiScopes(value: unknown): ApiScope[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((scope): scope is ApiScope => typeof scope === "string" && ALL_SCOPES.includes(scope as ApiScope));
}
