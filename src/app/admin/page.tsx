/** Admin loader. Access is enforced here and in the admin layout. */
import { AdminView, RANGES } from "@/components/app/views/AdminView";
import { getAdminOverview } from "@/db/admin-queries";
import { requireAdmin } from "@/lib/auth";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
	await requireAdmin();
	const { range } = await searchParams;
	const rangeDays = RANGES.includes(Number(range)) ? Number(range) : 30;
	return <AdminView data={await getAdminOverview(rangeDays)} />;
}
