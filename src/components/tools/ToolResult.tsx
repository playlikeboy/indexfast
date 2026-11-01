"use client";

/*
 * What each free tool answered, shown as the tool's own material: status as text with one icon,
 * figures the tool computed, machine values in mono, files on graphite with a working copy key.
 * One branch per tool type, so a new tool without a branch is a type error, not a blank panel.
 * Copy JSON hands back the exact action result for agents and scripts.
 */
import { useState, type ReactNode, type RefObject } from "react";
import { Download, ExternalLink } from "lucide-react";
import { toCsv } from "@/lib/csv";
import { Button, CodeBlock, Stat, Status, Table, Td, Th, buttonClass, type StatusTone } from "@/components/ui";
import type {
	checkAiCrawlerTool,
	checkBulkIndexTool,
	checkCanonicalTool,
	checkGoogleIndexTool,
	checkHttpStatusTool,
	checkNoindexTagTool,
	checkRobotsTxtTool,
	extractSitemapUrlsTool,
	generateIndexNowKeyTool,
	generateLlmsTxtTool,
	submitIndexNowTool,
} from "@/app/tools/tool-actions";

export type ToolType =
	| "http-status-checker"
	| "noindex-tag-checker"
	| "canonical-checker"
	| "google-index-checker"
	| "indexnow-key-generator"
	| "robots-txt-checker"
	| "ai-crawler-checker"
	| "sitemap-url-extractor"
	| "llms-txt-generator"
	| "bing-indexnow-submitter"
	| "bulk-index-checker";

type Out<F extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<F>>;
type Ok<F extends (...args: never[]) => Promise<unknown>> = Extract<Out<F>, { success: true }>;

export type ToolOutput =
	| Out<typeof generateIndexNowKeyTool>
	| Out<typeof generateLlmsTxtTool>
	| Out<typeof checkHttpStatusTool>
	| Out<typeof checkRobotsTxtTool>
	| Out<typeof checkNoindexTagTool>
	| Out<typeof checkCanonicalTool>
	| Out<typeof checkAiCrawlerTool>
	| Out<typeof extractSitemapUrlsTool>
	| Out<typeof submitIndexNowTool>
	| Out<typeof checkGoogleIndexTool>
	| Out<typeof checkBulkIndexTool>;

const COPY_RESET_MS = 2000;

function httpTone(status: number): StatusTone {
	if (status >= 200 && status < 300) return "success";
	if (status >= 300 && status < 400) return "warning";
	return "danger";
}

/* Label and value rows; values that are machine strings set `mono`. */
function Facts({ rows }: { rows: Array<{ label: string; value: ReactNode; mono?: boolean }> }) {
	return (
		<dl className="divide-y divide-border border-y border-border text-sm">
			{rows.map((row) => (
				<div key={row.label} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:gap-4">
					<dt className="text-muted">{row.label}</dt>
					<dd className={row.mono ? "min-w-0 font-mono break-all text-ink" : "min-w-0 break-words text-ink"}>{row.value}</dd>
				</div>
			))}
		</dl>
	);
}

function Blockers({ items }: { items: string[] }) {
	if (items.length === 0) return <Status tone="success">No blockers found</Status>;
	return (
		<ul className="space-y-2">
			{items.map((b) => (
				<li key={b} className="flex items-start gap-2 text-sm text-danger">
					<Status tone="danger" className="whitespace-normal">
						{b}
					</Status>
				</li>
			))}
		</ul>
	);
}

function ExternalLinkText({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="font-mono break-all underline decoration-border-strong hover:decoration-signal"
		>
			{children}
		</a>
	);
}

function KeyResult({ r }: { r: Ok<typeof generateIndexNowKeyTool> }) {
	return (
		<div className="space-y-6">
			<CodeBlock title={r.fileName} code={r.key} />
			<Facts
				rows={[
					{ label: "Host", value: r.host, mono: true },
					{
						label: "Key file URL",
						value: <ExternalLinkText href={r.keyLocation}>{r.keyLocation}</ExternalLinkText>,
					},
				]}
			/>
			<ol className="list-decimal space-y-2 pl-6 text-sm text-ink-2">
				<li>
					Create a file named <code className="font-mono text-ink">{r.fileName}</code> containing only the key.
				</li>
				<li>Upload it to the root of your domain so it serves at the key file URL above.</li>
				<li>Submit changed URLs through IndexNow or the IndexFast dashboard.</li>
			</ol>
		</div>
	);
}

