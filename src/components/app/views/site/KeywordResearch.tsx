"use client";

/**
 * Keyword research form and result table. Results live only in client state (they are cached
 * server-side for 24h, so re-running the same query is free); the user picks rows and saves them
 * to the site's keyword list. The credit estimate is shown before the button is pressed, and the
 * actual charge (or "cached") is shown after, so spend is never a surprise.
 */
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { researchKeywordsAction, saveKeywordsAction, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/app/client";
import { showToast } from "@/components/app/toast";
import { Button, EmptyState, Field, Input, Select, Table, Td, Th } from "@/components/ui";
import type { KeywordRow } from "@/lib/providers/dataforseo/labs";

type Option = { code: number; name: string };
type ResearchData = { rows: KeywordRow[]; credits: number; cached: boolean; locationCode: number; languageCode: string };

const LIMITS = [25, 50, 100, 200];
const MODES = [
	{ id: "suggestions", label: "Contain the seed" },
	{ id: "related", label: "Related searches" },
	{ id: "ideas", label: "Same topic" },
];

function fmt(value: number | null, digits = 0) {
	return value === null ? "-" : value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function KeywordResearch({ siteId, locations, languages, estimates, disabledReason }: { siteId: string; locations: readonly Option[]; languages: readonly string[]; estimates: Record<number, number>; disabledReason: string | null }) {
	const [state, dispatch, pending] = useActionState(researchKeywordsAction.bind(null, siteId), null as ActionResult);
	const [limit, setLimit] = useState(50);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [saving, setSaving] = useState(false);
	const data = state?.ok ? (state.data as unknown as ResearchData) : null;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		setSelected(new Set());
		startTransition(() => dispatch(form));
	}

	function toggle(keyword: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(keyword)) next.delete(keyword);
			else next.add(keyword);
			return next;
		});
	}

	async function save() {
		if (!data || selected.size === 0) return;
		setSaving(true);
		const result = await saveKeywordsAction(siteId, { keywords: data.rows.filter((row) => selected.has(row.keyword)), locationCode: data.locationCode, languageCode: data.languageCode });
		setSaving(false);
		if (result) showToast(result.ok, (result.ok ? result.message : result.error) ?? "");
		if (result?.ok) setSelected(new Set());
	}

	return (
		<div className="flex flex-col gap-5">
			<form onSubmit={submit} className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] lg:items-start">
				<Field label="Seed keyword" required>
					{(control) => <Input {...control} name="keyword" maxLength={80} placeholder="e.g. seo indexing" autoComplete="off" />}
				</Field>
				<Field label="Match">
					{(control) => (
						<Select {...control} name="mode" defaultValue="suggestions">
							{MODES.map((mode) => (
								<option key={mode.id} value={mode.id}>
									{mode.label}
								</option>
							))}
						</Select>
					)}
				</Field>
				<Field label="Market">
					{(control) => (
						<Select {...control} name="locationCode" defaultValue="2840">
							{locations.map((location) => (
								<option key={location.code} value={location.code}>
									{location.name}
								</option>
							))}
						</Select>
					)}
				</Field>
				<Field label="Language">
					{(control) => (
						<Select {...control} name="languageCode" defaultValue="en">
							{languages.map((language) => (
								<option key={language} value={language}>
									{language}
								</option>
							))}
						</Select>
					)}
				</Field>
				<Field label="Rows" hint={`Up to ${estimates[limit] ?? "?"} credits`}>
					{(control) => (
						<Select {...control} name="limit" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
							{LIMITS.map((value) => (
								<option key={value} value={value}>
									{value}
								</option>
							))}
						</Select>
					)}
				</Field>
				<div className="flex flex-col gap-1.5 lg:pt-[1.625rem]">
					<Button type="submit" variant="primary" loading={pending} disabled={pending || Boolean(disabledReason)}>
						{pending ? "Researching..." : "Research"}
					</Button>
				</div>
			</form>
			{disabledReason ? <p className="text-sm text-muted">{disabledReason}</p> : null}
			{state && !state.ok ? <ResultMessage result={state} /> : null}

			{data ? (
				data.rows.length === 0 ? (
					<EmptyState title="No keywords found" description="DataForSEO has no data for this seed in this market. Try a broader seed or another match type." />
				) : (
					<div className="flex flex-col gap-3">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<p className="text-sm text-muted" role="status">
								{data.rows.length} keywords, {data.cached ? "from cache (0 credits)" : `${data.credits} credit${data.credits === 1 ? "" : "s"} used`}.
							</p>
							<Button variant="secondary" onClick={save} loading={saving} disabled={selected.size === 0 || saving}>
								Save {selected.size > 0 ? selected.size : ""} to list
							</Button>
						</div>
						<div className="overflow-x-auto rounded-card border border-border">
							<Table caption="Keyword research results">
								<thead>
									<tr>
										<Th className="w-10 pl-4">
											<span className="visually-hidden">Select</span>
										</Th>
										<Th className="w-full">Keyword</Th>
										<Th className="text-right">Volume</Th>
										<Th className="text-right">KD</Th>
										<Th className="text-right">CPC (USD)</Th>
										<Th className="pr-4">Intent</Th>
									</tr>
								</thead>
								<tbody>
									{data.rows.map((row) => (
										<tr key={row.keyword}>
											<Td className="pl-4">
												<input type="checkbox" className="size-4 accent-(--color-signal)" checked={selected.has(row.keyword)} onChange={() => toggle(row.keyword)} aria-label={`Select ${row.keyword}`} />
											</Td>
											<Td className="max-w-0 min-w-48">
												<span className="block truncate" title={row.keyword}>
													{row.keyword}
												</span>
											</Td>
											<Td className="num text-right">{fmt(row.searchVolume)}</Td>
											<Td className="num text-right">{fmt(row.keywordDifficulty)}</Td>
											<Td className="num text-right">{fmt(row.cpc, 2)}</Td>
											<Td className="pr-4 text-muted capitalize">{row.intent === "unknown" ? "-" : row.intent}</Td>
										</tr>
									))}
								</tbody>
							</Table>
						</div>
					</div>
				)
			) : null}
		</div>
	);
}
