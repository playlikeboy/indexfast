import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set in environment variables.");
}

export default {
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL,
	},
	migrations: {
		table: "__drizzle_migrations",
		schema: "drizzle",
	},
} satisfies Config;
