/** Connect AI loader. */
import { ConnectView } from "@/components/app/views/ConnectView";
import { getConnectPage } from "@/db/app-queries";
import { requireSessionUser } from "@/lib/auth";

export const metadata = { title: "Connect AI" };

export default async function ConnectPage() {
	const user = await requireSessionUser();
	return <ConnectView data={await getConnectPage(user.id)} />;
}
