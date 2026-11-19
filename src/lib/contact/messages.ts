/*
 * Contact and feedback messages: input validation and the notification email. Pure functions
 * here (parse, format) are unit tested; sendContactEmail is the only network call.
 *
 * Rules:
 * - Anyone can submit, so every field is length capped and the email must look like an address.
 * - A hidden "website" field is a honeypot: bots fill it, people never see it. A filled honeypot
 *   is reported as success so the bot learns nothing, but nothing is stored or sent.
 * - The email is plain text only, and the subject has line breaks stripped, so a visitor cannot
 *   inject HTML or extra headers into the operator's inbox.
 */

export type ContactKind = "contact" | "feedback";
export const CONTACT_TOPICS = ["support", "sales", "security", "other"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_LIMITS = {
	nameMax: 120,
	emailMax: 254,
	messageMin: 10,
	messageMax: 5000,
	pathMax: 300,
	perEmailPerHour: 5, // Simple flood guard; real people rarely send more than one or two
} as const;

export type ContactInput = {
	kind: ContactKind;
	name: string | null;
	email: string;
	topic: ContactTopic | null;
	rating: number | null;
	message: string;
	pagePath: string | null;
};

export type ParseResult =
	| { ok: true; spam: false; value: ContactInput }
	| { ok: true; spam: true }
	| { ok: false; fieldErrors: Partial<Record<"name" | "email" | "message" | "rating" | "topic", string>> };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(form: FormData, key: string) {
	const raw = form.get(key);
	return typeof raw === "string" ? raw.trim() : "";
}

export function parseContactForm(form: FormData): ParseResult {
	if (text(form, "website")) return { ok: true, spam: true };

	const kind: ContactKind = text(form, "kind") === "feedback" ? "feedback" : "contact";
	const name = text(form, "name").slice(0, CONTACT_LIMITS.nameMax) || null;
	const email = text(form, "email").toLowerCase();
	const message = text(form, "message");
	const pagePath = text(form, "pagePath").slice(0, CONTACT_LIMITS.pathMax) || null;
	const errors: Extract<ParseResult, { ok: false }>["fieldErrors"] = {};

	if (!email || email.length > CONTACT_LIMITS.emailMax || !EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
	if (message.length < CONTACT_LIMITS.messageMin) errors.message = `Write at least ${CONTACT_LIMITS.messageMin} characters.`;
	else if (message.length > CONTACT_LIMITS.messageMax) errors.message = `Keep it under ${CONTACT_LIMITS.messageMax} characters.`;

	let topic: ContactTopic | null = null;
	let rating: number | null = null;
	if (kind === "contact") {
		const rawTopic = text(form, "topic") || "support";
		if ((CONTACT_TOPICS as readonly string[]).includes(rawTopic)) topic = rawTopic as ContactTopic;
		else errors.topic = "Pick a topic.";
	} else {
		const rawRating = text(form, "rating");
		if (rawRating) {
			const n = Number(rawRating);
			if (Number.isInteger(n) && n >= 1 && n <= 5) rating = n;
			else errors.rating = "Pick a rating from 1 to 5.";
		}
	}

	if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
	return { ok: true, spam: false, value: { kind, name, email, topic, rating, message, pagePath } };
}

export function formatContactEmail(input: ContactInput, id: string) {
	const label = input.kind === "feedback" ? "Feedback" : `Contact (${input.topic ?? "other"})`;
	const who = input.name ? `${input.name} <${input.email}>` : input.email;
	const subject = `[IndexFast] ${label} from ${who}`.replace(/[\r\n]+/g, " ").slice(0, 200);
	const lines = [
		`Type: ${label}`,
		`From: ${who}`,
		input.rating ? `Rating: ${input.rating}/5` : null,
		input.pagePath ? `Page: ${input.pagePath}` : null,
		`Message id: ${id}`,
		"",
		input.message,
	].filter((line): line is string => line !== null);
	return { subject, text: lines.join("\n") };
}

// Who gets notified: CONTACT_NOTIFY_EMAIL, else the first ADMIN_EMAILS address.
export function contactRecipient(env: Record<string, string | undefined> = process.env) {
	const explicit = env.CONTACT_NOTIFY_EMAIL?.trim();
	if (explicit) return explicit;
	return (env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).find(Boolean) ?? null;
}

export type EmailOutcome = { status: "sent" } | { status: "skipped"; error: string } | { status: "failed"; error: string };

// Resend REST API over fetch (no SDK, so it runs on the Worker). Never throws.
export async function sendContactEmail(input: ContactInput, id: string): Promise<EmailOutcome> {
	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.RESEND_FROM_EMAIL;
	const to = contactRecipient();
	if (!apiKey || !from || !to) return { status: "skipped", error: "RESEND_API_KEY, RESEND_FROM_EMAIL or a recipient is not set" };

	const { subject, text: body } = formatContactEmail(input, id);
	try {
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
			body: JSON.stringify({ from, to: [to], reply_to: input.email, subject, text: body }),
			signal: AbortSignal.timeout(10_000),
		});
		if (res.ok) return { status: "sent" };
		return { status: "failed", error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
	} catch (err) {
		return { status: "failed", error: err instanceof Error ? err.message : String(err) };
	}
}