function HttpResult({ r }: { r: Ok<typeof checkHttpStatusTool> }) {
	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end gap-x-6 gap-y-2">
				<p className="num font-display text-display-s leading-none font-semibold">{r.status}</p>
				<Status tone={httpTone(r.status)}>HTTP {r.status}</Status>
			</div>
			<Facts
				rows={[
					{ label: "Final URL", value: r.finalUrl, mono: true },
					{ label: "Redirected", value: r.isRedirect ? "Yes" : "No" },
					{
						label: "Response time",
						value: <span className="num">{r.durationMs} ms</span>,
					},
				]}
			/>
			{Object.keys(r.headers).length > 0 ? (
				<Table caption="Response headers">
					<thead>
						<tr>
							<Th>Header</Th>
							<Th>Value</Th>
						</tr>
					</thead>
					<tbody>
						{Object.entries(r.headers).map(([k, v]) => (
							<tr key={k}>
								<Td className="font-mono whitespace-nowrap text-muted">{k}</Td>
								<Td className="font-mono break-all">{v}</Td>
							</tr>
						))}
					</tbody>
				</Table>
			) : null}
		</div>
	);
}

function RobotsResult({ r }: { r: Ok<typeof checkRobotsTxtTool> }) {
	return (
		<div className="space-y-6">
			<Status tone={r.exists ? "success" : "info"} className="whitespace-normal">
				{r.message}
			</Status>
			{r.exists ? (
				<div className="grid grid-cols-3 gap-4">
					<Stat label="Disallow rules" value={r.disallowCount} />
					<Stat label="Allow rules" value={r.allowCount} />
					<Stat label="Sitemaps" value={r.sitemaps.length} />
				</div>
			) : null}
			{r.sitemaps.length > 0 ? (
				<ul className="space-y-1 text-sm">
					{r.sitemaps.map((s) => (
						<li key={s}>
							<ExternalLinkText href={s}>{s}</ExternalLinkText>
						</li>
					))}
				</ul>
			) : null}
			{r.exists ? <CodeBlock title="robots.txt" code={r.content} className="[&_pre]:max-h-80" /> : null}
		</div>
	);
}

function PageDiagnosticsResult({
	r,
}: {
	r: Ok<typeof checkNoindexTagTool> | Ok<typeof checkCanonicalTool> | Ok<typeof checkGoogleIndexTool>;
}) {
	const rows: Array<{ label: string; value: ReactNode; mono?: boolean }> = [
		{
			label: "Status",
			value: r.httpStatus ? <Status tone={httpTone(r.httpStatus)}>HTTP {r.httpStatus}</Status> : <Status tone="danger">No response</Status>,
		},
	];
	if ("noindex" in r) {
		rows.push({
			label: "Noindex",
			value: r.noindex ? <Status tone="danger">Blocked by {r.noindexSource}</Status> : <Status tone="success">None, indexable</Status>,
		});
	}
	if ("robotsBlocked" in r) {
		rows.push({
			label: "robots.txt",
			value: r.robotsBlocked ? <Status tone="danger">Disallows Googlebot</Status> : <Status tone="success">Allows crawling</Status>,
		});
	}
	if ("canonical" in r) {
		rows.push({
			label: "Canonical",
			value: r.canonical || "No canonical specified",
			mono: Boolean(r.canonical),
		});
		rows.push({
			label: "Matches URL",
			value: r.isCanonicalMatch ? <Status tone="success">Yes</Status> : <Status tone="warning">No</Status>,
		});
	}
	rows.push({ label: "Blockers", value: <Blockers items={r.blockers} /> });

	return (
		<div className="space-y-6">
			<Facts rows={rows} />
			{"gscInspectUrl" in r ? (
				<div className="space-y-4 rounded-(--radius-card) bg-well p-6">
					<p className="text-sm text-ink-2">{r.truthNote}</p>
					<a href={r.gscInspectUrl} target="_blank" rel="noreferrer" className={buttonClass({ size: "md" })}>
						Inspect in Search Console
						<ExternalLink aria-hidden="true" className="size-4" />
					</a>
				</div>
			) : null}
		</div>
	);
}

