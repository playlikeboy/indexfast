"use client";

/*
 * The Cobalt ASCII field for the landing hero: the product's own traffic drawn in characters on an
 * 8 x 16 cell. Raw sitemap noise on the left resolves into one lane per destination on the right,
 * and each lane carries real IndexFast paths moving toward its engine. It is a diagram of the
 * submission pipeline, not decoration, so lanes are passed in by the caller and match the labels.
 * Rules it keeps: colours come only from CSS tokens (re-read when the theme class flips), it runs
 * at about 30 fps only while on screen and the tab is visible, and under reduced motion it paints
 * one still frame. Without script the parent's dot grid shows instead.
 */
import { useEffect, useRef } from "react";

const CELL_W = 8;
const CELL_H = 16;
const FRAME_MS = 1000 / 30;
const RAMP = " .:-=+*#%";
// Real paths on indexfast.co, so the stream shows traffic the product actually handles.
const PATHS = "/blog/indexnow-key-setup /tools/sitemap-url-extractor /resources/directories /pricing /blog/find-unindexed-pages /tools/robots-txt-checker /resources/search-engines /blog/pseo-pages-not-ranking ";

type Palette = { tints: string[]; lane: string; font: string };

function readPalette(el: Element): Palette {
	const style = getComputedStyle(el);
	const token = (name: string) => style.getPropertyValue(name).trim();
	return {
		tints: [token("--color-glyph-1"), token("--color-glyph-2"), token("--color-glyph-3"), token("--color-glyph-4")],
		lane: token("--color-accent-deep"),
		font: `${CELL_H * 0.75}px ${token("--font-outlier") || "monospace"}`,
	};
}

// Cheap smooth value noise: hashed lattice values, smoothstep-blended.
function hash(x: number, y: number): number {
	const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
	return s - Math.floor(s);
}

function noise(x: number, y: number): number {
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const xf = x - xi;
	const yf = y - yi;
	const u = xf * xf * (3 - 2 * xf);
	const v = yf * yf * (3 - 2 * yf);
	const top = hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u;
	const bottom = hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u;
	return top * (1 - v) + bottom * v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function drawFrame(ctx: CanvasRenderingContext2D, width: number, height: number, laneCount: number, t: number, palette: Palette) {
	const cols = Math.floor(width / CELL_W);
	const rows = Math.floor(height / CELL_H);
	ctx.clearRect(0, 0, width, height);
	ctx.font = palette.font;
	ctx.textBaseline = "top";
	const laneRows = Array.from({ length: laneCount }, (_, i) => Math.floor(((i + 0.5) / laneCount) * rows));
	const shift = Math.floor(t * 9);

	for (let r = 0; r < rows; r++) {
		const laneIndex = laneRows.indexOf(r);
		for (let c = 0; c < cols; c++) {
			const xn = c / cols;
			// How "resolved" this column is: scattered on the left, lanes only on the right.
			const resolve = smoothstep(0.18, 0.72, xn);
			const raw = noise(c * 0.14 - t * 1.1, r * 0.32 + t * 0.15);
			const x = c * CELL_W;
			const y = r * CELL_H;

			if (laneIndex >= 0 && xn > 0.3) {
				const ch = PATHS[(((c - shift + laneIndex * 41) % PATHS.length) + PATHS.length) % PATHS.length];
				if (ch === " ") continue;
				ctx.fillStyle = xn > 0.62 ? palette.lane : palette.tints[3];
				ctx.fillText(ch, x, y);
				continue;
			}

			const density = raw * (1 - resolve) * 0.95 + raw * resolve * 0.28;
			const step = Math.floor(density * RAMP.length);
			if (step <= 1) continue;
			const ch = RAMP[Math.min(step, RAMP.length - 1)];
			ctx.fillStyle = palette.tints[Math.min(3, Math.floor(density * 4.2))];
			ctx.fillText(ch, x, y);
		}
	}
}

export function AsciiField({ laneCount, className }: { laneCount: number; className?: string }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;

		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
		let palette = readPalette(canvas);
		let width = 0;
		let height = 0;
		let frame = 0;
		let last = 0;
		let visible = true;
		const start = performance.now();

		const paint = (now: number) => drawFrame(ctx, width, height, laneCount, (now - start) / 1000, palette);

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			width = rect.width;
			height = rect.height;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			paint(reduced.matches ? start + 4000 : performance.now());
		};

		const loop = (now: number) => {
			frame = 0;
			if (!visible || document.hidden || reduced.matches) return;
			if (now - last >= FRAME_MS) {
				last = now;
				paint(now);
			}
			frame = requestAnimationFrame(loop);
		};
		const run = () => {
			if (!frame && visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(loop);
		};

		const sizeObserver = new ResizeObserver(resize);
		sizeObserver.observe(canvas);
		const viewObserver = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			run();
		});
		viewObserver.observe(canvas);
		// The theme toggle flips a class on <html>; re-read the tokens so dark mode re-tints the field.
		const themeObserver = new MutationObserver(() => {
			palette = readPalette(canvas);
			paint(performance.now());
		});
		themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
		const onVisibility = () => run();
		document.addEventListener("visibilitychange", onVisibility);
		reduced.addEventListener("change", resize);
		// Cover the no-script dot grid only once the field can actually draw.
		canvas.style.background = "var(--color-panel)";
		run();

		return () => {
			cancelAnimationFrame(frame);
			sizeObserver.disconnect();
			viewObserver.disconnect();
			themeObserver.disconnect();
			document.removeEventListener("visibilitychange", onVisibility);
			reduced.removeEventListener("change", resize);
		};
	}, [laneCount]);

	return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
