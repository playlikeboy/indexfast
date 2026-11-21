/**
 * Keywords section: research (paid DataForSEO data, metered in credits) and the site's saved
 * keyword list. When neither platform nor BYOK credentials exist, research is disabled with the
 * reason instead of showing placeholder numbers.
 */
import Link from "next/link";
import { removeSavedKeywordAction } from "@/app/actions";
import { ActionButton } from "@/components/app/client";
import { timeAgo } from "@/components/app/ui";
import { EmptyState, Panel, Table, Td, Th } from "@/components/ui";
import { KEYWORD_LANGUAGES, KEYWORD_LOCATIONS, estimateResearchCredits } from "@/lib/seo/keywords/service";
import { KeywordResearch } from "./KeywordResearch";
import { textLink } from "./shared";

export type SavedKeywordRow = {
	id: string;
	keyword: string;
	locationCode: number;
	searchVolume: number | null;
	keywordDifficulty: number | null;
	cpc: string | null;
	intent: string | null;
	metricsAt: Date | null;
};

export type KeywordsData = { saved: SavedKeywordRow[]; credits: { total: number; monthlyGrant: number }; dataAvailable: boolean; byok: boolean };

const LOCATION_NAMES = new Map<number, string>(KEYWORD_LOCATIONS.map((location) => [location.code, location.name]));

export function KeywordsSection({ siteId, data }: { siteId: string; data: KeywordsData }) {
	const estimates = Object.fromEntries([25, 50, 100, 200].map((limit) => [limit, estimateResearchCredits(limit)]));
	const disabledReason = !data.dataAvailable
		? "Keyword data is not enabled yet. Add your own DataForSEO login under Billing to use it now."
		: !data.byok && data.credits.total < estimates[25]
			? "No SEO data credits left this month. They reset on the 1st (UTC)."
			: null;

	return (
		<div className="flex flex-col gap-6">
			<Panel
				title="Keyword research"
				description={
					<>
						Search volume, difficulty, CPC and intent from DataForSEO.{" "}
						{data.byok ? (
							"Billed to your own DataForSEO account."
						) : (
							<>
								<span className="num">{data.credits.total.toLocaleString()}</span> of <span className="num">{data.credits.monthlyGrant.toLocaleString()}</span> credits left this month (
								<Link href="/dashboard/billing" className={textLink}>
									usage
								</Link>
								).
							</>
						)}
					</>
				}
			>
				<KeywordResearch siteId={siteId} locations={KEYWORD_LOCATIONS} languages={KEYWORD_LANGUAGES} estimates={estimates} disabledReason={disabledReason} />
			</Panel>

			<Panel title="Saved keywords" description="Your keyword list for this site. Metrics are from the day each keyword was saved." padded={false}>
				{data.saved.length === 0 ? (
					<EmptyState className="m-5" title="No saved keywords" description="Research a seed keyword above, tick the rows you want, and save them here." />
				) : (
					<div className="overflow-x-auto">
						<Table caption="Saved keywords">
							<thead>
								<tr>
									<Th className="w-full pl-5">Keyword</Th>
									<Th>Market</Th>
									<Th className="text-right">Volume</Th>
									<Th className="text-right">KD</Th>
									<Th className="text-right">CPC</Th>
									<Th>Saved</Th>
									<Th className="pr-5">
										<span className="visually-hidden">Actions</span>
									</Th>
								</tr>
							</thead>
							<tbody>
								{data.saved.map((row) => (
									<tr key={row.id}>
										<Td className="max-w-0 min-w-48 pl-5">
											<span className="block truncate" title={row.keyword}>
												{row.keyword}
											</span>
										</Td>
										<Td className="whitespace-nowrap text-muted">{LOCATION_NAMES.get(row.locationCode) ?? row.locationCode}</Td>
										<Td className="num text-right">{row.searchVolume?.toLocaleString() ?? "-"}</Td>
										<Td className="num text-right">{row.keywordDifficulty ?? "-"}</Td>
										<Td className="num text-right">{row.cpc ? Number(row.cpc).toFixed(2) : "-"}</Td>
										<Td className="whitespace-nowrap text-muted">{row.metricsAt ? timeAgo(row.metricsAt) : "-"}</Td>
										<Td className="pr-5 text-right">
											<ActionButton action={removeSavedKeywordAction.bind(null, siteId, row.id)} variant="ghost" showResult={false}>
												Remove
											</ActionButton>
										</Td>
									</tr>
								))}
							</tbody>
						</Table>
					</div>
				)}
			</Panel>
		</div>
	);
}
