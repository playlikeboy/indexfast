/**
 * Connect: everything that links IndexFast to something outside it. AI editors over MCP first
 * (agents are users), then search engine accounts (Google Search Console, Yandex Webmaster),
 * then the API keys and the plain REST examples.
 *
 * Honesty rules from PRODUCT.md apply to the copy: Search Console is for inspection and sitemap
 * submission, never a promise of indexing; the Google Indexing API is only for JobPosting and
 * livestream pages. The Google button is a plain link because OAuth needs a full-page redirect.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { disconnectGoogleAction, refreshGscPropertiesAction, removeEngineAction, revokeApiKeyAction, setEngineAutoSubmitAction } from "@/app/actions";
import { GoogleNotice, type GoogleNoticeData } from "@/app/dashboard/connect/GoogleNotice";
import { YandexTokenForm } from "@/app/dashboard/connect/YandexTokenForm";
import { ActionButton, CodeBlock } from "@/components/app/client";
import { McpSetup } from "@/components/app/McpSetup";
import { Code, EmptyState, PageHeader, tableInPanel, timeAgo } from "@/components/app/ui";
import { Panel, Status, Table, Td, Th, buttonClass, type StatusTone } from "@/components/ui";
import type { ConnectPageData } from "@/db/app-queries";
import { formatLimit } from "@/lib/platform/plans";

export type GoogleNotice = GoogleNoticeData | null;

const GOOGLE_ERRORS: Record<string, string> = {
	denied: "You cancelled Google's consent screen. Nothing was connected.",
	google_error: "Google returned an error. Try connecting again.",
	signed_out: "Your session ended during the Google sign-in. Sign in, then connect again.",
	invalid_state: "That Google sign-in link expired or was opened twice. Start again from this page.",
	missing_code: "Google did not return an authorization code. Try connecting again.",
	not_configured: "Google sign-in is not configured on this IndexFast server.",
	exchange_failed: "Google did not accept the authorization. Try connecting again.",
	missing_scope: "Search Console access was not granted. Connect again and leave Search Console ticked.",
	save_failed: "The Google connection could not be saved. Try connecting again.",
};

/** Turns the OAuth callback's ?google=&reason= into one message; unknown values show nothing. */
export function googleNoticeFrom(google?: string, reason?: string): GoogleNotice {
	if (google === "connected") return { ok: true, text: "Google Search Console connected. Your sites are matched to their properties; refresh them below if one is missing." };
	if (google === "error") return { ok: false, text: GOOGLE_ERRORS[reason ?? ""] ?? GOOGLE_ERRORS.google_error };
	return null;
}

function Capability({ on, children }: { on: boolean; children: ReactNode }) {
	return (
		<li>
			<Status tone={on ? "success" : "neutral"}>
				{children}
				{on ? "" : ": not granted"}
			</Status>
		</li>
	);
}

function GoogleSection({ google }: { google: ConnectPageData["google"] }) {
	const connectLink = (label: string) => (
		// Full-page navigation on purpose: the OAuth start route redirects to Google.
		<a href={google.connectUrl} className={buttonClass({ variant: "secondary" })}>
			{label}
		</a>
	);

	let status: { tone: StatusTone; label: string };
	let body: ReactNode;
	let actions: ReactNode = null;

	if (!google.configured) {
		status = { tone: "neutral", label: "Not available" };
		body = <p className="text-sm text-muted">Google sign-in is not configured on this IndexFast server, so Search Console cannot be connected yet.</p>;
	} else if (google.connected) {
		status = { tone: "success", label: "Connected" };
		body = (
			<div className="flex flex-col gap-3 text-sm">
				<p className="text-muted">{google.connectedAt ? `Connected ${timeAgo(google.connectedAt)}. ` : ""}Each site is matched to its sc-domain: or URL-prefix property for URL inspection and sitemap submission.</p>
				<ul className="flex flex-col gap-1">
					<Capability on={google.canInspect}>URL inspection and sitemap submission</Capability>
					<Capability on={google.canUseIndexingApi}>Google Indexing API, job posting and livestream pages only</Capability>
				</ul>
			</div>
		);
		actions = (
			<>
				<ActionButton action={refreshGscPropertiesAction} pendingLabel="Matching properties...">
					Refresh properties
				</ActionButton>
				<ActionButton action={disconnectGoogleAction} variant="danger" pendingLabel="Disconnecting..." confirm="Disconnect Google? URL inspection, Search Console sitemap submission and the Indexing API stop for every site.">
					Disconnect
				</ActionButton>
			</>
		);
	} else if (google.status === "failed") {
		status = { tone: "danger", label: "Connection failed" };
		body = <p className="text-sm text-muted">{google.lastErrorMessage ?? "Google stopped accepting the saved authorization."} Reconnect to restore inspection.</p>;
		actions = connectLink("Reconnect Google");
	} else {
		status = { tone: "neutral", label: "Not connected" };
		body = (
			<p className="text-sm text-muted">
				Connect the Google account that owns your Search Console properties. IndexFast reads coverage for your URLs and submits your sitemaps. It does not make Google index a page.
			</p>
		);
		actions = connectLink("Connect Google");
	}

	return (
		<div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
			<div className="min-w-0 max-w-[65ch]">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<h3 className="text-md">Google Search Console</h3>
					<Status tone={status.tone}>{status.label}</Status>
				</div>
				<div className="mt-2">{body}</div>
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
		</div>
	);
}

