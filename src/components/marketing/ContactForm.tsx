"use client";

/*
 * One form for /contact and /feedback. The kind prop decides the extra field: a topic select for
 * contact, an optional 1-5 rating for feedback. Field errors come back from the server action and
 * sit in Field's reserved line, so the form never jumps. After success the form is replaced by
 * the confirmation, which only appears once the row is saved. The "website" input is a honeypot,
 * hidden from people and assistive tech.
 */
import { useActionState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { submitContactMessage, type ContactFormState } from "@/app/contact/actions";

const initial: ContactFormState = { status: "idle" };

export function ContactForm({ kind }: { kind: "contact" | "feedback" }) {
	const [state, action, pending] = useActionState(submitContactMessage, initial);
	const pathname = usePathname();
	const errors = state.fieldErrors ?? {};
	const values = state.values ?? {};

	if (state.status === "success") {
		return (
			<div role="status" className="flex items-start gap-3 border-t border-border py-8">
				<CheckCircle2 aria-hidden="true" className="mt-1 size-5 shrink-0 text-success" />
				<p className="text-lead text-ink">{state.message}</p>
			</div>
		);
	}

	return (
		<form action={action} className="grid gap-x-6 gap-y-2 sm:grid-cols-2" noValidate>
			<input type="hidden" name="kind" value={kind} />
			<input type="hidden" name="pagePath" value={pathname ?? ""} />
			<div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
				<label>
					Website
					<input type="text" name="website" tabIndex={-1} autoComplete="off" />
				</label>
			</div>

			<Field label="Name" error={errors.name}>
				{(control) => <Input {...control} name="name" defaultValue={values.name} autoComplete="name" maxLength={120} size="lg" />}
			</Field>
			<Field label="Email" required error={errors.email} hint="We reply here.">
				{(control) => <Input {...control} name="email" defaultValue={values.email} type="email" autoComplete="email" maxLength={254} size="lg" />}
			</Field>

			{kind === "contact" ? (
				<Field label="Topic" error={errors.topic} className="sm:col-span-2">
					{(control) => (
						<Select {...control} name="topic" defaultValue={values.topic || "support"} size="lg">
							<option value="support">Product and support</option>
							<option value="sales">Sales and agencies</option>
							<option value="security">Security</option>
							<option value="other">Something else</option>
						</Select>
					)}
				</Field>
			) : (
				<Field label="How is IndexFast working for you?" error={errors.rating} hint="Optional. 5 is great." className="sm:col-span-2">
					{(control) => (
						<Select {...control} name="rating" defaultValue={values.rating ?? ""} size="lg">
							<option value="">No rating</option>
							<option value="5">5, great</option>
							<option value="4">4, good</option>
							<option value="3">3, okay</option>
							<option value="2">2, not great</option>
							<option value="1">1, broken for me</option>
						</Select>
					)}
				</Field>
			)}

			<Field
				label={kind === "feedback" ? "Your feedback" : "Message"}
				required
				error={errors.message}
				hint={kind === "feedback" ? "What works, what breaks, what is missing." : "Your site type and scale help us answer faster."}
				className="sm:col-span-2"
			>
				{(control) => <Textarea {...control} name="message" defaultValue={values.message} rows={6} maxLength={5000} />}
			</Field>

			<div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
				<Button type="submit" variant="primary" size="lg" loading={pending}>
					{kind === "feedback" ? "Send feedback" : "Send message"}
				</Button>
				{state.status === "error" && state.message ? (
					<p role="alert" className="text-sm text-danger">
						{state.message}
					</p>
				) : null}
			</div>
		</form>
	);
}
