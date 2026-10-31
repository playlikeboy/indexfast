/**
 * Hourly cron log. The first question an operator asks is "is automation running", so the
 * header answers it: last run state, and an overdue warning when no run started in two
 * ticks. A row stuck "running" past the stale limit reads as timed out, never as healthy.
 */
import { EmptyState, Panel, Status, Table, Td, Th } from "@/components/ui";
import { timeAgo } from "@/components/app/ui";
import type { AdminCronRun } from "@/db/admin-queries";
import { cronStateView, formatCount, formatDuration } from "./format";

type CronSummary = {
	sitesDue?: number;
	sitesSynced?: number;
	syncFailures?: number;
	newUrls?: number;
	downgraded?: number | null;
	durationMs?: number;
	queue?: { successCount?: number; failedCount?: number; throttledCount?: number } | null;
	gscInspection?: { inspected?: number; failed?: number; quotaStops?: number } | null;
};

export function CronRunsPanel({ runs, overdue }: { runs: AdminCronRun[]; overdue: boolean }) {
	const last = runs[0];
	const lastView = last ? cronStateView[last.state] : null;
	return (
		<Panel
			title="Cron runs"
			description={last ? `Hourly automation. Last run started ${timeAgo(last.startedAt)}.` : "Hourly automation. No run recorded yet."}
			action={
				<>
					{overdue ? <Status tone="warning">{last ? "Overdue" : "Never ran"}</Status> : null}
					{lastView ? <Status tone={lastView.tone}>{`Last run ${lastView.label.toLowerCase()}`}</Status> : null}
				</>
			}
			padded={false}
		>
			{runs.length === 0 ? (
				<EmptyState
					className="m-5"
					title="Waiting for the first hourly run"
					description="Runs appear here once the Worker's scheduled handler fires. Check the cron trigger and the DATABASE_URL secret if this stays empty."
				/>
			) : (
				<Table caption="Recent cron runs">
					<thead>
						<tr>
							<Th className="pl-5">Status</Th>
							<Th>Started</Th>
							<Th numeric>Duration</Th>
							<Th numeric>Sites synced</Th>
							<Th numeric>New URLs</Th>
							<Th numeric>Sent</Th>
							<Th numeric>Failed</Th>
							<Th numeric>GSC inspected</Th>
							<Th className="pr-5">Notes</Th>
						</tr>
					</thead>
					<tbody>
						{runs.map((run) => {
							const view = cronStateView[run.state];
							const summary = (run.summary ?? {}) as CronSummary;
							const duration = run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : summary.durationMs;
							const note =
								run.errorMessage ??
								(run.state === "timed_out" ? "Stopped before it finished; claimed jobs are recovered by the next run." : null) ??
								(summary.downgraded ? `${formatCount(summary.downgraded)} plans expired` : "No errors");
							return (
								<tr key={run.id}>
									<Td className="pl-5">
										<Status tone={view.tone}>{view.label}</Status>
									</Td>
									<Td className="whitespace-nowrap text-muted" title={run.startedAt.toISOString()}>
										{timeAgo(run.startedAt)}
									</Td>
									<Td numeric>{run.state === "running" ? "In progress" : formatDuration(duration)}</Td>
									<Td numeric>
										{formatCount(summary.sitesSynced ?? 0)}
										{summary.sitesDue ? <span className="text-muted"> of {formatCount(summary.sitesDue)}</span> : null}
									</Td>
									<Td numeric>{formatCount(summary.newUrls ?? 0)}</Td>
									<Td numeric>{formatCount(summary.queue?.successCount ?? 0)}</Td>
									<Td numeric className={(summary.queue?.failedCount ?? 0) > 0 ? "text-danger" : undefined}>
										{formatCount(summary.queue?.failedCount ?? 0)}
									</Td>
									<Td numeric>{formatCount(summary.gscInspection?.inspected ?? 0)}</Td>
									<Td className="max-w-80 pr-5">
										<span className={`line-clamp-2 ${run.errorMessage ? "text-danger" : "text-muted"}`} title={run.errorMessage ?? undefined}>
											{note}
										</span>
									</Td>
								</tr>
							);
						})}
					</tbody>
				</Table>
			)}
		</Panel>
	);
}