const RULE_SOURCE: Record<string, string> = {
	bot_group: "Its own group",
	wildcard_group: "The * group",
	no_matching_group: "No group applies",
	no_robots_txt: "No robots.txt",
};

function AiCrawlerResult({ r }: { r: Ok<typeof checkAiCrawlerTool> }) {
	return (
		<div className="space-y-4">
			{!r.robotsFound ? (
				<Status tone="info" className="whitespace-normal">
					{r.host} has no robots.txt, so every crawler may fetch it.
				</Status>
			) : null}
			<Table caption="AI crawler access to the site root">
				<thead>
					<tr>
						<Th>Crawler</Th>
						<Th>Owner</Th>
						<Th>Decided by</Th>
						<Th>Site root</Th>
					</tr>
				</thead>
				<tbody>
					{r.bots.map((bot) => (
						<tr key={bot.name}>
							<Td className="font-mono">{bot.name}</Td>
							<Td className="text-ink-2">{bot.owner}</Td>
							<Td className="text-ink-2">{RULE_SOURCE[bot.ruleSource] ?? bot.ruleSource}</Td>
							<Td>{bot.allowed ? <Status tone="success">Allowed</Status> : <Status tone="danger">Blocked</Status>}</Td>
						</tr>
					))}
				</tbody>
			</Table>
		</div>
	);
}

function SitemapResult({ r }: { r: Ok<typeof extractSitemapUrlsTool> }) {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-4">
				<Stat label="Page URLs" value={r.urlCount} hint={r.urlCount > r.urls.length ? `First ${r.urls.length} listed` : undefined} />
				<Stat label="Child sitemaps" value={r.childSitemaps.length} />
			</div>
			{r.childSitemaps.length > 0 ? (
				<div className="space-y-2">
					<h3 className="text-md">Child sitemaps</h3>
					<ul className="space-y-1 text-sm">
						{r.childSitemaps.map((s) => (
							<li key={s}>
								<ExternalLinkText href={s}>{s}</ExternalLinkText>
							</li>
						))}
					</ul>
				</div>
			) : null}
			{r.urls.length > 0 ? (
				<Table caption="Page URLs in the sitemap" className="max-h-96 overflow-y-auto">
					<thead>
						<tr>
							<Th>URL</Th>
							<Th>Last modified</Th>
						</tr>
					</thead>
					<tbody>
						{r.urls.map((u) => (
							<tr key={u.loc}>
								<Td className="font-mono break-all">{u.loc}</Td>
								<Td className="num whitespace-nowrap text-ink-2">{u.lastmod ? u.lastmod.slice(0, 10) : "Not set"}</Td>
							</tr>
						))}
					</tbody>
				</Table>
			) : null}
		</div>
	);
}

const BULK_TONE: Record<string, StatusTone> = {
	pass: "success",
	warn: "warning",
	fail: "danger",
	skipped: "info",
};
const BULK_LABEL: Record<string, string> = {
	pass: "Pass",
	warn: "Warn",
	fail: "Fail",
	skipped: "Not checked",
};

