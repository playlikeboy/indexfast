/** Billing loader: plan + payments, and the organization's SEO data credits and BYOK status. */
import { BillingView } from "@/components/app/views/BillingView";
import { requireSessionUser } from "@/lib/auth";
import { getPersonalOrganization } from "@/lib/org/context";
import { getCreditUsageForApi } from "@/lib/platform/seo-operations";
import { getBillingOverview } from "@/lib/platform/razorpay-billing";
import { getByokStatus } from "@/lib/providers/credentials";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
	const user = await requireSessionUser();
	const organization = await getPersonalOrganization(user.id);
	const [overview, usage, byok] = await Promise.all([getBillingOverview(user.id), getCreditUsageForApi(user.id, 50), getByokStatus(organization.id)]);
	return <BillingView data={overview} credits={{ ...usage, byok: byok ? { label: byok.label } : null }} />;
}
