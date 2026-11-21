/**
 * SEO data credits on the Billing page: this month's balance, the usage ledger (one line per
 * paid call, so a customer can see what spent credits), and the bring-your-own DataForSEO key
 * form. The platform's own provider credentials are never shown; a saved BYOK login is masked.
 */
import { removeDataforseoKeyAction, saveDataforseoKeyAction } from "@/app/actions";
import { ActionButton, ActionForm } from "@/components/app/client";
import { formatDate, tableInPanel } from "@/components/app/ui";
import { Input, Panel, Status, Table, Td, Th } from "@/components/ui";

export type SeoCreditsData = {
	monthlyGrant: number;
	monthlyRemaining: number;
	purchasedRemaining: number;
	totalRemaining: number;
	byok: { label: string | null } | null;
	ledger: Array<{ id: string; at: Date; kind: string; feature: string | null; credits: number; byok: boolean; metadata: unknown }>;
};

const FEATURE_LABELS: Record<string, string> = { keyword_research: "Keyword research" };
const KIND_LABELS: Record<string, string> = { grant: "Monthly grant", reserve: "In progress", settle: "Charged", release: "Refunded", purchase: "Purchased", adjust: "Adjustment" };

function describe(row: SeoCreditsData["ledger"][number]) {
	const meta = (row.metadata ?? {}) as { keyword?: string; period?: string };
	if (row.kind === "grant") return `Credits for ${meta.period ?? "this month"}`;
	const label = FEATURE_LABELS[row.feature ?? ""] ?? row.feature ?? "Usage";
	return meta.keyword ? `${label}: "${meta.keyword}"` : label;
}

export function SeoCreditsPanel({ data }: { data: SeoCreditsData }) {
	return (
		<>
			<Panel className="mb-8" title="SEO data credits" description="Keyword research and other paid search data use credits. They reset on the 1st (UTC); cached results are free.">
				<div className="flex flex-wrap items-end gap-x-10 gap-y-4">
					<div>
						<p className="text-sm text-muted">Left this month</p>
						<p className="mt-1 font-display text-xl font-semibold">
							<span className="num">{data.totalRemaining.toLocaleString()}</span>
							<span className="text-base font-normal text-muted"> / {data.monthlyGrant.toLocaleString()}</span>
						</p>
					</div>
					{data.purchasedRemaining > 0 ? (
						<div>
							<p className="text-sm text-muted">Purchased (never expire)</p>
							<p className="num mt-1 font-display text-xl font-semibold">{data.purchasedRemaining.toLocaleString()}</p>
						</div>
					) : null}
					{data.byok ? <Status tone="success">Using your DataForSEO account ({data.byok.label})</Status> : null}
				</div>
			</Panel>

			<Panel className="mb-8" title="Your own DataForSEO account" description="Optional. With your own API login, research is billed by DataForSEO to you and uses 0 IndexFast credits. Stored encrypted.">
				{data.byok ? (
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="text-sm">
							Connected as <span className="font-mono">{data.byok.label}</span>.
						</p>
						<ActionButton action={removeDataforseoKeyAction} variant="ghost" confirm="Remove your DataForSEO login? Research will use IndexFast credits again.">
							Remove
						</ActionButton>
					</div>
				) : (
					<ActionForm action={saveDataforseoKeyAction} submitLabel="Check and save" variant="secondary" inline>
						<Input name="login" required autoComplete="off" spellCheck={false} placeholder="API login (email)" aria-label="DataForSEO API login" className="min-w-0 flex-1" />
						<Input name="password" type="password" required autoComplete="off" placeholder="API password" aria-label="DataForSEO API password" className="min-w-0 flex-1" />
					</ActionForm>
				)}
			</Panel>

			<Panel padded={false} className="mb-8" title="Credit usage">
				{data.ledger.length === 0 ? (
					<p className="p-5 text-sm text-muted">No usage yet.</p>
				) : (
					<div className={tableInPanel}>
						<Table caption="Credit usage">
							<thead>
								<tr>
									<Th className="pl-5">Date</Th>
									<Th className="w-full">What</Th>
									<Th>State</Th>
									<Th className="pr-5 text-right">Credits</Th>
								</tr>
							</thead>
							<tbody>
								{data.ledger.map((row) => (
									<tr key={row.id}>
										<Td className="pl-5 whitespace-nowrap text-muted">{formatDate(row.at)}</Td>
										<Td className="max-w-0 min-w-48">
											<span className="block truncate">{describe(row)}</span>
										</Td>
										<Td className="whitespace-nowrap">{row.byok ? "Your account" : (KIND_LABELS[row.kind] ?? row.kind)}</Td>
										<Td className="num pr-5 text-right">{row.credits > 0 ? `+${row.credits.toLocaleString()}` : row.credits.toLocaleString()}</Td>
									</tr>
								))}
							</tbody>
						</Table>
					</div>
				)}
			</Panel>
		</>
	);
}
