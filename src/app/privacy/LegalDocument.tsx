/*
 * Long-document layout shared by /privacy and /terms: the title and the revision date stay in
 * view on the left while the text scrolls on the right at a 65ch measure.
 * Legal wording is passed in untouched; this component only sets it.
 */
import type { ReactNode } from "react";
import { Container } from "@/components/ui";

export function LegalDocument({
	headingId,
	title,
	updated,
	updatedLabel,
	children,
}: {
	headingId: string;
	title: string;
	updated: string; // ISO date for <time dateTime>
	updatedLabel: string;
	children: ReactNode;
}) {
	return (
		<section className="pt-(--section-gap-s) pb-(--section-gap)" aria-labelledby={headingId}>
			<Container>
				<div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
					<header className="lg:sticky lg:top-24 lg:col-span-4 lg:self-start">
						<h1 id={headingId} className="font-display text-display-s text-ink">
							{title}
						</h1>
						<p className="mt-6 text-sm text-muted">
							Last updated <time dateTime={updated}>{updatedLabel}</time>
						</p>
					</header>
					<div className="max-w-[65ch] text-ink-2 leading-[1.7] lg:col-span-7 lg:col-start-6 [&_a]:text-ink [&_a]:underline [&_a]:decoration-border-strong [&_a]:underline-offset-4 [&_a:hover]:decoration-signal [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-title [&_h2]:font-medium [&_h2]:text-ink [&_p+p]:mt-4">
						{children}
					</div>
				</div>
			</Container>
		</section>
	);
}
