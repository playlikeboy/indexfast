/*
 * /pricing: the offer first (plans from VISIBLE_PLANS as the hero), then how a prepaid period
 * ends, then the shared close. Prices are never written here; they come from plans.ts.
 */
import { Metadata } from "next";
import { Navbar } from "@/components/marketing/Navbar";
import { Pricing } from "@/components/marketing/Pricing";
import { FinalCTA, Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { PLAN_PERIOD_DAYS, PLANS } from "@/lib/platform/plans";
import { PlanPeriod } from "./PlanPeriod";
import { withPageSeo } from "@/lib/seo";

const SITE_URL = "https://indexfast.co";

// Same sentence as before, with the prices read from the catalog so search snippets never go stale.
export const metadata: Metadata = withPageSeo("/pricing", {
	title: "Pricing: Free, Pro and Unlimited Indexing Plans",
	description: `Free, Pro at $${PLANS.pro.priceUsd} per ${PLAN_PERIOD_DAYS} days, or Unlimited at $${PLANS.unlimited.priceUsd} per ${PLAN_PERIOD_DAYS} days. Prepaid ${PLAN_PERIOD_DAYS}-day plans with no auto-renewal.`,
});

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
				<PlanPeriod />
				<FinalCTA />
			</main>
			<Footer />
		</>
	);
}
