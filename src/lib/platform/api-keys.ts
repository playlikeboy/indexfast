/**
 * IndexFast API keys (REST, MCP, CLI). Plaintext is shown once; only a SHA-256 hash and a
 * short prefix are stored. Every authenticated request is checked against the owner's
 * *current* entitlement (so expiry is enforced immediately) and the monthly request quota.
 *
 * Quota is reserve-then-check: the usage row is written *before* the handler runs and the
 * request is refused if the count including it is over quota. A check-then-insert would let
 * concurrent requests all pass the check at quota - 1.
 */
import { and, eq, gt, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, apiUsageEvents, users } from "@/db/schema";
import { getUserEntitlement } from "./entitlements";
import {
	DEFAULT_API_SCOPES,
	type BillingTier,
	type ApiScope,
	formatLimit,
	normalizeApiScopes,
	resolveEntitlement,
} from "./plans";
import { generateApiKey, getApiKeyPrefix, hashApiKey, maskApiKeyPrefix } from "./api-key-utils";
export { generateApiKey, getApiKeyPrefix, hashApiKey, maskApiKeyPrefix };

/** Typed quota error so HTTP layers map it to 429 without string matching. */
export class ApiRequestLimitError extends Error {
	readonly statusCode = 429;

	constructor(message: string) {
		super(message);
		this.name = "ApiRequestLimitError";
	}
}

export type AuthenticatedApiKey = {
	apiKeyId: string;
	userId: string;
	name: string;
	scopes: ApiScope[];
	billingTier: BillingTier;
	/** Monthly REST + MCP request quota for the current entitlement (Infinity = unlimited). */
	monthlyQuota: number;
	planName: string;
};

export async function listApiKeysForUser(userId: string) {
	const rows = await db
		.select({
			id: apiKeys.id,
			name: apiKeys.name,
			keyPrefix: apiKeys.keyPrefix,
			scopes: apiKeys.scopes,
			status: apiKeys.status,
			lastUsedAt: apiKeys.lastUsedAt,
			expiresAt: apiKeys.expiresAt,
			createdAt: apiKeys.createdAt,
			revokedAt: apiKeys.revokedAt,
		})
		.from(apiKeys)
		.where(eq(apiKeys.userId, userId))
		.orderBy(apiKeys.createdAt);

	return rows.map((row) => ({
		...row,
		maskedKey: maskApiKeyPrefix(row.keyPrefix),
		scopes: normalizeApiScopes(row.scopes),
	}));
}

export async function createApiKeyForUser(userId: string, name: string, scopes: ApiScope[] = DEFAULT_API_SCOPES) {
	const cleanName = name.trim() || "Default API key";
	const entitlement = await getUserEntitlement(userId);
	const activeKeys = await db
		.select({ id: apiKeys.id })
		.from(apiKeys)
		.where(and(eq(apiKeys.userId, userId), eq(apiKeys.status, "active")));

	if (activeKeys.length >= entitlement.limits.apiKeys) {
		throw new Error(
			`The ${entitlement.plan.name} plan includes ${formatLimit(entitlement.limits.apiKeys)} active key(s). Revoke one or upgrade.`,
		);
	}

	const plainKey = generateApiKey();
	const keyHash = await hashApiKey(plainKey);
	const keyPrefix = getApiKeyPrefix(plainKey);
	const cleanScopes = scopes.length > 0 ? scopes : DEFAULT_API_SCOPES;

	const [row] = await db
		.insert(apiKeys)
		.values({
			userId,
			name: cleanName,
			keyPrefix,
			keyHash,
			scopes: cleanScopes,
			status: "active",
		})
		.returning({
			id: apiKeys.id,
			name: apiKeys.name,
			keyPrefix: apiKeys.keyPrefix,
			scopes: apiKeys.scopes,
			createdAt: apiKeys.createdAt,
		});

	return {
		...row,
		plainKey,
		maskedKey: maskApiKeyPrefix(row.keyPrefix),
		scopes: normalizeApiScopes(row.scopes),
	};
}

export async function revokeApiKeyForUser(userId: string, apiKeyId: string) {
	await db
		.update(apiKeys)
		.set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.userId, userId)));
}

