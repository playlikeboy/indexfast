/*
 * /privacy: the privacy policy. The legal text is kept word for word; only its setting changed.
 */
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import type { Metadata } from "next";
import { LegalDocument } from "./LegalDocument";
import { withPageSeo } from "@/lib/seo";

const SITE_URL = "https://indexfast.co";

export const metadata: Metadata = withPageSeo("/privacy", {
	title: "Privacy Policy",
	description:
		"Read the IndexFast privacy policy to learn how we securely collect, process, and safeguard your account details and web property diagnostic data.",
	alternates: {
		canonical: `${SITE_URL}/privacy`,
	},
});

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Privacy Policy", url: `${SITE_URL}/privacy` },
];

export default function PrivacyPage() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<LegalDocument
					headingId="privacy-heading"
					title="Privacy policy"
					updated="2026-06-05"
					updatedLabel="June 5, 2026"
				>
					<p>
						IndexFast (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your
						privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
						your information when you use our platform at indexfast.co.
					</p>
					<h2>Information we collect</h2>
					<p>
						We collect account information such as your name, email address, and billing details
						when you sign up. When you use our tools, we also process the URLs, sitemaps, and
						technical data you submit for diagnostic purposes.
					</p>
					<h2>How we use your information</h2>
					<p>
						We use your data to operate, maintain, and improve the platform; deliver
						diagnostics, alerts, and reports; process payments; and send service-related
						notifications. We do not sell your data to third parties.
					</p>
					<h2>Data retention</h2>
					<p>
						We retain your account and diagnostic data for as long as your account is active
						or as needed to provide the service. You may request deletion at any time by
						contacting us.
					</p>
					<h2>Cookies</h2>
					<p>
						We use essential cookies to operate the platform and preference cookies for theme
						settings. Analytics cookies are only used with your consent where required by law.
					</p>
					<h2>Third-party services</h2>
					<p>
						We use cloud hosting, database, authentication, and payment providers. These
						services process your data according to their own privacy policies.
					</p>
					<h2>Contact</h2>
					<p>
						If you have questions about this Privacy Policy, please{" "}
						<Link href="/contact">contact us</Link>.
					</p>
				</LegalDocument>
			</main>
			<Footer />
		</>
	);
}
