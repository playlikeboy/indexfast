/**
 * First-run setup for an unverified site: sitemap found, key file deployed, verify. Hosting the
 * IndexNow key file is the ownership proof (nothing is submitted before it passes), so this
 * panel stays at the top of Overview until verification succeeds. Paused sites cannot verify:
 * the verify paths are replaced by a note that says why and how to unpause.
 */
import Link from "next/link";
import { Check } from "lucide-react";
import { adoptExistingKeyAction, verifySiteAction } from "@/app/actions";
import { ActionButton, ActionForm, CopyButton } from "@/components/app/client";
import { CodeBlock, Input, Panel, cn } from "@/components/ui";
import type { SitePageData } from "@/db/app-queries";
import { getSiteHost } from "@/lib/url-utils";
import { ErrorNote, PausedNote, siteHref, textLink } from "./shared";

export function SetupPanel({ data }: { data: SitePageData }) {
	const { site, setup, sources, stats, paused, entitlement } = data;
	const host = getSiteHost(site);
	const sitemapDone = sources.length > 0 && stats.total > 0;
	const aiPrompt = `Add a file at the web root of this project so it is served at ${setup.keyLocation}. File name: ${setup.fileName}. Content (exactly, nothing else): ${setup.fileContent}. For Next.js/Vite/Astro put it in public/, for SvelteKit in static/. Then commit and deploy.`;

	return (
		<Panel
			title="Finish setup: add one file to your site"
			description="This proves you own the site. Once it checks out, every new page is submitted automatically."
			action={<span className="num text-sm text-muted">{sitemapDone ? "Step 2 of 3" : "Step 1 of 3"}</span>}
		>
			<ol className="flex flex-col gap-6 text-sm">
				<li className="flex gap-3">
					<StepMarker n={1} done={sitemapDone} />
					<div className="min-w-0 flex-1">
						<h3 className="font-display text-md font-medium">Sitemap found</h3>
						<p className="mt-0.5 text-muted">
							{stats.total > 0 ? (
								`${stats.total.toLocaleString()} URLs imported from ${sources.length} sitemap${sources.length === 1 ? "" : "s"}.`
							) : (
								<>
									No URLs yet.{" "}
									<Link href={siteHref(site.id, { view: "sitemaps" })} className={textLink}>
										Add your sitemap
									</Link>
									.
								</>
							)}
						</p>
					</div>
				</li>
				<li className="flex gap-3">
					<StepMarker n={2} />
					<div className="flex min-w-0 flex-1 flex-col gap-3">
						<h3 className="font-display text-md font-medium">Create this file in your site&apos;s public folder and deploy</h3>
						<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
							<CodeBlock title="File name" code={setup.fileName} />
							<CodeBlock title="File content" code={setup.fileContent} />
						</div>
						<p className="text-muted">
							Put it in <code className="font-mono text-ink">public/</code> (Next.js, Vite, Astro), <code className="font-mono text-ink">static/</code> (SvelteKit) or the site root folder (WordPress, plain HTML).{" "}
							<a className={cn(textLink, "break-all")} href={setup.keyLocation} target="_blank" rel="noreferrer">
								Open the file URL
							</a>{" "}
							after deploying. It must show only the key, not a web page.
						</p>
						<div className="flex flex-wrap items-center gap-2 rounded-(--radius-input) bg-well px-3 py-2">
							<span className="text-muted">Using an AI editor?</span>
							<CopyButton value={aiPrompt} label="Copy prompt for your AI" />
						</div>
						{/* Users migrating from another IndexNow tool already host a key file; let them reuse it instead of deploying a new one. */}
						{!paused ? (
							<details className="rounded-(--radius-input) border border-border px-3 py-2">
								<summary className="cursor-pointer text-muted select-none hover:text-ink">Already have an IndexNow key on this site? Use it instead</summary>
								<div className="mt-3 flex flex-col gap-2">
									<p className="text-muted">
										Paste the key, or the full URL of your key file (for example <code className="font-mono text-ink">https://{host}/yourkey.txt</code>). We check it and verify in one step.
									</p>
									<ActionForm action={adoptExistingKeyAction.bind(null, site.id)} submitLabel="Use my key and verify" pendingLabel="Checking..." variant="secondary" inline>
										<Input name="existingKey" required autoComplete="off" spellCheck={false} placeholder="Key or https://.../key.txt" className="min-w-0 flex-1 font-mono text-sm" aria-label="Existing IndexNow key or key file URL" />
									</ActionForm>
								</div>
							</details>
						) : null}
					</div>
				</li>
				<li className="flex gap-3">
					<StepMarker n={3} />
					<div className="flex min-w-0 flex-1 flex-col items-start gap-2">
						<h3 className="font-display text-md font-medium">Verify</h3>
						<ErrorNote>{setup.lastErrorMessage}</ErrorNote>
						{paused ? (
							<PausedNote planName={entitlement.plan.name} task="verify it" />
						) : (
							<ActionButton action={verifySiteAction.bind(null, site.id)} variant="primary" pendingLabel="Checking file...">
								Verify and turn on auto-submit
							</ActionButton>
						)}
					</div>
				</li>
			</ol>
		</Panel>
	);
}

/** The step number carries order (the steps must happen in sequence); done steps show a check. */
function StepMarker({ n, done }: { n: number; done?: boolean }) {
	return (
		<span
			className={cn("num grid size-6 shrink-0 place-items-center rounded-(--radius-input) font-display text-xs font-semibold", done ? "bg-success-wash text-success" : "bg-well text-ink-2")}
		>
			{done ? <Check aria-hidden="true" className="size-3.5" /> : <span aria-hidden="true">{n}</span>}
			<span className="visually-hidden">{done ? `Step ${n}, done` : `Step ${n}`}</span>
		</span>
	);
}
