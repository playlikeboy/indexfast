import { describe, expect, it } from "vitest";
import { contactRecipient, formatContactEmail, parseContactForm } from "../messages";

function form(fields: Record<string, string>) {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	return f;
}

describe("parseContactForm", () => {
	it("accepts a valid contact message and lowercases the email", () => {
		const r = parseContactForm(form({ kind: "contact", email: "Dev@Example.com", topic: "sales", message: "We run 40 sites, need help." }));
		expect(r).toMatchObject({ ok: true, spam: false, value: { kind: "contact", email: "dev@example.com", topic: "sales", rating: null } });
	});

	it("rejects a bad email and a short message", () => {
		const r = parseContactForm(form({ kind: "contact", email: "nope", message: "hi" }));
		expect(r.ok).toBe(false);
		if (!r.ok) expect(Object.keys(r.fieldErrors).sort()).toEqual(["email", "message"]);
	});

	it("treats a filled honeypot as spam", () => {
		expect(parseContactForm(form({ website: "http://spam", email: "a@b.co", message: "buy stuff now" }))).toEqual({ ok: true, spam: true });
	});

	it("validates feedback rating range and allows no rating", () => {
		expect(parseContactForm(form({ kind: "feedback", email: "a@b.co", message: "Works well so far", rating: "9" })).ok).toBe(false);
		const r = parseContactForm(form({ kind: "feedback", email: "a@b.co", message: "Works well so far" }));
		expect(r).toMatchObject({ ok: true, value: { kind: "feedback", rating: null, topic: null } });
	});

	it("rejects an unknown topic", () => {
		expect(parseContactForm(form({ kind: "contact", email: "a@b.co", message: "hello there team", topic: "hack" })).ok).toBe(false);
	});
});

describe("formatContactEmail", () => {
	it("strips line breaks from the subject", () => {
		const { subject, text } = formatContactEmail(
			{ kind: "feedback", name: "Eve\r\nBcc: x@y.z", email: "e@x.co", topic: null, rating: 4, message: "Nice", pagePath: "/feedback" },
			"id-1",
		);
		expect(subject).not.toMatch(/[\r\n]/);
		expect(text).toContain("Rating: 4/5");
	});
});

describe("contactRecipient", () => {
	it("prefers CONTACT_NOTIFY_EMAIL, then the first admin email", () => {
		expect(contactRecipient({ CONTACT_NOTIFY_EMAIL: "ops@x.co", ADMIN_EMAILS: "a@x.co" })).toBe("ops@x.co");
		expect(contactRecipient({ ADMIN_EMAILS: " a@x.co , b@x.co" })).toBe("a@x.co");
		expect(contactRecipient({})).toBeNull();
	});
});
