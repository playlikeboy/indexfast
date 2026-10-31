/*
 * Hero visual: the submission pipeline as an ASCII field. Lanes on the canvas line up with the
 * destination labels on the right, so the list here is the single source for both. Only engines
 * IndexFast really submits to are named: the IndexNow network (shared with every participant) and
 * Bing's Webmaster API, labelled as a paid-plan lane because it needs Pro or Unlimited and the
 * user's own key. Google is deliberately absent: it does not take IndexNow, and the page never
 * implies Google indexing. Other paid channels (Yandex recrawl, Baidu push, Search Console) are
 * listed in SearchEnginesShowcase rather than drawn here.
 */
import { AsciiField } from "./AsciiField";

const LANES = [
	...["Bing", "Yandex", "Naver", "Seznam", "Yep"].map((engine) => ({ engine, channel: "IndexNow" })),
	{ engine: "Bing", channel: "Webmaster API (Pro)" },
];

// The 8 x 16 cell as a dot grid: what the field shows when script is off.
const dotGrid = {
	backgroundImage: "radial-gradient(var(--color-glyph-2) 1px, transparent 1.5px)",
	backgroundSize: "8px 16px",
};

export function EngineField() {
	return (
		<figure
			className="ui-cut grid h-96 min-w-0 grid-cols-[minmax(0,1fr)_auto] overflow-hidden bg-panel lg:h-[512px]"
			aria-label="Diagram: URLs from your sitemap flow to IndexNow, which shares them with Bing, Yandex, Naver, Seznam and Yep, and, on Pro and Unlimited, to the Bing Webmaster API"
		>
			<div className="relative min-w-0" style={dotGrid}>
				<AsciiField laneCount={LANES.length} className="absolute inset-0 size-full" />
				<span className="absolute top-3 left-4 bg-panel px-1 font-mono text-xs text-ink-2">sitemap.xml</span>
			</div>
			<ul className="grid border-l border-border bg-panel" style={{ gridTemplateRows: `repeat(${LANES.length}, minmax(0, 1fr))` }}>
				{LANES.map((lane) => (
					<li key={lane.engine + lane.channel} className="flex flex-col justify-center border-b border-border px-4 last:border-b-0 sm:px-5">
						<span className="font-display text-md leading-tight font-medium text-ink">{lane.engine}</span>
						<span className="text-sm leading-tight text-muted">{lane.channel}</span>
					</li>
				))}
			</ul>
		</figure>
	);
}
