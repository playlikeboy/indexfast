import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/stack", () => ({ stack: {} }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));

const { isAdmin } = await import("@/lib/auth");

const user = (email: string, emailVerified: boolean) => ({ id: "u1", email, name: null, emailVerified });

describe("isAdmin", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("requires a verified email even for the default admin addresses", () => {
		expect(isAdmin(user("sh20raj@gmail.com", false))).toBe(false);
		expect(isAdmin(user("sh20raj@gmail.com", true))).toBe(true);
	});

	it("matches ADMIN_EMAILS case-insensitively, verified only", () => {
		vi.stubEnv("ADMIN_EMAILS", "Ops@Example.com, other@example.com");
		expect(isAdmin(user(" ops@example.com ", true))).toBe(true);
		expect(isAdmin(user("ops@example.com", false))).toBe(false);
	});

	it("rejects missing users and unlisted addresses", () => {
		expect(isAdmin(null)).toBe(false);
		expect(isAdmin(user("", true))).toBe(false);
		expect(isAdmin(user("someone@example.com", true))).toBe(false);
	});
});
