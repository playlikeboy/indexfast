/*
 * /contact: a message form first, then the real inboxes and the Instagram profile. The form stores
 * every message in contact_messages and emails the operator (see app/contact/actions.ts); its
 * confirmation appears only after the row is saved. Each inbox row is one mailto link naming who
 * reads it, so a visitor can copy the address without opening a mail app.
 */
import Link from "next/link";
import { Camera, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { Container } from "@/components/ui";
import { ContactForm } from "@/components/marketing/ContactForm";
import { INSTAGRAM_URL } from "@/lib/social";
import type { Metadata } from "next";
import { withPageSeo } from "@/lib/seo";

const SITE_URL = "https://indexfast.co";

export const metadata: Metadata = withPageSeo("/contact", {
	title: "Contact IndexFast Team",
	description:
		"Get in touch with the IndexFast team for product support, enterprise api sales, security responsible disclosure, or agency billing workspaces queries.",
	keywords: [
		"contact indexfast",
		"indexfast support",
		"indexfast customer sales",
		"technical support indexfast",
	],
	alternates: {
		canonical: `${SITE_URL}/contact`,
	},
});

const contactPaths = [
	{
		title: "Product and support",
		description: "Questions about indexing audits, dashboard setup, or account access.",
		href: "mailto:support@indexfast.co",
		icon: MessageSquare,
	},
	{
		title: "Sales and agencies",
		description: "Agency reporting, client workspaces, and high-volume monitoring.",
		href: "mailto:sales@indexfast.co",
		icon: Mail,
	},
	{
		title: "Security",
		description: "Responsible disclosure and data handling questions.",
		href: "mailto:security@indexfast.co",
		icon: ShieldCheck,
	},
	{
		title: "Instagram",
		description: "Product updates, launch clips and quick indexing tips.",
		href: INSTAGRAM_URL,
		label: "@indexfast",
		icon: Camera,
	},
];

export default function ContactPage() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd
					items={[
						{ name: "Home", url: SITE_URL },
						{ name: "Contact", url: `${SITE_URL}/contact` },
					]}
				/>
				<section className="pt-(--section-gap-s) pb-(--section-gap)" aria-labelledby="contact-heading">
					<Container>
						<div className="grid gap-4 lg:grid-cols-12 lg:items-end lg:gap-8">
							<h1 id="contact-heading" className="max-w-[16ch] font-display text-display text-ink lg:col-span-7">
								Talk to the team behind IndexFast.
							</h1>
							<p className="max-w-[36ch] text-lead text-ink-2 lg:col-span-4 lg:col-start-9">
								Send your site type and scale, and we will suggest a workflow.
							</p>
						</div>
						<div className="mt-16 max-w-3xl">
							<h2 className="text-title">Send a message</h2>
							<p className="mt-2 text-ink-2">It goes straight to the team. We reply by email.</p>
							<div className="mt-8">
								<ContactForm kind="contact" />
							</div>
						</div>
						<h2 className="mt-(--section-gap-s) text-title">Or email the right inbox</h2>
						<ul className="mt-6 border-t border-border-strong">
							{contactPaths.map((path) => {
								const Icon = path.icon;
								const address = "label" in path ? path.label : path.href.replace(/^mailto:/, "");
								const external = path.href.startsWith("http");

								return (
									<li key={path.href} className="border-b border-border">
										<Link
											href={path.href}
											{...(external ? { target: "_blank", rel: "me noopener" } : {})}
											className="group -mx-4 grid gap-2 px-4 py-8 transition-colors duration-(--dur-short) hover:bg-well md:grid-cols-12 md:items-baseline md:gap-8"
										>
											<h3 className="flex items-center gap-3 font-display text-title text-ink md:col-span-4">
												<Icon aria-hidden="true" className="size-5 shrink-0 text-muted" />
												{path.title}
											</h3>
											<p className="text-ink-2 md:col-span-4">{path.description}</p>
											<span className="text-md break-all text-ink underline decoration-border-strong underline-offset-4 group-hover:decoration-signal md:col-span-4 md:text-right">
												{address}
											</span>
										</Link>
									</li>
								);
							})}
						</ul>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
