"use client";

import { useState } from "react";
import {
	generateIndexNowKeyTool,
	generateLlmsTxtTool,
	checkHttpStatusTool,
	checkRobotsTxtTool,
	checkNoindexTagTool,
	checkCanonicalTool,
	checkAiCrawlerTool,
	extractSitemapUrlsTool,
	submitIndexNowTool,
	checkGoogleIndexTool,
	checkBulkIndexTool,
} from "@/app/tools/tool-actions";

type ToolType =
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

type ToolResponse = Record<string, unknown> & {
	error?: string;
	key?: string;
	host?: string;
	keyLocation?: string;
	fileName?: string;
	llmsTxt?: string;
	status?: number;
	durationMs?: number;
	finalUrl?: string;
	headers?: Record<string, string>;
	isIndexable?: boolean;
	isCanonicalMatch?: boolean;
	httpStatus?: number;
	noindex?: boolean;
	noindexSource?: string | null;
	canonical?: string | null;
	title?: string | null;
	gscInspectUrl?: string;
	truthNote?: string;
	urlCount?: number;
	passed?: number;
	warned?: number;
	failed?: number;
	bots?: Array<{ name: string; owner: string; allowed: boolean; ruleSource: string }>;
	urls?: string[] | Array<{ loc: string }>;
	results?: Array<{ url: string; status: string; httpStatus: number; blockers?: string[] }>;
};

