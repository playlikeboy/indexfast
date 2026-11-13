"use client";

/*
 * The form behind every free tool: collects the inputs, calls the tool's server action and hands
 * the answer to ToolResult. Actions return { success: false, error } instead of throwing, so the
 * visitor always sees what went wrong; the catch below only covers a dropped network request.
 * After a result lands, focus moves to its heading so keyboard and screen-reader users reach it.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CircleX } from "lucide-react";
import { Button, Field, Input, Panel, Textarea } from "@/components/ui";
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
import { ToolResult, type ToolOutput, type ToolType } from "./ToolResult";
import { sendAttributionEvent } from "@/lib/attribution";

type Inputs = { first: string; second: string; third: string };

const runners: Record<ToolType, (v: Inputs) => Promise<ToolOutput>> = {
	"indexnow-key-generator": (v) => generateIndexNowKeyTool(v.first),
	"http-status-checker": (v) => checkHttpStatusTool(v.first),
	"noindex-tag-checker": (v) => checkNoindexTagTool(v.first),
	"canonical-checker": (v) => checkCanonicalTool(v.first),
	"robots-txt-checker": (v) => checkRobotsTxtTool(v.first),
	"ai-crawler-checker": (v) => checkAiCrawlerTool(v.first),
	"sitemap-url-extractor": (v) => extractSitemapUrlsTool(v.first),
	"google-index-checker": (v) => checkGoogleIndexTool(v.first),
	"bulk-index-checker": (v) => checkBulkIndexTool(v.first),
	"llms-txt-generator": (v) =>
		generateLlmsTxtTool({
			domain: v.first,
			title: v.second || v.first,
			description: v.third,
		}),
	"bing-indexnow-submitter": (v) => submitIndexNowTool({ host: v.first, key: v.second, urlList: v.third }),
};

const DOMAIN_TOOLS: ToolType[] = ["robots-txt-checker", "ai-crawler-checker", "indexnow-key-generator"];

export function ToolRunner({ toolType, placeholder, buttonLabel }: { toolType: ToolType; placeholder?: string; buttonLabel: string }) {
	const [input, setInput] = useState("");
	const [secondInput, setSecondInput] = useState("");
	const [thirdInput, setThirdInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<ToolOutput | null>(null);
	const [error, setError] = useState<string | null>(null);
	const resultHeading = useRef<HTMLHeadingElement>(null);

	useEffect(() => {
		if (result) resultHeading.current?.focus();
	}, [result]);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);
		setResult(null);
		setLoading(true);
		try {
			const res = await runners[toolType]({
				first: input,
				second: secondInput,
				third: thirdInput,
			});
			if (res.success) {
				setResult(res);
				sendAttributionEvent("tool_used", window.location.pathname);
			} else setError(res.error);
		} catch {
			setError("The request did not reach the server. Check your connection and try again.");
		} finally {
			setLoading(false);
		}
	};

	const reset = () => {
		setResult(null);
		setError(null);
	};

	return (
		<Panel>
			<form onSubmit={handleSubmit} className="flex flex-col gap-2">
				{toolType === "llms-txt-generator" ? (
					<>
						<Field label="Domain" required>
							{(f) => (
								<Input {...f} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} size="lg" value={input} onChange={(e) => setInput(e.target.value)} placeholder="example.com" />
							)}
						</Field>
						<Field label="Site name">
							{(f) => (
								<Input
									{...f}
									type="text"
									size="lg"
									value={secondInput}
									onChange={(e) => setSecondInput(e.target.value)}
									placeholder="My Brand"
								/>
							)}
						</Field>
						<Field label="Short description">
							{(f) => (
								<Textarea
									{...f}
									rows={2}
									value={thirdInput}
									onChange={(e) => setThirdInput(e.target.value)}
									placeholder="What does your product or site do?"
								/>
							)}
						</Field>
					</>
				) : toolType === "bing-indexnow-submitter" ? (
					<>
						<Field label="Domain" required>
							{(f) => (
								<Input {...f} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} size="lg" value={input} onChange={(e) => setInput(e.target.value)} placeholder="example.com" />
							)}
						</Field>
						<Field label="IndexNow key" required hint="Hosted at https://your-domain/<key>.txt">
							{(f) => (
								<Input
									type="text"
									{...f}
									autoCapitalize="none"
									spellCheck={false}
									size="lg"
									className="font-mono"
									value={secondInput}
									onChange={(e) => setSecondInput(e.target.value)}
									placeholder="8 to 128 letters, numbers or dashes"
								/>
							)}
						</Field>
						<Field label="URLs to submit" required hint="One per line, up to 100, all on the same domain">
							{(f) => (
								<Textarea
									{...f}
									rows={4}
									inputMode="url"
									autoCapitalize="none"
									autoCorrect="off"
									spellCheck={false}
									className="font-mono"
									value={thirdInput}
									onChange={(e) => setThirdInput(e.target.value)}
									placeholder={"https://example.com/\nhttps://example.com/blog"}
								/>
							)}
						</Field>
					</>
				) : toolType === "bulk-index-checker" ? (
					<Field label="URLs to check" required hint="One per line, up to 20">
						{(f) => (
							<Textarea
								{...f}
								rows={5}
								inputMode="url"
								autoCapitalize="none"
								autoCorrect="off"
								spellCheck={false}
								className="font-mono"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder={"https://example.com/\nhttps://example.com/pricing\nhttps://example.com/about"}
							/>
						)}
					</Field>
				) : (
					<Field label={DOMAIN_TOOLS.includes(toolType) ? "Domain or URL" : "URL"} required>
						{(f) => (
							<Input
								type="text"
								{...f}
								inputMode="url"
								autoCapitalize="none"
								autoCorrect="off"
								spellCheck={false}
								size="lg"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder={placeholder || "https://example.com/page"}
							/>
						)}
					</Field>
				)}

				<div className="flex flex-wrap items-center gap-3">
					<Button type="submit" variant="primary" size="lg" loading={loading}>
						{buttonLabel}
					</Button>
					{result || error ? (
						<Button size="lg" variant="ghost" onClick={reset}>
							Reset
						</Button>
					) : null}
					<p className="text-sm text-muted">Free. No signup required.</p>
				</div>
			</form>

			{error ? (
				<div role="alert" className="mt-6 flex items-start gap-2 rounded-(--radius-input) bg-danger-wash px-4 py-3 text-danger">
					<CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
					<p className="min-w-0 text-sm font-medium break-words">{error}</p>
				</div>
			) : null}

			{result ? (
				<div className="mt-6 border-t border-border pt-6">
					<ToolResult toolType={toolType} result={result} headingRef={resultHeading} />
				</div>
			) : null}
		</Panel>
	);
}
