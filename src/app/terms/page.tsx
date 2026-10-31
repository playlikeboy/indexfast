/*
 * /terms: the terms of service. The legal text is kept word for word; only its setting changed.
 * The layout is shared with /privacy (LegalDocument).
 */
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { LegalDocument } from "@/app/privacy/LegalDocument";
import type { Metadata } from "next";

const SITE_URL = "https://indexfast.co";

export const metadata: Metadata = {
	title: "Terms of Service",
	description:
		"Read the IndexFast terms of service to understand user guidelines, payment and billing terms, fair use limits, and liability policies.",
	alternates: {
		canonical: `${SITE_URL}/terms`,
	},
};

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Terms of Service", url: `${SITE_URL}/terms` },
];

export default function TermsPage() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<LegalDocument
					headingId="terms-heading"
					title="Terms of service"
					updated="2026-06-05"
					updatedLabel="June 5, 2026"
				>
					<p>
						By accessing or using IndexFast (&quot;the Service&quot;), you agree to be bound by
						these Terms of Service. If you do not agree to all of these terms, do not use the
						Service.
					</p>
					<h2>Service description</h2>
					<p>
						IndexFast provides SEO indexing diagnostics, sitemap monitoring, and safe
						discovery automation. We do not guarantee that any submitted URL will be indexed
						by any search engine. Results depend on third-party systems such as Google, Bing,
						and Yandex, which are outside our control.
					</p>
					<h2>Fair use</h2>
					<p>
						You agree not to misuse the Service, attempt to overload our infrastructure, or
						use automated bulk submissions in ways that may harm search engines or third
						parties. We reserve the right to suspend accounts that violate this policy.
					</p>
					<h2>Pricing and payments</h2>
					<p>
						Subscription fees are billed on a monthly or annual basis. All fees are
						non-refundable unless required by law. We reserve the right to change pricing
						with reasonable notice.
					</p>
					<h2>Intellectual property</h2>
					<p>
						The Service, including its code, design, content, and trademarks, is the
						property of IndexFast. You may not copy, modify, or distribute the platform
						without written permission.
					</p>
					<h2>Limitation of liability</h2>
					<p>
						IndexFast shall not be liable for any indirect, incidental, special,
						consequential, or punitive damages arising from your use of the Service. Our
						total liability shall not exceed the amount you paid us in the twelve months
						prior to the claim.
					</p>
					<h2>Contact</h2>
					<p>
						For questions about these terms, please <Link href="/contact">contact us</Link>.
					</p>
				</LegalDocument>
			</main>
			<Footer />
		</>
	);
}
