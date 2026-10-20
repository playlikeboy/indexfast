/**
 * Site page loader. Parses the URL state (tab, search, page), loads data scoped to the
 * signed-in user, and hands it to SiteView.
 */
import { notFound } from "next/navigation";
import { SiteView, TABS } from "@/components/app/views/SiteView";
import { getSitePage, type UrlTab } from "@/db/app-queries";
import { requireSessionUser } from "@/lib/auth";

type PageProps = {
	params: Promise<{ siteId: string }>;
	searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
};

export default async function SitePage({ params, searchParams }: PageProps) {
	const user = await requireSessionUser();
	const { siteId } = await params;
	const query = await searchParams;
	const tab = (TABS.find((item) => item.id === query.tab)?.id ?? "all") as UrlTab;
	const q = (query.q || "").slice(0, 200);
	const pageNumber = Math.max(1, Number(query.page) || 1);

	const data = await getSitePage(user.id, siteId, { tab, q, page: pageNumber });
	if (!data) notFound();

	return <SiteView data={data} tab={tab} q={q} pageNumber={pageNumber} />;
}
