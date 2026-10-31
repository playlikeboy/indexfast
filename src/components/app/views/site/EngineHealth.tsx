/**
 * Engine health on Overview: one row per engine with a plain-language state, because "why did
 * nothing get submitted?" is the question users ask most and the answer must never be hidden.
 * Precedence per engine: broken setup beats rate limit beats healthy, since a broken key never
 * recovers on its own. Optional engines that are not set up collapse into one line so the
 * table only lists engines that are actually doing (or failing to do) something.
 * A saved key on a plan without that engine reads "Not on your plan", because the pipeline
 * only sends where the current entitlement allows it, whatever is stored.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { timeAgo } from "@/components/app/ui";
import { Panel, Status, Table, Td, Th, buttonClass, type StatusTone } from "@/components/ui";
import type { SitePageData } from "@/db/app-queries";
import { RecheckKeyButton, siteHref, textLink } from "./shared";

type Row = { name: string; tone: StatusTone; state: string; detail: ReactNode; action?: ReactNode };

type Engine = SitePageData["engines"][number];

const OPTIONAL_ENGINES = new Set(["google_search_console", "google_indexing_api", "yandex", "baidu"]);

export function EngineHealth({ data }: { data: SitePageData }) {
	const { site, setup, bing, queueSummary, paused, engines, google } = data;
	const throttled: Record<string, string | Date | undefined> = queueSummary?.throttledUntil ?? {};
	const settingsHref = siteHref(site.id, { view: "settings" });
	const bingOnPlan = engines.find((engine) => engine.engine === "bing")?.availableOnPlan ?? true;
	const rows: Row[] = [indexNowRow(data, throttled), bingRow(bing, bingOnPlan, throttled, settingsHref)];

	const optional = engines.filter((engine) => OPTIONAL_ENGINES.has(engine.engine));
	// A connected Google account counts for Search Console even before a property matched, so it is never listed as "available".
	const active = optional.filter((engine) => engine.connected || engine.status === "failed" || (engine.engine === "google_search_console" && google.connected));
	const idle = optional.filter((engine) => !active.includes(engine));
	for (const engine of active) rows.push(optionalRow(engine, throttled, settingsHref));

	if (setup.status !== "verified" && !paused) rows[0] = { ...rows[0], action: <RecheckKeyButton siteId={site.id} /> };

	return (
		<Panel title="Search engines" padded={false}>
			<Table caption="Search engine status">
				<thead>
					<tr>
						<Th className="pl-5">Engine</Th>
						<Th>State</Th>
						<Th className="w-full">Detail</Th>
						<Th className="pr-5">
							<span className="visually-hidden">Action</span>
						</Th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.name}>
							<Td className="pl-5 font-display font-medium whitespace-nowrap">{row.name}</Td>
							<Td>
								<Status tone={row.tone}>{row.state}</Status>
							</Td>
							<Td className="min-w-64 text-muted">{row.detail}</Td>
							<Td className="pr-5 text-right">{row.action}</Td>
						</tr>
					))}
				</tbody>
			</Table>
			{idle.length > 0 ? (
				<p className="px-5 py-3 text-sm text-muted">
					Also available: {idle.map((engine) => shortName(engine.engine)).join(", ")}.{" "}
					<Link href={settingsHref} className={textLink}>
						Set up in Settings
					</Link>
				</p>
			) : null}
		</Panel>
	);
}

function indexNowRow({ site, setup }: SitePageData, throttled: Record<string, string | Date | undefined>): Row {
	if (setup.status !== "verified") {
		return { name: "IndexNow", tone: "danger", state: "Key check failing", detail: setup.lastErrorMessage || "The key file could not be confirmed. Nothing is sent until it passes." };
	}
	if (throttled.indexnow) {
		return {
			name: "IndexNow",
			tone: "warning",
			state: `Rate limited, retrying ${timeAgo(throttled.indexnow)}`,
			detail: "IndexNow asked us to slow down for this site. URLs stay queued and are retried automatically. Submitting again now would only extend the wait.",
		};
	}
	if (!site.automationEnabled) return { name: "IndexNow", tone: "neutral", state: "Auto-submit paused", detail: "Manual submits still work. Turn auto-submit back on in Settings." };
	return { name: "IndexNow", tone: "success", state: "Sending", detail: "New and updated URLs go to Bing, Yandex, Naver, Seznam and other IndexNow engines." };
}

function bingRow(bing: SitePageData["bing"], availableOnPlan: boolean, throttled: Record<string, string | Date | undefined>, settingsHref: string): Row {
	if (!bing) {
		return {
			name: "Bing API",
			tone: "neutral",
			state: "Not connected",
			detail: "Optional. Adds direct Bing Webmaster submissions on top of IndexNow.",
			action: (
				<Link href={settingsHref} className={buttonClass({ variant: "ghost", size: "sm" })}>
					Connect
				</Link>
			),
		};
	}
	if (!availableOnPlan) {
		return {
			name: "Bing API",
			tone: "warning",
			state: "Not on your plan",
			detail: "Bing submissions stopped when the plan changed.",
			action: (
				<Link href="/dashboard/billing" className={buttonClass({ variant: "ghost", size: "sm" })}>
					See plans
				</Link>
			),
		};
	}
	if (bing.status !== "verified") return { name: "Bing API", tone: "danger", state: "Key not working", detail: bing.lastErrorMessage || "Reconnect your Bing Webmaster API key in Settings." };
	if (throttled.bing) return { name: "Bing API", tone: "warning", state: `Rate limited, retrying ${timeAgo(throttled.bing)}`, detail: "Bing is throttling requests. Queued URLs retry automatically." };
	return { name: "Bing API", tone: bing.autoSubmit ? "success" : "neutral", state: bing.autoSubmit ? "Sending" : "Auto-submit off", detail: "Direct submissions into your Bing Webmaster quota." };
}

function optionalRow(engine: Engine, throttled: Record<string, string | Date | undefined>, settingsHref: string): Row {
	const name = shortName(engine.engine);
	if (engine.status === "failed" || (!engine.connected && engine.lastError)) {
		return { name, tone: "danger", state: "Failing", detail: engine.lastError || engine.setupHint };
	}
	if (engine.kind === "inspection") {
		const details = engine.details as { property?: string | null; inspectionsToday?: number; inspectionsPerDay?: number };
		if (!details.property) {
			return {
				name,
				tone: "warning",
				state: "No property matched",
				detail: "Google is connected, but no Search Console property matches this site.",
				action: (
					<Link href={settingsHref} className={buttonClass({ variant: "ghost", size: "sm" })}>
						Settings
					</Link>
				),
			};
		}
		return {
			name,
			tone: engine.enabled ? "success" : "neutral",
			state: engine.enabled ? "Inspecting" : "Connected",
			detail: (
				<>
					Reads Google&apos;s index status for <span className="font-mono text-ink-2">{details.property}</span>. {details.inspectionsToday ?? 0} of {details.inspectionsPerDay ?? 0} inspections used today.
				</>
			),
		};
	}
	if (throttled[engine.engine]) return { name, tone: "warning", state: `Rate limited, retrying ${timeAgo(throttled[engine.engine])}`, detail: "Queued URLs retry automatically." };
	return { name, tone: engine.enabled ? "success" : "neutral", state: engine.enabled ? "Sending" : "Auto-submit off", detail: engine.setupHint };
}

function shortName(engine: string) {
	if (engine === "google_search_console") return "Search Console";
	if (engine === "google_indexing_api") return "Google Indexing API";
	if (engine === "yandex") return "Yandex";
	if (engine === "baidu") return "Baidu";
	return engine;
}
