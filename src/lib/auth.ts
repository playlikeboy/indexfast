/**
 * Session helpers for server components and server actions. Stack Auth owns identity; we
 * mirror each user into the `users` table on first dashboard visit so foreign keys and
 * billing state have a row to hang off.
 *
 * Admin access is an allowlist of emails from ADMIN_EMAILS (comma separated). The email
 * must be *verified* in Stack Auth, otherwise anyone could sign up with an unverified
 * password account using the admin's address and walk into /admin.
 */
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { stack } from "@/stack";

const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

export type SessionUser = { id: string; email: string; name: string | null; emailVerified: boolean };

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof stack.getUser>>>): SessionUser {
	return {
		id: user.id,
		email: user.primaryEmail || "",
		name: user.displayName,
		emailVerified: Boolean(user.primaryEmailVerified),
	};
}

export async function getSessionUser(): Promise<SessionUser | null> {
	try {
		const user = await stack.getUser();
		return user ? toSessionUser(user) : null;
	} catch {
		return null;
	}
}

/** For pages: redirect to sign-in when signed out. */
export async function requireSessionUser() {
	const user = await getSessionUser();
	if (!user) {
		redirect(stack.urls.signIn);
	}
	return user;
}

/** For server actions: throw instead of redirecting. */
export async function requireActionUser() {
	const user = await getSessionUser();
	if (!user) {
		throw new Error("Please sign in again.");
	}
	return user;
}

/** Upsert the mirror row; refresh email and a throttled lastSeenAt for analytics. */
export async function ensureUserRow(user: SessionUser) {
	const [existing] = await db
		.select({ email: users.email, lastSeenAt: users.lastSeenAt })
		.from(users)
		.where(eq(users.id, user.id))
		.limit(1);
	const now = new Date();

	if (!existing) {
		await db
			.insert(users)
			.values({ id: user.id, email: user.email, billingTier: "free", lastSeenAt: now })
			.onConflictDoNothing({ target: users.id });
		return;
	}

	const stale = !existing.lastSeenAt || now.getTime() - existing.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS;
	if (stale || (user.email && existing.email !== user.email)) {
		await db
			.update(users)
			.set({ email: user.email || existing.email, lastSeenAt: now, updatedAt: now })
			.where(eq(users.id, user.id));
	}
}

export function getAdminEmails() {
	return (process.env.ADMIN_EMAILS || "")
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
}

export function isAdmin(user: SessionUser | null) {
	return Boolean(user && user.emailVerified && user.email && getAdminEmails().includes(user.email.toLowerCase()));
}

/** 404 (not 403) for non-admins so the panel's existence is not advertised. */
export async function requireAdmin() {
	const user = await getSessionUser();
	if (!user) {
		redirect(stack.urls.signIn);
	}
	if (!isAdmin(user)) {
		notFound();
	}
	return user;
}
