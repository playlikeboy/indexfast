/**
 * Settings section: automation rules, the IndexNow key (the ownership proof), every optional
 * engine, and the danger zone. Paused sites hide the key re-check: a paused site sends nothing,
 * so a passing check would only suggest otherwise. Deleting is confirmed because it cannot be undone.
 */
import { deleteSiteAction, removeBingKeyAction, saveBingKeyAction, saveCustomKeyAction, setAutomationAction, toggleBingAutoSubmitAction, updateRulesAction } from "@/app/actions";
import { ActionButton, ActionForm } from "@/components/app/client";
import { Field, Input, Panel, Status } from "@/components/ui";
import type { SitePageData } from "@/db/app-queries";
import { getSiteHost } from "@/lib/url-utils";
import { EngineSettings } from "./Engines";
import { Checkbox, ErrorNote, RecheckKeyButton, UpgradeNote, textLink } from "./shared";

export function SettingsSection({ data }: { data: SitePageData }) {
	const { site } = data;
	const host = getSiteHost(site);

	return (
		<div className="flex flex-col gap-6">
			<AutomationPanel data={data} />
			<IndexNowPanel data={data} />
			<BingPanel data={data} />
			<EngineSettings data={data} />

			<Panel title="Delete website" description="Removes the site, its URLs and history from IndexFast. Your website itself is not touched.">
				<ActionButton action={deleteSiteAction.bind(null, site.id)} variant="danger" confirm={`Delete ${host} from IndexFast? This cannot be undone.`}>
					Delete {host}
				</ActionButton>
			</Panel>
		</div>
	);
}

function AutomationPanel({ data }: { data: SitePageData }) {
	const { site, setup } = data;
	const live = site.verified && site.automationEnabled;
	return (
		<Panel
			title="Automation"
			description={live ? "On: new and updated URLs are submitted automatically." : site.verified ? "Paused: sitemaps are still checked but nothing is sent automatically." : "Turns on by itself after verification."}
			action={
				site.verified ? (
					<ActionButton action={setAutomationAction.bind(null, site.id, !site.automationEnabled)} variant="secondary">
						{site.automationEnabled ? "Pause auto-submit" : "Turn auto-submit on"}
					</ActionButton>
				) : null
			}
		>
			<ActionForm action={updateRulesAction.bind(null, site.id)} submitLabel="Save rules" variant="secondary" className="items-start">
				<fieldset className="flex flex-col gap-2 text-sm">
					<legend className="visually-hidden">Submission rules</legend>
					<Checkbox name="submitNewUrls" defaultChecked={setup.submitNewUrls} label="Submit new URLs" />
					<Checkbox name="submitChangedUrls" defaultChecked={setup.submitChangedUrls} label="Resubmit URLs when their lastmod changes" />
				</fieldset>
			</ActionForm>
		</Panel>
	);
}

function IndexNowPanel({ data }: { data: SitePageData }) {
	const { site, setup, paused } = data;
	const host = getSiteHost(site);
	return (
		<Panel
			title="IndexNow key"
			description="The key file on your site proves ownership. Removing it stops submissions."
			action={<Status tone={setup.status === "verified" ? "success" : setup.status === "failed" ? "danger" : "warning"}>{setup.status === "verified" ? "Verified" : setup.status === "failed" ? "Failing" : "Not verified"}</Status>}
		>
			<div className="flex flex-col gap-4 text-sm">
				<div className="flex flex-wrap items-center gap-3">
					<a href={setup.keyLocation} target="_blank" rel="noreferrer" className={`${textLink} min-w-0 font-mono break-all`}>
						{setup.keyLocation}
					</a>
					{!paused ? <RecheckKeyButton siteId={site.id} /> : null}
				</div>
				<ErrorNote>{setup.lastErrorMessage}</ErrorNote>
				<details className="rounded-(--radius-input) border border-border px-3 py-2">
					<summary className="cursor-pointer text-muted select-none hover:text-ink">Use my own IndexNow key</summary>
					<div className="mt-3 flex flex-col gap-2">
						<p className="text-muted">Only if you already host a key from another tool. Re-check after saving.</p>
						<ActionForm action={saveCustomKeyAction.bind(null, site.id)} submitLabel="Save key" variant="secondary" className="items-start">
							<Field label="Key" required className="w-full">
								{(control) => <Input {...control} name="key" defaultValue={setup.key} autoComplete="off" spellCheck={false} className="font-mono text-sm" />}
							</Field>
							<Field label="Key file URL" hint="Optional. Defaults to the site root." className="w-full">
								{(control) => <Input {...control} name="keyLocation" defaultValue={setup.keyLocation} spellCheck={false} placeholder={`https://${host}/<key>.txt`} className="font-mono text-sm" />}
							</Field>
						</ActionForm>
					</div>
				</details>
			</div>
		</Panel>
	);
}

