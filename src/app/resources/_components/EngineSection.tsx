/*
 * One engine's submission reference (methods, limits, setup, gotchas), rendered from
 * src/lib/resources/search-engines.ts. Shared by the /resources/search-engines hub and each
 * /resources/search-engines/<engine> guide so the two can never show different limits.
 * "adding" methods are labelled as in progress so nothing reads as a promise of indexing.
 */
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge, CodeBlock, Status, buttonClass, type StatusTone } from "@/components/ui";
import type { SearchEngine, SearchEngineMethod } from "@/lib/resources/search-engines";

export const supportStatus: Record<SearchEngine["supportLevel"], { tone: StatusTone; label: string }> = {
	native: { tone: "success", label: "Native" },
	indexnow: { tone: "info", label: "Via IndexNow" },
	restricted: { tone: "warning", label: "Gated (jobs and live)" },
	syndicated: { tone: "neutral", label: "Syndicated" },
	planned: { tone: "neutral", label: "Planned" },
};

function MethodBlock({ method }: { method: SearchEngineMethod }) {
	// Entries that start with "None" (e.g. "None (any valid page...)") carry no restriction to warn about.
	const restricted = Boolean(method.contentRestrictions) && !/^None\b/.test(method.contentRestrictions);
	return (
		<div className="min-w-0 border-t border-border pt-8">
			<div className="flex flex-wrap items-center gap-3">
				<h4 className="font-display text-lg font-medium tracking-display">{method.name}</h4>
				<Badge>{method.httpMethod}</Badge>
				{method.inIndexFast ? (
					<Status tone={method.inIndexFast.status === "live" ? "success" : "info"}>
						{method.inIndexFast.status === "live" ? "In IndexFast" : "Being added"}
					</Status>
				) : null}
			</div>
			{method.inIndexFast ? <p className="mt-2 max-w-[35em] text-md text-ink-2">{method.inIndexFast.note}</p> : null}
			<dl className="mt-6 grid gap-x-10 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
				<div className="min-w-0">
					<dt className="text-muted">Auth</dt>
					<dd className="mt-1 font-mono text-ink">{method.authMethod}</dd>
				</div>
				<div className="min-w-0">
					<dt className="text-muted">Batch</dt>
					<dd className="num mt-1 text-ink">{method.batchSize.toLocaleString("en-US")} URLs</dd>
				</div>
				<div className="min-w-0">
					<dt className="text-muted">Quota</dt>
					<dd className="mt-1 text-ink">{method.dailyQuota}</dd>
				</div>
				<div className="min-w-0">
					<dt className="text-muted">Latency</dt>
					<dd className="mt-1 text-ink">{method.latency}</dd>
				</div>
			</dl>
			{restricted ? (
				<p className="mt-6 max-w-3xl rounded-input bg-warning-wash px-4 py-3 text-sm text-ink">
					<Status tone="warning" className="mr-2 align-[-0.15em]">
						Restriction
					</Status>
					{method.contentRestrictions}
				</p>
			) : null}
			<p className="mt-6 text-sm text-muted">Endpoint</p>
			<code className="mt-1 block overflow-x-auto rounded-input bg-well px-3 py-2 font-mono text-sm text-ink">{method.endpoint}</code>
			<CodeBlock title="curl" code={method.curlExample} className="mt-6" />
			{method.notes ? <p className="mt-4 max-w-[35em] text-sm text-muted">{method.notes}</p> : null}
		</div>
	);
}

export function EngineSection({ engine, guideLink = false }: { engine: SearchEngine; guideLink?: boolean }) {
	const docs = engine.methods[0]?.documentationUrl;
	return (
		<article id={engine.id} className="scroll-mt-24 border-t border-border-strong pt-12">
			<div className="flex flex-wrap items-start justify-between gap-6">
				<div className="min-w-0 max-w-[35em]">
					<h3 className="text-title">
						{guideLink ? (
							<Link href={`/resources/search-engines/${engine.id}`} className="underline decoration-border-strong underline-offset-4 hover:decoration-signal">
								{engine.name}
							</Link>
						) : (
							engine.name
						)}
					</h3>
					<p className="mt-2 text-sm text-muted">{engine.marketShare}</p>
					<p className="mt-4 text-md text-ink-2">{engine.summary}</p>
				</div>
				{docs ? (
					<a href={docs} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary", size: "md" })}>
						Official docs
						<ExternalLink aria-hidden="true" className="size-4" />
					</a>
				) : null}
			</div>
			<h4 className="visually-hidden">Available submission methods</h4>
			<div className="mt-10 space-y-10">
				{engine.methods.map((method) => (
					<MethodBlock key={method.name} method={method} />
				))}
			</div>
			<div className="mt-10 grid gap-10 border-t border-border pt-8 md:grid-cols-2 md:gap-16">
				<div className="min-w-0">
					<h4 className="font-display text-md font-medium">{engine.setupGuide.title}</h4>
					<ol className="mt-4 list-decimal space-y-2 pl-5 text-md text-ink-2 marker:text-muted">
						{engine.setupGuide.steps.map((step) => (
							<li key={step} className="pl-1">
								{step}
							</li>
						))}
					</ol>
				</div>
				<div className="min-w-0">
					<h4 className="font-display text-md font-medium">Developer tips and gotchas</h4>
					<ul className="mt-4 list-disc space-y-2 pl-5 text-md text-ink-2 marker:text-muted">
						{engine.developerTips.map((tip) => (
							<li key={tip} className="pl-1">
								{tip}
							</li>
						))}
					</ul>
				</div>
			</div>
		</article>
	);
}

