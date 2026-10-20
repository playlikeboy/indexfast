/** Websites screen loader. */
import { HomeView } from "@/components/app/views/HomeView";
import { getDashboardHome } from "@/db/app-queries";
import { requireSessionUser } from "@/lib/auth";

export default async function DashboardPage() {
	const user = await requireSessionUser();
	return <HomeView data={await getDashboardHome(user.id)} />;
}
