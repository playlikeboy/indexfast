"use server";

/*
 * Public server action behind the /contact and /feedback forms. No sign-in required. Order matters:
 * validate, flood-check, store the row, then email. The row is the record; the email is a
 * notification, so a failed send still tells the visitor their message arrived.
 * Returns a result object instead of throwing (Next hides thrown messages in production).
 */
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { CONTACT_LIMITS, parseContactForm, sendContactEmail } from "@/lib/contact/messages";

export type ContactFormState = {
	status: "idle" | "success" | "error";
	message?: string;
	fieldErrors?: Partial<Record<"name" | "email" | "message" | "rating" | "topic", string>>;
	// Echoed back on error: React 19 resets a form after its action runs, so the fields refill from these.
	values?: Partial<Record<"name" | "email" | "message" | "rating" | "topic", string>>;
};

function echo(form: FormData): ContactFormState["values"] {
	const pick = (k: string) => {
		const v = form.get(k);
		return typeof v === "string" ? v.slice(0, 5000) : undefined;
	};
	return { name: pick("name"), email: pick("email"), message: pick("message"), rating: pick("rating"), topic: pick("topic") };
}

export async function submitContactMessage(_prev: ContactFormState, form: FormData): Promise<ContactFormState> {
	const parsed = parseContactForm(form);
	if (!parsed.ok) return { status: "error", message: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors, values: echo(form) };
	const thanks = form.get("kind") === "feedback" ? "Thanks, your feedback reached us." : "Thanks, we got your message and will reply by email.";
	if (parsed.spam) return { status: "success", message: thanks };

	const input = parsed.value;
	try {
		const since = new Date(Date.now() - 60 * 60 * 1000);
		const [recent] = await db
			.select({ n: count() })
			.from(contactMessages)
			.where(and(eq(contactMessages.email, input.email), gte(contactMessages.createdAt, since)));
		if ((recent?.n ?? 0) >= CONTACT_LIMITS.perEmailPerHour) {
			return { status: "error", message: "Too many messages from this address in the last hour. Try again later.", values: echo(form) };
		}

		const user = await getSessionUser().catch(() => null);
		const [row] = await db
			.insert(contactMessages)
			.values({ ...input, userId: user?.id ?? null })
			.returning({ id: contactMessages.id });

		const outcome = await sendContactEmail(input, row.id);
		await db
			.update(contactMessages)
			.set({ emailStatus: outcome.status === "sent" ? `sent:${outcome.via}` : outcome.status, emailError: outcome.status === "sent" ? null : outcome.error })
			.where(eq(contactMessages.id, row.id));
		if (outcome.status !== "sent") console.error("contact email not sent", row.id, outcome.error);

		return { status: "success", message: thanks };
	} catch (err) {
		console.error("contact message failed", err);
		return { status: "error", message: "Something went wrong saving your message. Email support@indexfast.co instead.", values: echo(form) };
	}
}
