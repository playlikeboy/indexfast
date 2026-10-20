import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function runMigrate() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not set in environment variables.");
	}

	console.log("Applying migrations via Neon HTTP serverless driver...");
	const sql = neon(process.env.DATABASE_URL);
	const db = drizzle(sql);

	await migrate(db, {
		migrationsFolder: "./drizzle",
	});

	console.log("Database migrations applied successfully.");
}

runMigrate().catch((err) => {
	console.error("Migration error:", err);
	process.exit(1);
});
