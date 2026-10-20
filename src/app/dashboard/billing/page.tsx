/** Billing loader. */
import { BillingView } from "@/components/app/views/BillingView";
import { requireSessionUser } from "@/lib/auth";
import { getBillingOverview } from "@/lib/platform/razorpay-billing";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
	const user = await requireSessionUser();
	return <BillingView data={await getBillingOverview(user.id)} />;
}
