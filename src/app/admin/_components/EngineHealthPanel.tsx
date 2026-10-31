/**
 * Platform-wide search engine health: one row per engine with its setups (verified, pending,
 * failed), what it was sent in the range and how it answered, and what is waiting. Recent
 * integration errors sit under the table so a failing credential is one glance away.
 * Copy stays honest: GSC inspects and sends no URLs; the Indexing API is job/livestream only.
 */
import { Panel, Status, Table, Td, Th } from "@/components/ui";
import { statusLabel, timeAgo } from "@/components/app/ui";
import type { AdminOverview, EngineHealthRow } from "@/db/admin-queries";
import { formatCount, percent, statusTone } from "./format";

// GSC inspects URLs and sends none, so its send columns say so instead of reading as blank cells.
const notApplicable = <span className="text-muted">Not applicable</span>;

export function EngineHealthPanel({
	engines,
	errors,
	rangeDays,
}: {
	engines: EngineHealthRow[];
	errors: AdminOverview["engineErrors"];
	rangeDays: number;
}) {
	const failingSetups = engines.reduce((sum, row) => sum + row.failed + (row.googleAccounts?.failed ?? 0), 0);
	return (
		<Panel
			title="Search engines"
			description={`Setups across every site, and what each engine answered in the last ${rangeDays} days.`}
			action={
				failingSetups > 0 ? (
					<Status tone="danger">{`${formatCount(failingSetups)} failing ${failingSetups === 1 ? "setup" : "setups"}`}</Status>
				) : (
					<Status tone="success">No failing setups</Status>
				)
			}
			padded={false}
		>
			<Table caption="Search engine health">
				<thead>
					<tr>
						<Th className="pl-5">Engine</Th>
						<Th numeric>Verified</Th>
						<Th numeric>Pending</Th>
						<Th numeric>Failed</Th>
						<Th numeric>Sent ({rangeDays}d)</Th>
						<Th numeric>Accepted</Th>
						<Th numeric>Queued</Th>
						<Th numeric className="pr-5">
							Failed jobs ({rangeDays}d)
						</Th>
					</tr>
				</thead>
				<tbody>
					{engines.map((row) => {
						const accepted = percent(row.success, row.sent);
						const inspection = row.kind === "inspection";
						return (
							<tr key={row.engine}>
								<Td className="pl-5">
									<div className="font-medium text-ink">{row.label}</div>
									<div className="text-sm text-muted">
										{row.note}
										{row.googleAccounts
											? `. Google accounts: ${formatCount(row.googleAccounts.verified)} connected${row.googleAccounts.failed ? `, ${formatCount(row.googleAccounts.failed)} failed` : ""}`
											: ""}
									</div>
								</Td>
								<Td numeric>{formatCount(row.verified)}</Td>
								<Td numeric className="text-muted">
									{formatCount(row.pending)}
								</Td>
								<Td numeric className={row.failed > 0 ? "text-danger" : "text-muted"}>
									{formatCount(row.failed)}
								</Td>
								<Td numeric>{inspection ? <span className="text-muted">Not sent</span> : formatCount(row.sent)}</Td>
								<Td numeric>
									{inspection ? (
										notApplicable
									) : accepted === null ? (
										<span className="text-muted">None yet</span>
									) : accepted < 90 ? (
										<Status tone="warning">{`${accepted}%`}</Status>
									) : (
										`${accepted}%`
									)}
								</Td>
								<Td numeric>{inspection ? notApplicable : formatCount(row.queued)}</Td>
								<Td numeric className={`pr-5 ${!inspection && row.failedJobs > 0 ? "text-danger" : "text-muted"}`}>
									{inspection ? notApplicable : formatCount(row.failedJobs)}
								</Td>
							</tr>
						);
					})}
				</tbody>
			</Table>
			<div className="flex flex-col gap-3 p-5">
				<h3 className="font-display text-md font-medium">Recent setup errors</h3>
				{errors.length === 0 ? (
					<p className="text-sm text-muted">No engine setup reported an error in the last {rangeDays} days.</p>
				) : (
					<ul className="flex flex-col">
						{errors.map((row, index) => (
							<li key={`${row.provider}-${row.owner}-${index}`} className="grid gap-1 border-t border-border py-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:gap-4">
								<div className="min-w-0">
									<div className="truncate text-sm font-medium text-ink">{row.label}</div>
									<div className="truncate font-mono text-sm text-muted">{row.owner}</div>
								</div>
								<p className="min-w-0 text-sm text-ink-2">{row.message}</p>
								<div className="flex items-center gap-3 sm:justify-end">
									<Status tone={statusTone(row.status)}>{row.status === "verified" ? "Recovered" : statusLabel(row.status)}</Status>
									<span className="text-sm whitespace-nowrap text-muted">{timeAgo(row.at)}</span>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</Panel>
	);
}
