/**
 * Site page loader. Parses the URL state (section, URL filter, search, page), loads data
 * scoped to the signed-in user, and hands it to SiteView. `?tab=queue` links from before the
 * sections split still land on the Queue section.
 */
import { notFound } from "next/navigation";
import { SECTIONS, SiteView, TABS, type SiteSection } from "@/components/app/views/SiteView";
import { getSitePage, type UrlTab } from "@/db/app-queries";
import { requireSessionUser } from "@/lib/auth";

type PageProps = {
	params: Promise<{ siteId: string }>;
	searchParams: Promise<{ view?: string; tab?: string; q?: string; page?: string }>;
};

export default async function SitePage({ params, searchParams }: PageProps) {
	const user = await requireSessionUser();
	const { siteId } = await params;
	const query = await searchParams;
	const urlTab = TABS.find((item) => item.id === query.tab)?.id;
	const section: SiteSection =
		query.tab === "queue" ? "queue" : (SECTIONS.find((item) => item.id === query.view)?.id ?? (urlTab ? "urls" : "overview"));
	const tab: UrlTab = section === "queue" ? "queue" : (urlTab ?? "all");
	const q = (query.q || "").slice(0, 200);
	const pageNumber = Math.max(1, Number(query.page) || 1);

	const data = await getSitePage(user.id, siteId, { tab, q, page: pageNumber });
	if (!data) notFound();

	return <SiteView data={data} section={section} tab={tab} q={q} pageNumber={pageNumber} />;
}
