/**
 * Connect loader. Reads ?google= and ?reason= from the Google OAuth callback so the result of
 * the redirect is shown once on this page; any other value is ignored.
 */
import { ConnectView, googleNoticeFrom } from "@/components/app/views/ConnectView";
import { getConnectPage } from "@/db/app-queries";
import { requireSessionUser } from "@/lib/auth";

export const metadata = { title: "Connect" };

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ google?: string | string[]; reason?: string | string[] }> }) {
	const user = await requireSessionUser();
	const [data, params] = await Promise.all([getConnectPage(user.id), searchParams]);
	const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
	return <ConnectView data={data} googleNotice={googleNoticeFrom(first(params.google), first(params.reason))} />;
}