function downloadBulkCsv(r: Ok<typeof checkBulkIndexTool>) {
	const csv = toCsv(
		["url", "result", "http_status", "noindex", "canonical_match", "blockers"],
		r.results.map((row) => [row.url, BULK_LABEL[row.status], row.httpStatus || "", row.noindex, row.canonicalMatch, row.blockers.join("; ")]),
	);
	const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
	const link = document.createElement("a");
	link.href = href;
	link.download = `indexfast-bulk-check-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(href);
}

function BulkResult({ r }: { r: Ok<typeof checkBulkIndexTool> }) {
	return (
		<div className="space-y-6">
			<div className="flex justify-end">
				<Button size="sm" variant="secondary" onClick={() => downloadBulkCsv(r)}>
					<Download aria-hidden="true" className="size-4" />
					Download CSV
				</Button>
			</div>
			<div className={r.skipped > 0 ? "grid grid-cols-2 gap-4 sm:grid-cols-4" : "grid grid-cols-3 gap-4"}>
				<Stat label="Pass" value={r.passed} />
				<Stat label="Warn" value={r.warned} />
				<Stat label="Fail" value={r.failed} />
				{/* Unchecked URLs are not broken pages, so they get their own count, never Fail's. */}
				{r.skipped > 0 ? <Stat label="Not checked" value={r.skipped} /> : null}
			</div>
			<Table caption="Bulk check results">
				<thead>
					<tr>
						<Th>URL</Th>
						<Th>Result</Th>
						<Th numeric>HTTP</Th>
						<Th>Blockers</Th>
					</tr>
				</thead>
				<tbody>
					{r.results.map((row) => (
						<tr key={row.url}>
							<Td className="font-mono break-all">{row.url}</Td>
							<Td>
								<Status tone={BULK_TONE[row.status]}>{BULK_LABEL[row.status]}</Status>
							</Td>
							<Td numeric>{row.httpStatus || "None"}</Td>
							<Td className="text-ink-2">{row.blockers.length > 0 ? row.blockers.join("; ") : "None"}</Td>
						</tr>
					))}
				</tbody>
			</Table>
		</div>
	);
}

function SubmitResult({ r }: { r: Ok<typeof submitIndexNowTool> }) {
	return (
		<div className="space-y-6">
			<Status tone="success" className="whitespace-normal">
				{r.message}
			</Status>
			<Facts
				rows={[
					{
						label: "IndexNow answer",
						value: <span className="num">HTTP {r.status}</span>,
					},
					{
						label: "URLs sent",
						value: <span className="num">{r.submittedCount}</span>,
					},
					{ label: "Key file", value: r.keyLocation, mono: true },
				]}
			/>
			<ul className="max-h-60 space-y-1 overflow-y-auto font-mono text-sm break-all text-ink-2">
				{r.urls.map((u) => (
					<li key={u}>{u}</li>
				))}
			</ul>
		</div>
	);
}

function ResultBody({ toolType, result }: { toolType: ToolType; result: ToolOutput }) {
	switch (toolType) {
		case "indexnow-key-generator":
			return <KeyResult r={result as Ok<typeof generateIndexNowKeyTool>} />;
		case "llms-txt-generator":
			return <CodeBlock title="llms.txt" code={(result as Ok<typeof generateLlmsTxtTool>).llmsTxt} />;
		case "http-status-checker":
			return <HttpResult r={result as Ok<typeof checkHttpStatusTool>} />;
		case "robots-txt-checker":
			return <RobotsResult r={result as Ok<typeof checkRobotsTxtTool>} />;
		case "noindex-tag-checker":
		case "canonical-checker":
		case "google-index-checker":
			return <PageDiagnosticsResult r={result as Ok<typeof checkNoindexTagTool>} />;
		case "ai-crawler-checker":
			return <AiCrawlerResult r={result as Ok<typeof checkAiCrawlerTool>} />;
		case "sitemap-url-extractor":
			return <SitemapResult r={result as Ok<typeof extractSitemapUrlsTool>} />;
		case "bulk-index-checker":
			return <BulkResult r={result as Ok<typeof checkBulkIndexTool>} />;
		case "bing-indexnow-submitter":
			return <SubmitResult r={result as Ok<typeof submitIndexNowTool>} />;
		default: {
			const unreachable: never = toolType;
			return unreachable;
		}
	}
}

export function ToolResult({
	toolType,
	result,
	headingRef,
}: {
	toolType: ToolType;
	result: ToolOutput;
	headingRef: RefObject<HTMLHeadingElement | null>;
}) {
	const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
			setCopy("copied");
		} catch {
			// Clipboard can be blocked; say so rather than pretend it worked.
			setCopy("failed");
		}
		setTimeout(() => setCopy("idle"), COPY_RESET_MS);
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 ref={headingRef} tabIndex={-1} className="text-title">
					Result
				</h2>
				<Button size="sm" variant="ghost" onClick={handleCopy}>
					<span aria-live="polite">{copy === "copied" ? "Copied" : copy === "failed" ? "Copy failed" : "Copy JSON"}</span>
				</Button>
			</div>
			<ResultBody toolType={toolType} result={result} />
		</div>
	);
}
