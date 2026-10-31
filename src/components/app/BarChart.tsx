"use client";

/**
 * Daily bar chart for the admin panel. Single series, so no legend: the panel title names
 * it. Thin bars with rounded tops and a 2px gap, recessive axis, hover tooltip with a hit
 * area taller than the bar, and a data table fallback under <details>.
 * The SVG holds only the bars and stretches to its box (preserveAspectRatio none), so a narrow
 * panel never letterboxes it; axis labels are HTML so they keep a readable size at any width.
 * Numbers format with a fixed "en-US" locale: server and browser locales differ, and an
 * unpinned toLocaleString() makes the hydrated text disagree with the server render.
 */
import { useState } from "react";

const formatNumber = new Intl.NumberFormat("en-US").format;

export function BarChart({
	data,
	valueLabel,
	color = "var(--color-chart-1)",
}: {
	data: Array<{ day: string; value: number }>;
	valueLabel: string;
	color?: string;
}) {
	const [hover, setHover] = useState<number | null>(null);
	const width = 720;
	const height = 180;
	const pad = { top: 12, bottom: 1 };
	const max = Math.max(1, ...data.map((point) => point.value));
	const slot = width / Math.max(1, data.length);
	const barWidth = Math.max(2, slot - 2);
	const plotHeight = height - pad.top - pad.bottom;
	const active = hover !== null ? data[hover] : null;
	const total = data.reduce((sum, point) => sum + point.value, 0);
	// Keep the tooltip inside the panel at both ends of the axis.
	const tooltipAlign = hover === null ? "" : hover < data.length * 0.2 ? "translate-x-0" : hover > data.length * 0.8 ? "-translate-x-full" : "-translate-x-1/2";

	return (
		<div className="min-w-0">
			<div className="relative">
				<svg
					viewBox={`0 0 ${width} ${height}`}
					className="block h-44 w-full"
					preserveAspectRatio="none"
					role="img"
					aria-label={`${formatNumber(total)} ${valueLabel} over ${data.length} days`}
					onMouseLeave={() => setHover(null)}
				>
					<line x1={0} x2={width} y1={height - pad.bottom} y2={height - pad.bottom} stroke="var(--color-border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
					{data.map((point, index) => {
						const barHeight = point.value === 0 ? 0 : Math.max(2, (point.value / max) * plotHeight);
						const x = index * slot + 1;
						const y = height - pad.bottom - barHeight;
						const radius = Math.min(3, barWidth / 2, barHeight);
						return (
							<g key={point.day} onMouseEnter={() => setHover(index)}>
								<rect x={x - 1} y={pad.top} width={slot} height={plotHeight} fill="transparent" />
								{barHeight > 0 ? (
									<path
										d={`M${x},${y + barHeight} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + barWidth - radius} Q${x + barWidth},${y} ${x + barWidth},${y + radius} V${y + barHeight} Z`}
										fill={color}
										opacity={hover === null || hover === index ? 1 : 0.45}
									/>
								) : null}
							</g>
						);
					})}
				</svg>
				{active && hover !== null ? (
					<div
						className={`pointer-events-none absolute top-0 rounded-(--radius-input) border border-border bg-panel px-2 py-1 text-sm whitespace-nowrap ${tooltipAlign}`}
						style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
					>
						<span className="num text-muted">{active.day}</span> <span className="num font-medium text-ink">{formatNumber(active.value)}</span>{" "}
						<span className="text-muted">{valueLabel}</span>
					</div>
				) : null}
			</div>
			{data.length ? (
				<div className="num mt-1 flex justify-between text-sm text-muted" aria-hidden="true">
					<span>{data[0].day.slice(5)}</span>
					{data.length > 2 ? <span>{data[Math.floor(data.length / 2)].day.slice(5)}</span> : null}
					{data.length > 1 ? <span>{data[data.length - 1].day.slice(5)}</span> : null}
				</div>
			) : null}
			<details className="mt-2 text-sm text-muted">
				<summary className="cursor-pointer">Show as table</summary>
				<table className="mt-2 w-full max-w-xs">
					<tbody>
						{data.map((point) => (
							<tr key={point.day} className="border-b border-border">
								<td className="num py-1">{point.day}</td>
								<td className="num py-1 text-right text-ink">{formatNumber(point.value)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
		</div>
	);
}