export function ToolRunner({
	toolType,
	placeholder,
	buttonLabel,
}: {
	toolType: ToolType;
	placeholder?: string;
	buttonLabel: string;
}) {
	const [input, setInput] = useState("");
	const [secondInput, setSecondInput] = useState("");
	const [thirdInput, setThirdInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<ToolResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const handleCopy = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setResult(null);
		setLoading(true);

		try {
			let res: ToolResponse | undefined;
			if (toolType === "indexnow-key-generator") {
				res = await generateIndexNowKeyTool(input);
			} else if (toolType === "http-status-checker") {
				res = await checkHttpStatusTool(input);
			} else if (toolType === "noindex-tag-checker") {
				res = await checkNoindexTagTool(input);
			} else if (toolType === "canonical-checker") {
				res = await checkCanonicalTool(input);
			} else if (toolType === "robots-txt-checker") {
				res = await checkRobotsTxtTool(input);
			} else if (toolType === "ai-crawler-checker") {
				res = await checkAiCrawlerTool(input);
			} else if (toolType === "sitemap-url-extractor") {
				res = await extractSitemapUrlsTool(input);
			} else if (toolType === "google-index-checker") {
				res = await checkGoogleIndexTool(input);
			} else if (toolType === "bulk-index-checker") {
				res = await checkBulkIndexTool(input);
			} else if (toolType === "llms-txt-generator") {
				res = await generateLlmsTxtTool({
					domain: input,
					title: secondInput || input,
					description: thirdInput || "",
				});
			} else if (toolType === "bing-indexnow-submitter") {
				res = await submitIndexNowTool({
					host: input,
					key: secondInput,
					urlList: thirdInput,
				});
			}

			if (res && res.error) {
				setError(res.error);
			} else {
				setResult(res || null);
			}
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="mt-8">
			<form onSubmit={handleSubmit} className="space-y-4">
				{toolType === "llms-txt-generator" ? (
					<>
						<div>
							<label className="block text-sm font-semibold text-ink">Domain</label>
							<input
								type="text"
								required
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="example.com"
								className="mt-1 w-full border border-ink bg-surface px-4 py-3 text-sm focus:border-accent focus:outline-none"
							/>
						</div>
						<div>
							<label className="block text-sm font-semibold text-ink">Website Name / Title</label>
							<input
								type="text"
								value={secondInput}
								onChange={(e) => setSecondInput(e.target.value)}
								placeholder="My Brand"
								className="mt-1 w-full border border-ink bg-surface px-4 py-3 text-sm focus:border-accent focus:outline-none"
							/>
						</div>
						<div>
							<label className="block text-sm font-semibold text-ink">Brief Description</label>
							<textarea
								rows={2}
								value={thirdInput}
								onChange={(e) => setThirdInput(e.target.value)}
								placeholder="What does your product or site do?"
								className="mt-1 w-full border border-ink bg-surface px-4 py-2 text-sm focus:border-accent focus:outline-none"
							/>
						</div>
					</>
				) : toolType === "bing-indexnow-submitter" ? (
					<>
						<div>
							<label className="block text-sm font-semibold text-ink">Domain Host</label>
							<input
								type="text"
								required
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="example.com"
								className="mt-1 w-full border border-ink bg-surface px-4 py-3 text-sm focus:border-accent focus:outline-none"
							/>
						</div>
						<div>
							<label className="block text-sm font-semibold text-ink">IndexNow Key</label>
							<input
								type="text"
								required
								value={secondInput}
								onChange={(e) => setSecondInput(e.target.value)}
								placeholder="32 or 48-char key"
								className="mt-1 w-full border border-ink bg-surface px-4 py-3 text-sm font-mono focus:border-accent focus:outline-none"
							/>
						</div>
						<div>
							<label className="block text-sm font-semibold text-ink">URLs to submit (one per line)</label>
							<textarea
								required
								rows={4}
								value={thirdInput}
								onChange={(e) => setThirdInput(e.target.value)}
								placeholder={"https://example.com/\nhttps://example.com/blog"}
								className="mt-1 w-full border border-ink bg-surface px-4 py-2 text-sm font-mono focus:border-accent focus:outline-none"
							/>
						</div>
					</>
				) : toolType === "bulk-index-checker" ? (
					<div>
						<label className="block text-sm font-semibold text-ink">URLs to check (up to 20, one per line)</label>
						<textarea
							required
							rows={5}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder={"https://example.com/\nhttps://example.com/pricing\nhttps://example.com/about"}
							className="mt-1 w-full border border-ink bg-surface px-4 py-2 text-sm font-mono focus:border-accent focus:outline-none"
						/>
					</div>
				) : (
					<div>
						<label className="block text-sm font-semibold text-ink">
							{toolType.includes("robots") || toolType === "ai-crawler-checker" || toolType === "indexnow-key-generator"
								? "Enter Domain or URL"
								: "Enter URL"}
						</label>
						<input
							type="text"
							required
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder={placeholder || "https://example.com/page"}
							className="mt-1 w-full border border-ink bg-surface px-4 py-3 text-sm focus:border-accent focus:outline-none"
						/>
					</div>
				)}

				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={loading}
						className="bg-ink px-6 py-3 text-sm font-semibold text-surface transition-colors hover:bg-ink/85 disabled:opacity-50"
					>
						{loading ? "Processing..." : buttonLabel}
					</button>
					{(result || error) && (
						<button
							type="button"
							onClick={() => {
								setResult(null);
								setError(null);
							}}
							className="border border-border px-4 py-3 text-sm font-semibold text-muted hover:text-ink"
						>
							Reset
						</button>
					)}
				</div>
			</form>

			{error && (
				<div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
					<p className="font-semibold">Error</p>
					<p className="mt-1">{error}</p>
				</div>
			)}

			{result && (
				<div className="mt-6 space-y-4 rounded-md border border-border bg-card p-5">
					<div className="flex items-center justify-between border-b border-border pb-3">
						<span className="font-mono text-xs font-bold uppercase text-muted">Result</span>
						<button
							type="button"
							onClick={() => handleCopy(JSON.stringify(result, null, 2))}
							className="text-xs font-semibold text-accent underline"
						>
							{copied ? "Copied!" : "Copy JSON"}
						</button>
					</div>

					{/* 1. IndexNow Key Generator Output */}
					{toolType === "indexnow-key-generator" && (
						<div className="space-y-3 text-sm">
							<p>
								<strong className="text-ink">Key:</strong> <code className="bg-surface px-2 py-0.5 font-mono">{result.key}</code>
							</p>
							<p>
								<strong className="text-ink">Host:</strong> {result.host}
							</p>
							<p>
								<strong className="text-ink">Verification File URL:</strong>{" "}
								<a href={result.keyLocation} target="_blank" rel="noreferrer" className="text-accent underline break-all">
									{result.keyLocation}
								</a>
							</p>
							<div className="rounded bg-surface p-3 font-mono text-xs">
								<p className="font-bold text-muted">Instructions:</p>
								<p className="mt-1">1. Create a file named <strong>{result.fileName}</strong> containing only the key.</p>
								<p>2. Upload it to the root of your domain so it serves at <code>{result.keyLocation}</code>.</p>
								<p>3. Submit changed URLs directly via IndexNow or IndexFast dashboard.</p>
							</div>
						</div>
					)}

					{/* 2. llms.txt Generator Output */}
					{toolType === "llms-txt-generator" && (
						<div className="space-y-4 text-sm">
							<div>
								<div className="flex items-center justify-between">
									<strong className="text-ink">/llms.txt</strong>
									<button
										type="button"
										onClick={() => handleCopy(result.llmsTxt || "")}
										className="text-xs font-semibold text-accent underline"
									>
										Copy /llms.txt
									</button>
								</div>
								<pre className="mt-2 max-h-60 overflow-y-auto rounded bg-surface p-3 font-mono text-xs">{result.llmsTxt}</pre>
							</div>
						</div>
					)}

					{/* 3. HTTP Status Checker Output */}
					{toolType === "http-status-checker" && (
						<div className="space-y-2 text-sm">
							<div className="flex items-center gap-3">
								<span
									className={`px-2 py-0.5 font-mono text-xs font-bold ${
										result.status === 200 ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
									}`}
								>
									HTTP {result.status}
								</span>
								<span className="text-muted">{result.durationMs}ms</span>
							</div>
							<p className="font-mono text-xs break-all text-muted">{result.finalUrl}</p>
							{result.headers && Object.keys(result.headers).length > 0 && (
								<div className="mt-3 rounded bg-surface p-3">
									<p className="font-mono text-xs font-bold uppercase text-muted">Response Headers</p>
									<ul className="mt-2 space-y-1 font-mono text-xs text-ink">
										{Object.entries(result.headers).map(([k, v]) => (
											<li key={k}>
												<span className="text-muted">{k}:</span> {String(v)}
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
					)}

					{/* 4. Noindex / Canonical / Google Index Checker Output */}
					{(toolType === "noindex-tag-checker" || toolType === "canonical-checker" || toolType === "google-index-checker") && (
						<div className="space-y-3 text-sm">
							<p>
								<strong className="text-ink">Status:</strong>{" "}
								<span className={`font-bold ${result.isIndexable || result.isCanonicalMatch ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`}>
									{result.httpStatus ? `HTTP ${result.httpStatus}` : "Checked"}
								</span>
							</p>
							{result.noindex !== undefined && (
								<p>
									<strong className="text-ink">Noindex tag:</strong>{" "}
									<span className={result.noindex ? "font-bold text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
										{result.noindex ? `Blocked (${result.noindexSource})` : "None (Indexable)"}
									</span>
								</p>
							)}
							{result.canonical !== undefined && (
								<p>
									<strong className="text-ink">Canonical:</strong>{" "}
									<span className="font-mono text-xs break-all">{result.canonical || "No canonical specified"}</span>
								</p>
							)}
							{result.gscInspectUrl && (
								<div className="mt-4 rounded bg-surface p-3">
									<p className="text-xs text-muted">{result.truthNote}</p>
									<a
										href={result.gscInspectUrl}
										target="_blank"
										rel="noreferrer"
										className="mt-3 inline-block bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
									>
										Inspect in Google Search Console →
									</a>
								</div>
							)}
						</div>
					)}

					{/* 5. AI Crawler Checker Output */}
					{toolType === "ai-crawler-checker" && result.bots && (
						<div className="space-y-2">
							<div className="grid gap-2 sm:grid-cols-2">
								{result.bots.map((bot) => (
									<div key={bot.name} className="flex items-center justify-between rounded bg-surface p-3 text-xs">
										<div>
											<p className="font-bold text-ink">{bot.name}</p>
											<p className="text-[11px] text-muted">{bot.owner}</p>
										</div>
										<span
											className={`px-2 py-0.5 font-bold ${
												bot.allowed ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-red-500/20 text-red-600 dark:text-red-400"
											}`}
										>
											{bot.allowed ? "Allowed" : "Blocked"}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* 6. Sitemap URL Extractor Output */}
					{toolType === "sitemap-url-extractor" && result.urls && (
						<div className="space-y-3 text-sm">
							<p>
								<strong className="text-ink">Found URLs:</strong> {result.urlCount}
							</p>
							<div className="max-h-60 overflow-y-auto rounded bg-surface p-3 font-mono text-xs">
								{result.urls.map((u, i: number) => (
									<div key={i} className="truncate py-0.5 text-muted hover:text-ink">
										{typeof u === "string" ? u : u.loc}
									</div>
								))}
							</div>
						</div>
					)}

					{/* 7. Bulk Index Checker Output */}
					{toolType === "bulk-index-checker" && result.results && (
						<div className="space-y-3">
							<div className="flex gap-4 text-xs font-bold">
								<span className="text-green-600 dark:text-green-400">Pass: {result.passed}</span>
								<span className="text-yellow-600 dark:text-yellow-400">Warn: {result.warned}</span>
								<span className="text-red-600 dark:text-red-400">Fail: {result.failed}</span>
							</div>
							<div className="max-h-80 overflow-y-auto space-y-2">
								{result.results.map((r, idx: number) => (
									<div key={idx} className="rounded bg-surface p-2.5 text-xs">
										<div className="flex items-center justify-between">
											<span className="font-mono text-ink truncate max-w-[70%]">{r.url}</span>
											<span className={`px-1.5 py-0.5 font-bold uppercase ${r.status === "pass" ? "text-green-600" : r.status === "warn" ? "text-yellow-600" : "text-red-600"}`}>
												{r.status} (HTTP {r.httpStatus})
											</span>
										</div>
										{r.blockers && r.blockers.length > 0 && (
											<p className="mt-1 text-[11px] text-red-500">{r.blockers.join("; ")}</p>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
