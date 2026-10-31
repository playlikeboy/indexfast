/**
 * Site page loader. Parses the URL state (section, URL filter, search, page), loads data
 * scoped to the signed-in user, and hands it to SiteView. `?tab=queue` links from before the
 * sections split still land on the Queue section.
 * Search params are untrusted: a repeated param arrives as an array (first value wins), the page
 * is clamped so a huge offset cannot reach the database, and a malformed site id 404s before any
 * query runs (Postgres would otherwise throw on a non-UUID cast).
 */
import { notFound } from "next/navigation";
import { SECTIONS, SiteView, TABS, type SiteSection } from "@/components/app/views/SiteView";
import { getSitePage, type UrlTab } from "@/db/app-queries";
import { requireSessionUser } from "@/lib/auth";
import { parsePageNumber, firstParam, isUuid } from "./params";

type Param = string | string[] | undefined;

type PageProps = {
	params: Promise<{ siteId: string }>;
	searchParams: Promise<{ view?: Param; tab?: Param; q?: Param; page?: Param }>;
};

export default async function SitePage({ params, searchParams }: PageProps) {
	const user = await requireSessionUser();
	const { siteId } = await params;
	if (!isUuid(siteId)) notFound();

	const query = await searchParams;
	const view = firstParam(query.view);
	const tabParam = firstParam(query.tab);
	const urlTab = TABS.find((item) => item.id === tabParam)?.id;
	const section: SiteSection = tabParam === "queue" ? "queue" : (SECTIONS.find((item) => item.id === view)?.id ?? (urlTab ? "urls" : "overview"));
	const tab: UrlTab = section === "queue" ? "queue" : (urlTab ?? "all");
	const q = (firstParam(query.q) ?? "").slice(0, 200);
	const pageNumber = parsePageNumber(firstParam(query.page));

	const data = await getSitePage(user.id, siteId, { tab, q, page: pageNumber });
	if (!data) notFound();

	return <SiteView data={data} section={section} tab={tab} q={q} pageNumber={pageNumber} />;
}
