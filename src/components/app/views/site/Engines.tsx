/**
 * Per-site settings for the optional engines: Google Search Console (inspection, read-only),
 * the gated Google Indexing API, Yandex recrawl and Baidu push. Status and limits come from
 * getSitePage().engines so the dashboard shows exactly what agents see through list_engines.
 * Copy rules: Search Console reads Google's verdict and never forces indexing; the Indexing API
 * is only for JobPosting and livestream pages, and every other page is skipped.
 * Paused sites and plans that dropped an engine keep only the off and disconnect paths, because
 * the backend refuses every send and setup path for them but still lets the owner clean up.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { refreshGscPropertiesAction, removeEngineAction, saveBaiduTokenAction, saveYandexTokenAction, setEngineAutoSubmitAction, type ActionResult } from "@/app/actions";
import { ActionButton, ActionForm } from "@/components/app/client";
import { timeAgo } from "@/components/app/ui";
import { Field, Input, Panel, Status, buttonClass } from "@/components/ui";
import type { SitePageData } from "@/db/app-queries";
import type { PlanLimits } from "@/lib/platform/plans";
import { Checkbox, ErrorNote, PausedNote, UpgradeNote, engineStatus } from "./shared";

type Engine = SitePageData["engines"][number];
type ToggleEngine = "google_indexing_api" | "yandex" | "baidu";

export function EngineSettings({ data }: { data: SitePageData }) {
	const { site, engines, paused, entitlement } = data;
	const pausedPlan = paused ? entitlement.plan.name : undefined;
	const byId = new Map(engines.map((engine) => [engine.engine, engine]));
	const yandex = byId.get("yandex");
	const baidu = byId.get("baidu");

	return (
		<>
			<SearchConsolePanel data={data} engine={byId.get("google_search_console")} />
			<IndexingApiPanel data={data} engine={byId.get("google_indexing_api")} />
			{yandex ? (
				<TokenEnginePanel
					siteId={site.id}
					engine={yandex}
					pausedPlan={pausedPlan}
					title="Yandex Webmaster"
					description="Optional. Asks Yandex to recrawl new and updated URLs, on top of IndexNow."
					limit="yandex"
					saveAction={saveYandexTokenAction.bind(null, site.id)}
					tokenLabel="Yandex OAuth token"
					detail={(yandex.details as { hostId?: string | null }).hostId ? <DetailRow label="Yandex host">{String((yandex.details as { hostId?: string }).hostId)}</DetailRow> : null}
				/>
			) : null}
			{baidu ? (
				<TokenEnginePanel
					siteId={site.id}
					engine={baidu}
					pausedPlan={pausedPlan}
					title="Baidu URL push"
					description="Optional. Pushes new and updated URLs to Baidu's link submission API."
					limit="baidu"
					saveAction={saveBaiduTokenAction.bind(null, site.id)}
					tokenLabel="Baidu push token"
					blockedReason={site.verified ? undefined : "Verify the site first. Saving the token pushes the homepage once to check it."}
					detail={
						typeof (baidu.details as { remainToday?: number | null }).remainToday === "number" ? (
							<DetailRow label="Pushes left today">{(baidu.details as { remainToday: number }).remainToday.toLocaleString()}</DetailRow>
						) : null
					}
				/>
			) : null}
		</>
	);
}

function SearchConsolePanel({ data, engine }: { data: SitePageData; engine?: Engine }) {
	const { site, google, paused } = data;
	const details = (engine?.details ?? {}) as { property?: string | null; permissionLevel?: string | null; lastSitemapSubmitAt?: string | null; inspectionsToday?: number; inspectionsPerDay?: number };
	// Connected to Google but no property matched this site: there is no gsc row, so engine.status alone would read "Not connected".
	const status = google.connected && !details.property ? { tone: "warning" as const, label: "No property matched" } : google.connected && engine ? engineStatus(engine.status) : engineStatus("not_connected");

	return (
		<Panel
			title="Google Search Console"
			description="Reads Google's own index status for your URLs and can hand Google your sitemaps. It does not make Google index a page."
			action={<Status tone={status.tone}>{status.label}</Status>}
		>
			<div className="flex flex-col gap-4 text-sm">
				{!google.connected ? (
					<>
						<p className="text-ink-2">Connect your Google account once. Each site is matched to its Search Console property (a domain property or a URL prefix).</p>
						<ErrorNote>{google.lastErrorMessage}</ErrorNote>
						<ConnectGoogle google={google} />
					</>
				) : (
					<>
						<dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
							<DetailRow label="Property">{details.property ? <span className="font-mono break-all">{details.property}</span> : <Status tone="warning" className="whitespace-normal">No matching property found</Status>}</DetailRow>
							{details.permissionLevel ? <DetailRow label="Your access">{details.permissionLevel}</DetailRow> : null}
							<DetailRow label="Inspections today">
								<span className="num">
									{(details.inspectionsToday ?? 0).toLocaleString()} of {(details.inspectionsPerDay ?? 0).toLocaleString()}
								</span>
							</DetailRow>
							<DetailRow label="Sitemaps sent">{details.lastSitemapSubmitAt ? timeAgo(details.lastSitemapSubmitAt) : "Never"}</DetailRow>
						</dl>
						{!google.canInspect ? (
							<Status tone="warning" className="whitespace-normal">
								Google did not grant Search Console access. Reconnect Google and allow it to inspect URLs.
							</Status>
						) : null}
						<ErrorNote>{engine?.lastError}</ErrorNote>
						<div className="flex flex-wrap items-center gap-2">
							{!paused ? (
								<ActionButton action={refreshGscPropertiesAction.bind(null, site.id)} variant="secondary" pendingLabel="Matching...">
									Re-match property
								</ActionButton>
							) : null}
							{!google.canInspect ? <ConnectGoogle google={google} label="Reconnect Google" /> : null}
							<Link href="/dashboard/connect" className={buttonClass({ variant: "ghost" })}>
								Manage Google connection
							</Link>
						</div>
						<p className="text-muted">Inspect URLs from the URLs tab. Send sitemaps to Google from the Sitemaps tab.</p>
					</>
				)}
			</div>
		</Panel>
	);
}

function IndexingApiPanel({ data, engine }: { data: SitePageData; engine?: Engine }) {
	const { site, google, paused, entitlement } = data;
	if (!engine) return null;
	const eligible = ((engine.details as { eligiblePages?: string[] }).eligiblePages ?? []).join(" or ");
	const hasRow = engine.status !== "not_connected";
	const status = engine.enabled ? { tone: "success" as const, label: "On for eligible pages" } : engineStatus(engine.status);

	return (
		<Panel
			title="Google Indexing API"
			description="Only for pages whose structured data is a job posting or a livestream. Every other page is skipped; this is not a way to index ordinary pages."
			action={engine.availableOnPlan ? <Status tone={status.tone}>{status.label}</Status> : null}
		>
			<div className="flex flex-col gap-4 text-sm">
				{!engine.availableOnPlan ? (
					<>
						<UpgradeNote feature="The Google Indexing API (job and livestream pages)" limit="googleIndexingApi" />
						{hasRow ? <ToggleRow siteId={site.id} engine="google_indexing_api" enabled={false} canRemove onlyRemove /> : null}
					</>
				) : !google.connected || !google.canUseIndexingApi ? (
					<>
						<p className="text-ink-2">Needs a Google connection that includes the Indexing API permission, and Owner access on this site&apos;s Search Console property.</p>
						<ConnectGoogle google={google} label={google.connected ? "Reconnect Google" : "Connect Google"} />
					</>
				) : (
					<>
						{eligible ? (
							<p className="text-ink-2">
								Eligible structured data: <span className="font-mono">{eligible}</span>. Each page is checked before it is sent.
							</p>
						) : null}
						<ErrorNote>{engine.lastError}</ErrorNote>
						{paused ? <PausedNote planName={entitlement.plan.name} task="send to it again" /> : null}
						<ToggleRow siteId={site.id} engine="google_indexing_api" enabled={engine.enabled} onLabel="Turn on for eligible pages" canRemove={hasRow} offOnly={paused} />
					</>
				)}
			</div>
		</Panel>
	);
}

function TokenEnginePanel({
	siteId,
	engine,
	pausedPlan,
	title,
	description,
	limit,
	saveAction,
	tokenLabel,
	detail,
	blockedReason,
}: {
	siteId: string;
	engine: Engine;
	/** Plan name when the site is paused; undefined otherwise. */
	pausedPlan?: string;
	title: string;
	description: string;
	limit: keyof Pick<PlanLimits, "yandex" | "baidu">;
	saveAction: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
	tokenLabel: string;
	detail?: ReactNode;
	blockedReason?: string;
}) {
	const status = engine.connected && engine.enabled ? { tone: "success" as const, label: "Sending" } : engine.connected ? { tone: "neutral" as const, label: "Auto-submit off" } : engineStatus(engine.status);
	const id = engine.engine as ToggleEngine;
	const hasStored = engine.connected || engine.status !== "not_connected";
	const paused = pausedPlan !== undefined;

	return (
		<Panel title={title} description={description} action={engine.availableOnPlan ? <Status tone={status.tone}>{status.label}</Status> : null}>
			<div className="flex flex-col gap-4 text-sm">
				{!engine.availableOnPlan ? (
					<>
						<UpgradeNote feature={title} limit={limit} />
						{hasStored ? <ToggleRow siteId={siteId} engine={id} enabled={false} canRemove onlyRemove /> : null}
					</>
				) : engine.connected ? (
					<>
						{detail ? <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">{detail}</dl> : null}
						<ErrorNote>{engine.lastError}</ErrorNote>
						{pausedPlan !== undefined ? <PausedNote planName={pausedPlan} task="send to it again" /> : null}
						<ToggleRow siteId={siteId} engine={id} enabled={engine.enabled} onLabel="Turn auto-submit on" canRemove offOnly={paused} />
					</>
				) : (
					<>
						<ErrorNote>{engine.lastError}</ErrorNote>
						{pausedPlan !== undefined ? (
							<PausedNote planName={pausedPlan} task="set it up" />
						) : blockedReason ? (
							<p className="text-muted">{blockedReason}</p>
						) : (
							<ActionForm action={saveAction} submitLabel="Save and verify" pendingLabel="Checking..." variant="secondary" className="items-start">
								<Field label={tokenLabel} required hint={engine.setupHint} className="w-full">
									{(control) => <Input {...control} name="token" type="password" autoComplete="off" spellCheck={false} />}
								</Field>
								<Checkbox name="autoSubmit" defaultChecked label="Auto-submit new and updated URLs" />
								{/* Unchecked boxes are left out of FormData and the action then defaults to on; this
								    hidden value comes after the checkbox, so FormData.get() sees "on" when ticked and "false" otherwise. */}
								<input type="hidden" name="autoSubmit" value="false" />
							</ActionForm>
						)}
						{engine.status === "failed" ? <ToggleRow siteId={siteId} engine={id} enabled={false} canRemove onlyRemove /> : null}
					</>
				)}
			</div>
		</Panel>
	);
}

/** offOnly (paused site) keeps the off switch and Disconnect: turning on is refused by the backend, cleaning up is not. */
function ToggleRow({ siteId, engine, enabled, onLabel = "Turn on", canRemove, onlyRemove, offOnly }: { siteId: string; engine: ToggleEngine; enabled: boolean; onLabel?: string; canRemove?: boolean; onlyRemove?: boolean; offOnly?: boolean }) {
	const showToggle = !onlyRemove && (!offOnly || enabled);
	if (!showToggle && !canRemove) return null;
	return (
		<div className="flex flex-wrap items-center gap-2">
			{showToggle ? (
				<ActionButton action={setEngineAutoSubmitAction.bind(null, siteId, engine, !enabled)} variant="secondary">
					{enabled ? "Turn auto-submit off" : onLabel}
				</ActionButton>
			) : null}
			{canRemove ? (
				<ActionButton action={removeEngineAction.bind(null, siteId, engine)} variant="ghost" confirm="Disconnect this engine for this site?">
					Disconnect
				</ActionButton>
			) : null}
		</div>
	);
}

/** Full-page GET to the OAuth start route (a fetch cannot follow Google's consent redirect). */
function ConnectGoogle({ google, label = "Connect Google" }: { google: SitePageData["google"]; label?: string }) {
	if (!google.configured) return <p className="text-muted">Google sign-in is not configured on this server yet.</p>;
	return (
		<a href={google.connectUrl} className={buttonClass({ className: "self-start" })}>
			{label}
		</a>
	);
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<>
			<dt className="text-muted">{label}</dt>
			<dd className="min-w-0 text-ink">{children}</dd>
		</>
	);
}
