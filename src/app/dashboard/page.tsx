/** Websites screen loader. Auth first, then the user-scoped read in app-queries. */
import { HomeView } from "@/components/app/views/HomeView";
import { getDashboardHome } from "@/db/app-queries";
import { requireSessionUser } from "@/lib/auth";

export const metadata = { title: "Websites" };

export default async function DashboardPage() {
	const user = await requireSessionUser();
	return <HomeView data={await getDashboardHome(user.id)} />;
}
