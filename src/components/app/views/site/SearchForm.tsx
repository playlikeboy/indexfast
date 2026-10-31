/**
 * GET search form for the URLs and Queue tables. It is a plain form (no client state) so the
 * search lives in the URL, survives reloads, and can be shared; hidden fields carry the view
 * and filter so searching never drops the user back to the overview. Search resets paging.
 */
import { Search } from "lucide-react";
import { Input } from "@/components/ui";
import type { SiteSection } from "./shared";
import { siteBase } from "./shared";

export function SearchForm({ siteId, view, tab, q, label }: { siteId: string; view: SiteSection; tab?: string; q: string; label: string }) {
	return (
		<form role="search" className="relative w-full sm:w-72" action={siteBase(siteId)}>
			<input type="hidden" name="view" value={view} />
			{tab && tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
			<Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
			<Input type="search" name="q" defaultValue={q} maxLength={200} placeholder={label} aria-label={label} className="pl-9" />
		</form>
	);
}