function BingPanel({ data }: { data: SitePageData }) {
	const { site, bing, engines } = data;
	const availableOnPlan = engines.find((engine) => engine.engine === "bing")?.availableOnPlan ?? true;
	return (
		<Panel
			title="Bing Webmaster API"
			description="Optional. Direct batch submissions into your Bing Webmaster quota, on top of IndexNow."
			action={
				bing && !availableOnPlan ? (
					<Status tone="warning">Not on your plan</Status>
				) : bing ? (
					<>
						<Status tone={bing.status === "verified" ? "success" : "danger"}>{bing.status === "verified" ? "Connected" : "Not working"}</Status>
						{bing.status === "verified" ? <Status tone={bing.autoSubmit ? "success" : "neutral"}>{bing.autoSubmit ? "Auto-submit on" : "Auto-submit off"}</Status> : null}
					</>
				) : null
			}
		>
			<div className="flex flex-col gap-3 text-sm">
				{bing && !availableOnPlan ? (
					<>
						{/* The pipeline only sends to Bing when the plan includes it, so the stored key is shown as stopped, with a way to remove it. */}
						<UpgradeNote feature="The Bing Webmaster API" limit="bing" />
						<span className="flex flex-wrap items-center justify-between gap-3">
							<span className="font-mono">{bing.maskedKey}</span>
							<ActionButton action={removeBingKeyAction.bind(null, site.id)} variant="ghost" confirm="Disconnect the Bing API key? It is shared by all your sites, so Bing stops for each of them.">
								Disconnect
							</ActionButton>
						</span>
					</>
				) : bing ? (
					<>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<span className="flex flex-wrap items-baseline gap-x-3">
								<span className="font-mono">{bing.maskedKey}</span>
								{bing.quota?.dailyQuota ? <span className="num text-muted">Daily quota {bing.quota.dailyQuota.toLocaleString()} URLs</span> : null}
							</span>
							<span className="flex flex-wrap items-center gap-2">
								{bing.status === "verified" ? (
									<ActionButton action={toggleBingAutoSubmitAction.bind(null, site.id, !bing.autoSubmit)} variant="secondary">
										{bing.autoSubmit ? "Turn auto-submit off" : "Turn auto-submit on"}
									</ActionButton>
								) : null}
								<ActionButton action={removeBingKeyAction.bind(null, site.id)} variant="ghost" confirm="Disconnect the Bing API key? It is shared by all your sites, so Bing stops for each of them.">
									Disconnect
								</ActionButton>
							</span>
						</div>
						<ErrorNote>{bing.lastErrorMessage}</ErrorNote>
					</>
				) : !availableOnPlan ? (
					<UpgradeNote feature="The Bing Webmaster API" limit="bing" />
				) : (
					<>
						<ActionForm action={saveBingKeyAction.bind(null, site.id)} submitLabel="Connect and verify" variant="secondary" className="items-start">
							<Field label="Bing Webmaster API key" required className="w-full">
								{(control) => <Input {...control} name="apiKey" type="password" autoComplete="off" placeholder="Paste Bing Webmaster API key" />}
							</Field>
							<Checkbox name="autoSubmit" defaultChecked label="Auto-submit new and updated URLs to Bing" />
						</ActionForm>
						<p className="text-muted">
							Get the key in{" "}
							<a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer" className={textLink}>
								Bing Webmaster Tools
							</a>
							, under Settings, API Access. The site must already be added there.
						</p>
					</>
				)}
			</div>
		</Panel>
	);
}
