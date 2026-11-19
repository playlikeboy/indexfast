/*
 * /feedback: one short form for product feedback (optional 1-5 rating plus free text). Same
 * action and table as /contact (kind 'feedback'), so every submission is stored and emailed.
 */
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { ContactForm } from "@/components/marketing/ContactForm";
import { Container } from "@/components/ui";
import type { Metadata } from "next";
import { withPageSeo } from "@/lib/seo";

const SITE_URL = "https://indexfast.co";

export const metadata: Metadata = withPageSeo("/feedback", {
	title: "Send Feedback",
	description: "Tell the IndexFast team what works, what breaks and what is missing. Every message is read.",
});

export default function FeedbackPage() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd
					items={[
						{ name: "Home", url: SITE_URL },
						{ name: "Feedback", url: `${SITE_URL}/feedback` },
					]}
				/>
				<section className="pt-(--section-gap-s) pb-(--section-gap)" aria-labelledby="feedback-heading">
					<Container>
						<div className="grid gap-4 lg:grid-cols-12 lg:items-end lg:gap-8">
							<h1 id="feedback-heading" className="max-w-[16ch] font-display text-display text-ink lg:col-span-7">
								Tell us what to fix next.
							</h1>
							<p className="max-w-[36ch] text-lead text-ink-2 lg:col-span-4 lg:col-start-9">
								Bugs, missing engines, confusing screens. A person reads every message.
							</p>
						</div>
						<div className="mt-16 max-w-3xl">
							<ContactForm kind="feedback" />
						</div>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
