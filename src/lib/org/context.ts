/*
 * Organization (tenant) resolution. Every SEO feature row belongs to an organization, and every
 * read or write must start from one of the two functions here:
 *
 * - getPersonalOrganization(userId): the caller's own tenant, created on first use. Until the
 *   team UI ships, this is the only organization a user acts in.
 * - requireOrgSite(userId, siteId): the site plus its organization, after checking that the user
 *   is a member of that organization (or, for rows not yet backfilled, the site's creator).
 *
 * Rules:
 * - Never accept an organizationId from a client without requireMembership.
 * - Feature queries filter by the organizationId returned here, never by a bare id.
 * - A site with a null organization_id (created before 0011 was backfilled) is attached to its
 *   creator's personal organization on first access, so no row stays tenant-less.
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { organizationMembers, organizations, sites } from "@/db/schema";

export type OrgRole = "owner" | "admin" | "member";
export type Organization = typeof organizations.$inferSelect;
export type OrgSite = { site: typeof sites.$inferSelect; organization: Organization; role: OrgRole };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class OrgAccessError extends Error {
	constructor(message = "Not found") {
		super(message);
		this.name = "OrgAccessError";
	}
}

/** The user's personal organization, creating it (and the owner membership) when missing. */
export async function getPersonalOrganization(userId: string): Promise<Organization> {
	const [existing] = await db
		.select()
		.from(organizations)
		.where(and(eq(organizations.ownerUserId, userId), eq(organizations.personal, true)))
		.limit(1);
	if (existing) return existing;

	// The partial unique index makes concurrent first requests safe: the loser inserts nothing
	// and reads the winner's row.
	await db
		.insert(organizations)
		.values({ name: "Personal", ownerUserId: userId, personal: true })
		.onConflictDoNothing({ target: organizations.ownerUserId, where: eq(organizations.personal, true) });
	const [org] = await db
		.select()
		.from(organizations)
		.where(and(eq(organizations.ownerUserId, userId), eq(organizations.personal, true)))
		.limit(1);
	if (!org) throw new Error("Could not create the personal organization");
	await db
		.insert(organizationMembers)
		.values({ organizationId: org.id, userId, role: "owner" })
		.onConflictDoNothing({ target: [organizationMembers.organizationId, organizationMembers.userId] });
	return org;
}

/** The user's role in an organization, or null when not a member. */
export async function getMembershipRole(userId: string, organizationId: string): Promise<OrgRole | null> {
	if (!UUID.test(organizationId)) return null;
	const [row] = await db
		.select({ role: organizationMembers.role })
		.from(organizationMembers)
		.where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)))
		.limit(1);
	return (row?.role as OrgRole | undefined) ?? null;
}

export async function requireMembership(userId: string, organizationId: string, allowed: OrgRole[] = ["owner", "admin", "member"]) {
	const role = await getMembershipRole(userId, organizationId);
	if (!role || !allowed.includes(role)) throw new OrgAccessError();
	return role;
}

/**
 * A site the user may act on, with its organization. Unknown, foreign and malformed ids all
 * fail the same way so the response does not reveal whether a site exists.
 */
export async function requireOrgSite(userId: string, siteId: string): Promise<OrgSite> {
	if (!UUID.test(siteId)) throw new OrgAccessError("Site not found");
	const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
	if (!site) throw new OrgAccessError("Site not found");

	if (!site.organizationId) {
		// Pre-backfill row: only its creator may claim it, into their personal organization.
		if (site.userId !== userId) throw new OrgAccessError("Site not found");
		const organization = await getPersonalOrganization(userId);
		await db
			.update(sites)
			.set({ organizationId: organization.id })
			.where(and(eq(sites.id, site.id), isNull(sites.organizationId)));
		return { site: { ...site, organizationId: organization.id }, organization, role: "owner" };
	}

	const role = await getMembershipRole(userId, site.organizationId);
	if (!role) throw new OrgAccessError("Site not found");
	const [organization] = await db.select().from(organizations).where(eq(organizations.id, site.organizationId)).limit(1);
	if (!organization) throw new OrgAccessError("Site not found");
	return { site, organization, role };
}
