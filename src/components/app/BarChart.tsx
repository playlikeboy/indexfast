"use client";

/**
 * Daily bar chart for the admin panel. Single series, so no legend: the card title names
 * it. Thin bars with rounded tops and a 2px gap, recessive axis, hover tooltip with a hit
 * area taller than the bar, and a data table fallback under <details>.
 */
import { useState } from "react";

export function BarChart({ data, valueLabel }: { data: Array<{ day: string; value: number }>; valueLabel: string }) {
	const [hover, setHover] = useState<number | null>(null);
	const width = 720;
	const height = 180;
	const pad = { top: 12, bottom: 22, left: 0, right: 0 };
	const max = Math.max(1, ...data.map((point) => point.value));
	const slot = (width - pad.left - pad.right) / Math.max(1, data.length);
	const barWidth = Math.max(2, slot - 2);
	const plotHeight = height - pad.top - pad.bottom;
	const active = hover !== null ? data[hover] : null;

	return (
		<div>
			<div className="relative">
				<svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label={`${valueLabel} per day`} onMouseLeave={() => setHover(null)}>
					<line x1={0} x2={width} y1={height - pad.bottom} y2={height - pad.bottom} stroke="var(--app-border)" strokeWidth={1} />
					{data.map((point, index) => {
						const barHeight = point.value === 0 ? 0 : Math.max(2, (point.value / max) * plotHeight);
						const x = pad.left + index * slot + 1;
						const y = height - pad.bottom - barHeight;
						const radius = Math.min(4, barWidth / 2, barHeight);
						return (
							<g key={point.day} onMouseEnter={() => setHover(index)}>
								<rect x={x - 1} y={pad.top} width={slot} height={plotHeight} fill="transparent" />
								{barHeight > 0 ? (
									<path
										d={`M${x},${y + barHeight} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + barWidth - radius} Q${x + barWidth},${y} ${x + barWidth},${y + radius} V${y + barHeight} Z`}
										fill="var(--chart-1)"
										opacity={hover === null || hover === index ? 1 : 0.45}
									/>
								) : null}
							</g>
						);
					})}
					{[0, Math.floor(data.length / 2), data.length - 1].map((index) =>
						data[index] ? (
							<text key={index} x={pad.left + index * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--app-muted)">
								{data[index].day.slice(5)}
							</text>
						) : null,
					)}
				</svg>
				{active && hover !== null ? (
					<div
						className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-xs shadow-sm"
						style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
					>
						<span className="text-[var(--app-muted)]">{active.day}</span> <span className="font-semibold tabular-nums">{active.value.toLocaleString()}</span> {valueLabel}
					</div>
				) : null}
			</div>
			<details className="mt-2 text-xs text-[var(--app-muted)]">
				<summary className="cursor-pointer">Show as table</summary>
				<table className="mt-2 w-full max-w-xs">
					<tbody>
						{data.map((point) => (
							<tr key={point.day}>
								<td className="py-0.5">{point.day}</td>
								<td className="py-0.5 text-right tabular-nums text-[var(--app-text)]">{point.value.toLocaleString()}</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
		</div>
	);
}
