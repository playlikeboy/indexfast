import { and, count, eq, gte, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, apiUsageEvents, users } from "@/db/schema";
import {
	DEFAULT_API_SCOPES,
	PLAN_LIMITS,
	type ApiScope,
	normalizeApiScopes,
	normalizeBillingTier,
} from "./plans";
export { generateApiKey, getApiKeyPrefix, hashApiKey, maskApiKeyPrefix } from "./api-key-utils";
import { generateApiKey, getApiKeyPrefix, hashApiKey, maskApiKeyPrefix } from "./api-key-utils";

export type AuthenticatedApiKey = {
	apiKeyId: string;
	userId: string;
	name: string;
	scopes: ApiScope[];
	billingTier: ReturnType<typeof normalizeBillingTier>;
};

export class ApiRequestLimitError extends Error {
	readonly statusCode = 429;

	constructor(limit: number) {
		super("Monthly API request limit (" + limit + ") reached for your plan.");
		this.name = "ApiRequestLimitError";
	}
}

async function getUserTier(userId: string) {
	const [user] = await db.select({ billingTier: users.billingTier }).from(users).where(eq(users.id, userId)).limit(1);
	return normalizeBillingTier(user?.billingTier);
}

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
	const billingTier = await getUserTier(userId);
	const activeKeys = await db
		.select({ id: apiKeys.id })
		.from(apiKeys)
		.where(and(eq(apiKeys.userId, userId), eq(apiKeys.status, "active")));

	if (activeKeys.length >= PLAN_LIMITS[billingTier].apiKeys) {
		throw new Error(`Your ${billingTier} plan supports ${PLAN_LIMITS[billingTier].apiKeys} active API key(s).`);
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

	const billingTier = normalizeBillingTier(row.billingTier);
	const plan = PLAN_LIMITS[billingTier];
	if (options.requireMcp && !plan.mcpEnabled) {
		throw new Error("MCP access requires the Growth plan or higher.");
	}
	if (options.requireCli && !plan.cliEnabled) {
		throw new Error("CLI access requires the Indie plan or higher.");
	}

	const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const [usage] = await db
		.select({ total: count(apiUsageEvents.id) })
		.from(apiUsageEvents)
		.where(and(eq(apiUsageEvents.userId, row.userId), gte(apiUsageEvents.createdAt, monthStart)));
	if ((usage?.total ?? 0) >= plan.monthlyApiRequests) {
		throw new ApiRequestLimitError(plan.monthlyApiRequests);
	}

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
		billingTier,
	};
}

export async function recordApiUsage(input: {
	apiKeyId?: string | null;
	userId: string;
	method: string;
	route: string;
	statusCode: number;
	metadata?: Record<string, unknown>;
}) {
	await db.insert(apiUsageEvents).values({
		apiKeyId: input.apiKeyId || null,
		userId: input.userId,
		method: input.method,
		route: input.route,
		statusCode: input.statusCode,
		metadata: input.metadata || null,
	});
}