const yandexStatus: Record<string, { tone: StatusTone; label: string }> = {
	verified: { tone: "success", label: "Connected" },
	failed: { tone: "danger", label: "Failed" },
	pending: { tone: "warning", label: "Pending" },
	not_connected: { tone: "neutral", label: "Not connected" },
};

function YandexSection({ yandex, available }: { yandex: ConnectPageData["yandex"]; available: boolean }) {
	const connected = yandex.sites.filter((site) => site.status !== "not_connected");
	return (
		<div className="flex flex-col gap-4 px-5 py-5">
			<div className="max-w-[65ch]">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<h3 className="text-md">Yandex Webmaster</h3>
					<Status tone={yandex.tokenSaved ? "success" : "neutral"}>{yandex.tokenSaved ? "Token saved" : "Not connected"}</Status>
				</div>
				<p className="mt-2 text-sm text-muted">
					Adds URLs to the Yandex recrawl queue, within the daily quota Yandex reports. Create an OAuth token for the Yandex Webmaster API and save it against a site you verified there.
				</p>
			</div>

			{!available ? (
				<p className="text-sm">
					Yandex submission is part of the paid plans.{" "}
					<Link href="/dashboard/billing" className="font-medium underline hover:text-signal">
						See plans
					</Link>
				</p>
			) : yandex.sites.length === 0 ? (
				<p className="text-sm text-muted">
					<Link href="/dashboard" className="font-medium text-ink underline hover:text-signal">
						Add a website
					</Link>{" "}
					first, then connect it to Yandex here.
				</p>
			) : (
				<YandexTokenForm sites={yandex.sites.map(({ siteId, host }) => ({ siteId, host }))} />
			)}

			{connected.length > 0 ? (
				// Zero edge padding: this table sits inside the section's px-5, so its first column lines up with the heading.
				<Table caption="Sites connected to Yandex" className="[&_td:first-child]:pl-0 [&_th:first-child]:pl-0 [&_td:last-child]:pr-0 [&_th:last-child]:pr-0">
					<thead>
						<tr>
							<Th>Site</Th>
							<Th>Status</Th>
							<Th>Auto-submit</Th>
							<Th>
								<span className="sr-only">Actions</span>
							</Th>
						</tr>
					</thead>
					<tbody>
						{connected.map((site) => {
							const state = yandexStatus[site.status] ?? yandexStatus.not_connected;
							return (
								<tr key={site.siteId}>
									<Td className="font-mono text-sm break-all">{site.host}</Td>
									<Td>
										<Status tone={state.tone}>{state.label}</Status>
										{site.lastError ? <p className="mt-1 max-w-[50ch] text-sm text-muted">{site.lastError}</p> : null}
									</Td>
									<Td className="text-muted">{site.autoSubmit ? "On" : "Off"}</Td>
									<Td>
										<div className="flex justify-end gap-1">
											{/* Without the plan the server refuses the toggle, so only Disconnect stays. */}
											{available ? (
												<ActionButton action={setEngineAutoSubmitAction.bind(null, site.siteId, "yandex", !site.autoSubmit)} variant="ghost" pendingLabel="Saving...">
													{site.autoSubmit ? "Turn off" : "Turn on"}
													<span className="sr-only"> auto-submit for {site.host}</span>
												</ActionButton>
											) : null}
											<ActionButton action={removeEngineAction.bind(null, site.siteId, "yandex")} variant="ghost" pendingLabel="Removing..." confirm={`Disconnect Yandex for ${site.host}? Queued Yandex submissions for it stop.`}>
												Disconnect
												<span className="sr-only"> Yandex for {site.host}</span>
											</ActionButton>
										</div>
									</Td>
								</tr>
							);
						})}
					</tbody>
				</Table>
			) : null}
		</div>
	);
}

