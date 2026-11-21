/*
 * Which DataForSEO account pays for a call: the organization's own key (BYOK) when it saved one,
 * otherwise the platform key from Worker secrets. Platform credentials never leave the server
 * and are never shown in the UI, logs or API responses; a BYOK login is shown masked only.
 *
 * Platform secrets: DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD, or DATAFORSEO_API_KEY holding
 * base64("login:password") (the format OpenSEO uses).
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { providerCredentials } from "@/db/schema";
import { encryptSecret, maskCredential, readSecret } from "@/lib/automation/credentials";
import type { DataforseoCredentials } from "@/lib/providers/dataforseo/client";

export function platformDataforseoCredentials(env: Record<string, string | undefined> = process.env): DataforseoCredentials | null {
	const login = env.DATAFORSEO_LOGIN?.trim();
	const password = env.DATAFORSEO_PASSWORD?.trim();
	if (login && password) return { login, password, source: "platform" };
	const key = env.DATAFORSEO_API_KEY?.trim();
	if (key) {
		try {
			const decoded = atob(key);
			const split = decoded.indexOf(":");
			if (split > 0) return { login: decoded.slice(0, split), password: decoded.slice(split + 1), source: "platform" };
		} catch {
			// Not base64: treated as not configured
		}
	}
	return null;
}

export async function getByokDataforseoCredentials(organizationId: string): Promise<DataforseoCredentials | null> {
	const [row] = await db
		.select({ encryptedSecret: providerCredentials.encryptedSecret })
		.from(providerCredentials)
		.where(and(eq(providerCredentials.organizationId, organizationId), eq(providerCredentials.provider, "dataforseo")))
		.limit(1);
	if (!row) return null;
	const { plaintext } = await readSecret(row.encryptedSecret);
	const parsed = JSON.parse(plaintext) as { login?: string; password?: string };
	return parsed.login && parsed.password ? { login: parsed.login, password: parsed.password, source: "byok" } : null;
}

/** BYOK first, then platform; null when neither exists (features then say data is unavailable). */
export async function resolveDataforseoCredentials(organizationId: string) {
	return (await getByokDataforseoCredentials(organizationId)) ?? platformDataforseoCredentials();
}

export async function saveByokDataforseoCredentials(organizationId: string, login: string, password: string) {
	const now = new Date();
	const encryptedSecret = await encryptSecret(JSON.stringify({ login: login.trim(), password: password.trim() }));
	await db
		.insert(providerCredentials)
		.values({ organizationId, provider: "dataforseo", encryptedSecret, label: maskCredential(login.trim()), lastValidatedAt: now })
		.onConflictDoUpdate({
			target: [providerCredentials.organizationId, providerCredentials.provider],
			set: { encryptedSecret, label: maskCredential(login.trim()), lastValidatedAt: now, lastError: null, updatedAt: now },
		});
}

export async function removeByokDataforseoCredentials(organizationId: string) {
	await db.delete(providerCredentials).where(and(eq(providerCredentials.organizationId, organizationId), eq(providerCredentials.provider, "dataforseo")));
}

export async function getByokStatus(organizationId: string) {
	const [row] = await db
		.select({ label: providerCredentials.label, lastValidatedAt: providerCredentials.lastValidatedAt })
		.from(providerCredentials)
		.where(and(eq(providerCredentials.organizationId, organizationId), eq(providerCredentials.provider, "dataforseo")))
		.limit(1);
	return row ?? null;
}
