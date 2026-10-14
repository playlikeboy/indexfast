import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

let _db: NeonHttpDatabase | null = null;

export function getDb(): NeonHttpDatabase {
	if (!_db) {
		const url = process.env.DATABASE_URL;
		if (!url) {
			throw new Error("DATABASE_URL is not set in environment variables.");
		}
		const sql = neon(url);
		_db = drizzle(sql);
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
