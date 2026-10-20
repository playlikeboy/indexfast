import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

let _db: NeonHttpDatabase | null = null;
let _cachedUrl: string | null = null;

function resolveDatabaseUrl(): string {
	let url = process.env.DATABASE_URL;
	if (!url) {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const { getCloudflareContext } = require("@opennextjs/cloudflare");
			const ctx = getCloudflareContext();
			if (ctx?.env?.DATABASE_URL) {
				url = ctx.env.DATABASE_URL as string;
			}
		} catch {
			// Outside Cloudflare context
		}
	}
	if (!url) {
		throw new Error("DATABASE_URL is not set in environment variables.");
	}
	return url.trim().replace(/^["']|["']$/g, "").trim();
}

export function getDb(): NeonHttpDatabase {
	const url = resolveDatabaseUrl();
	if (!_db || _cachedUrl !== url) {
		const sql = neon(url);
		_db = drizzle(sql);
		_cachedUrl = url;
	}
	return _db;
}

export const db = new Proxy({} as NeonHttpDatabase, {
	get(_target, prop, receiver) {
		const client = getDb();
		const value = Reflect.get(client, prop, receiver);
		return typeof value === "function" ? value.bind(client) : value;
	},
});