function KeysPanel({ data }: { data: ConnectPageData }) {
	const { keys, usage, entitlement } = data;
	return (
		<Panel
			padded={false}
			className="mb-6"
			title="API keys"
			description={`${usage.toLocaleString()} of ${formatLimit(entitlement.limits.monthlyApiRequests)} requests this month, ${keys.length} of ${formatLimit(entitlement.limits.apiKeys)} keys`}
		>
			{keys.length === 0 ? (
				<EmptyState title="No keys yet">Create one above. MCP clients, the CLI and the REST API all use the same key.</EmptyState>
			) : (
				<Table caption="API keys" className={tableInPanel}>
					<thead>
						<tr>
							<Th>Name</Th>
							<Th>Key</Th>
							<Th>Created</Th>
							<Th>Last used</Th>
							<Th>
								<span className="sr-only">Actions</span>
							</Th>
						</tr>
					</thead>
					<tbody>
						{keys.map((key) => (
							<tr key={key.id}>
								<Td className="font-medium">{key.name}</Td>
								<Td className="font-mono text-sm whitespace-nowrap text-muted">{key.masked}</Td>
								<Td className="whitespace-nowrap text-muted">{timeAgo(key.createdAt)}</Td>
								<Td className="whitespace-nowrap text-muted">{timeAgo(key.lastUsedAt)}</Td>
								<Td className="text-right">
									<ActionButton action={revokeApiKeyAction.bind(null, key.id)} variant="ghost" pendingLabel="Revoking..." confirm={`Revoke "${key.name}"? Tools using it stop working.`}>
										Revoke
										<span className="sr-only"> {key.name}</span>
									</ActionButton>
								</Td>
							</tr>
						))}
					</tbody>
				</Table>
			)}
		</Panel>
	);
}

/** Pure view for Connect. */
export function ConnectView({ data, googleNotice = null }: { data: ConnectPageData; googleNotice?: GoogleNotice }) {
	const { exampleDomain, google, yandex, entitlement } = data;
	const domain = exampleDomain ?? "example.com";
	// A stale "connected" (opened from history after a disconnect) must not contradict the section below.
	const notice = googleNotice && (!googleNotice.ok || google.connected) ? googleNotice : null;

	return (
		<>
			<PageHeader title="Connect" description="Let Claude Code, Cursor, VS Code or Windsurf run indexing for you, and link the search engine accounts IndexFast reports to." />

			{notice ? <GoogleNotice notice={notice} /> : null}

			<Panel className="mb-6" title="AI editors (MCP)" description="Available on every plan. Only tool calls count toward your monthly requests.">
				<McpSetup exampleDomain={exampleDomain} />
			</Panel>

			<Panel padded={false} className="mb-6" title="Search engine accounts" description="Optional. IndexNow works without any of these.">
				<GoogleSection google={google} />
				<YandexSection yandex={yandex} available={entitlement.limits.yandex} />
			</Panel>

			<KeysPanel data={data} />

			<Panel title="REST API" description="Same key, plain HTTP. Every site parameter accepts the site id or the domain.">
				<div className="flex flex-col gap-3">
					<CodeBlock
						label="curl"
						code={`curl -X POST https://indexfast.co/api/v1/sites \\\n  -H "Authorization: Bearer $INDEXFAST_KEY" -H "Content-Type: application/json" \\\n  -d '{"domain":"${domain}"}'\n\ncurl -X POST https://indexfast.co/api/v1/sites/${domain}/submissions \\\n  -H "Authorization: Bearer $INDEXFAST_KEY" -H "Content-Type: application/json" \\\n  -d '{"urls":["https://${domain}/new-page"]}'`}
					/>
					<p className="text-sm text-muted">
						Endpoints: <Code>/api/v1/sites</Code>, <Code>/sites/:site/verify</Code>, <Code>/sitemaps</Code>, <Code>/urls?filter=new</Code>, <Code>/submissions</Code>, <Code>/diagnostics</Code>,{" "}
						<Code>/engines</Code>, <Code>/inspect</Code>, <Code>/gsc</Code>, <Code>/yandex</Code>.
					</p>
				</div>
			</Panel>
		</>
	);
}