export function readBearerToken(request: Request) {
	const header = request.headers.get("authorization") || "";
	const match = /^Bearer\s+(.+)$/i.exec(header);
	return match?.[1]?.trim() || null;
}

export async function authenticateApiRequest(
	request: Request,
	requiredScopes: ApiScope[] = [],
	options: { requireMcp?: boolean; requireCli?: boolean } = {},
): Promise<AuthenticatedApiKey> {
	const token = readBearerToken(request);
	if (!token) {
		throw new Error("Missing Bearer API key.");
	}

	const keyHash = await hashApiKey(token);
	const now = new Date();
	const [row] = await db
		.select({
			id: apiKeys.id,
			userId: apiKeys.userId,
			name: apiKeys.name,
			scopes: apiKeys.scopes,
			lastUsedAt: apiKeys.lastUsedAt,
			billingTier: users.billingTier,
			planExpiresAt: users.planExpiresAt,
		})
		.from(apiKeys)
		.innerJoin(users, eq(apiKeys.userId, users.id))
		.where(
			and(
				eq(apiKeys.keyHash, keyHash),
				eq(apiKeys.status, "active"),
				or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)),
			),
		)
		.limit(1);

	if (!row) {
		throw new Error("Invalid or revoked API key.");
	}

	const scopes = normalizeApiScopes(row.scopes);
	for (const scope of requiredScopes) {
		if (!scopes.includes(scope)) {
			throw new Error(`API key is missing required scope: ${scope}`);
		}
	}

	// MCP and CLI are available on every plan; the monthly request quota (reserveApiUsage) is the only gate.
	void options;
	const entitlement = resolveEntitlement(row, now);

	// Only update lastUsedAt if it hasn't been updated in the last hour to reduce DB load
	const ONE_HOUR_MS = 60 * 60 * 1000;
	if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > ONE_HOUR_MS) {
		await db.update(apiKeys).set({ lastUsedAt: now, updatedAt: now }).where(eq(apiKeys.id, row.id));
	}

	return {
		apiKeyId: row.id,
		userId: row.userId,
		name: row.name,
		scopes,
		billingTier: entitlement.tier,
		monthlyQuota: entitlement.limits.monthlyApiRequests,
		planName: entitlement.plan.name,
	};
}

export type ApiUsageEntry = { method: string; route: string; metadata?: Record<string, unknown> };

/**
 * Writes one usage row per billable entry, then refuses (and removes the rows) if this
 * month's count including them is over quota. Rows start as 200; finalizeApiUsage records
 * the real status afterwards. Returns the row ids to finalize.
 */
export async function reserveApiUsage(auth: AuthenticatedApiKey, entries: ApiUsageEntry[]): Promise<string[]> {
	if (entries.length === 0) {
		return [];
	}
	const rows = await db
		.insert(apiUsageEvents)
		.values(
			entries.map((entry) => ({
				apiKeyId: auth.apiKeyId,
				userId: auth.userId,
				method: entry.method,
				route: entry.route,
				statusCode: 200,
				metadata: entry.metadata || null,
			})),
		)
		.returning({ id: apiUsageEvents.id });
	const ids = rows.map((row) => row.id);

	if (Number.isFinite(auth.monthlyQuota)) {
		const now = new Date();
		const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
		const [{ used }] = await db
			.select({ used: sql<number>`cast(count(*) as int)` })
			.from(apiUsageEvents)
			.where(and(eq(apiUsageEvents.userId, auth.userId), gte(apiUsageEvents.createdAt, monthStart)));
		if (used > auth.monthlyQuota) {
			// A refused request is not usage; dropping the rows keeps the count honest.
			await db.delete(apiUsageEvents).where(inArray(apiUsageEvents.id, ids));
			throw new ApiRequestLimitError(
				`Monthly API limit reached (${formatLimit(auth.monthlyQuota)} requests on ${auth.planName}). Upgrade at https://indexfast.co/dashboard/billing`,
			);
		}
	}
	return ids;
}

/** Records the final status on reserved rows; only failures need a write. */
export async function finalizeApiUsage(ids: string[], statusCode: number) {
	if (ids.length === 0 || statusCode === 200) {
		return;
	}
	await db.update(apiUsageEvents).set({ statusCode }).where(inArray(apiUsageEvents.id, ids));
}
