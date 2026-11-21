/*
 * Postgres cache for paid provider responses. A hit costs the customer 0 credits, so repeat
 * research of the same seed/location/language within the TTL is free. Only public search data
 * goes here (keywords, SERPs, domain metrics); never tenant data such as GSC or GA4 rows.
 *
 * The key is sha256 over provider, endpoint and the request params with sorted keys, so
 * equivalent requests share an entry. Expired rows are ignored on read and pruned by the cron.
 */
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { providerCache } from "@/db/schema";

export const CACHE_TTL_SECONDS = {
	keywordResearch: 24 * 60 * 60,
	domain: 12 * 60 * 60,
} as const;

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export async function providerCacheKey(provider: string, endpoint: string, params: unknown) {
	const bytes = new TextEncoder().encode(`${provider}|${endpoint}|${stableStringify(params)}`);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function readProviderCache<T>(key: string): Promise<T | null> {
	const [row] = await db
		.select({ payload: providerCache.payload })
		.from(providerCache)
		.where(and(eq(providerCache.key, key), gt(providerCache.expiresAt, new Date())))
		.limit(1);
	return (row?.payload as T | undefined) ?? null;
}

export async function writeProviderCache(key: string, provider: string, endpoint: string, payload: unknown, ttlSeconds: number) {
	const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
	await db
		.insert(providerCache)
		.values({ key, provider, endpoint, payload, expiresAt })
		.onConflictDoUpdate({ target: providerCache.key, set: { payload, expiresAt, createdAt: new Date() } });
}

export async function pruneProviderCache(now = new Date()) {
	const result = await db.delete(providerCache).where(lt(providerCache.expiresAt, now));
	return result.rowCount ?? 0;
}

export { stableStringify as _stableStringifyForTests };
