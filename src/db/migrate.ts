/**
 * `bun run db:migrate`: apply ./drizzle migrations.
 *
 * Uses the WebSocket (neon-serverless) driver, not the HTTP one, because only it supports
 * transactions: drizzle's pg migrator runs every pending migration and its journal row inside
 * one transaction, so a failing statement rolls everything back instead of leaving a
 * half-applied migration that is not recorded and cannot simply be re-run.
 */
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

async function runMigrate() {
	const url = process.env.DATABASE_URL?.trim();
	if (!url) {
		throw new Error("DATABASE_URL is not set in environment variables.");
	}

	const pool = new Pool({ connectionString: url });
	try {
		console.log("Applying migrations in one transaction (Neon WebSocket driver)...");
		await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle", migrationsSchema: "drizzle", migrationsTable: "__drizzle_migrations" });
		console.log("Database migrations applied successfully.");
	} finally {
		await pool.end();
	}
}

runMigrate().catch((err) => {
	console.error("Migration error (nothing from the failed run was committed):", err);
	process.exit(1);
});
