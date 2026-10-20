import { Metadata } from "next";
import { Navbar } from "@/components/marketing/Navbar";
import { Pricing } from "@/components/marketing/Pricing";
import { FinalCTA, Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";

const SITE_URL = "https://indexfast.co";

export const metadata: Metadata = {
	title: "Pricing | IndexFast",
	description:
		"Free, Pro at $19/month, or Unlimited at $99/month. Prepaid 30-day plans with no auto-renewal.",
};

export default function PricingPage() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd
					items={[
						{ name: "Home", url: SITE_URL },
						{ name: "Pricing", url: `${SITE_URL}/pricing` },
					]}
				/>
				<Pricing />
				<FinalCTA />
			</main>
			<Footer />
		</>
	);
}
