/**
 * Status tone for Google's own coverage text (urls.gscStatus). It reads the text itself, never
 * urls.indexingStatus, because our diagnostics "Check" also writes indexingStatus and would
 * otherwise recolour Google's verdict. Kept pure so the mapping is unit tested.
 */
import type { StatusTone } from "@/components/ui";

export function googleTone(coverage: string): StatusTone {
	// "Indexed, though blocked by robots.txt" is still indexed, so the indexed check runs first.
	if (/^(submitted and )?indexed/i.test(coverage)) return "success";
	if (/blocked|error|noindex|404/i.test(coverage)) return "danger";
	if (/not indexed|excluded|discovered|crawled/i.test(coverage)) return "warning";
	return "neutral";
}
