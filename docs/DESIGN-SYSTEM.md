# IndexFast Design System

Canonical tokens live in `src/app/globals.css` (Tailwind v4 `@theme`) and fonts in
`src/app/layout.tsx` (Geist Sans + Geist Mono via `next/font/google`).
This document names the system so marketing, social and product surfaces stay consistent.
If this file and `globals.css` ever disagree, `globals.css` wins.

## Colour

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--background` / `--surface` | `#F2F1EC` | `#0A0A0A` | Page surface |
| `--foreground` / `--ink` | `#0A0A0A` | `#F2F1EC` | Primary text |
| `--card` | `#ECEBE4` | `#161614` | Panels |
| `--card-hover` | `#E4E3DA` | `#1F1F1C` | Panel hover |
| `--muted` | `#8A8A80` | `#8F8F86` | Secondary text |
| `--border` | `#D8D7CF` | `#2A2A26` | Hairlines |
| `--grid-line` | `rgba(10,10,10,0.04)` | `rgba(242,241,236,0.05)` | 64px grid (`.bg-grid`) |
| `--color-accent` | `#CCFF00` | `#CCFF00` | Acid lime — identical in both themes |
| `--color-accent-dark` | `#B3E600` | `#B3E600` | Pressed/secondary lime |
| `--color-accent-foreground` | `#0A0A0A` | `#0A0A0A` | Text on lime |

Rules:
- Lime is scarce: one primary action, one highlighted phrase, or one status system per view.
- Never put lime body text on the light surface; black text goes on lime blocks.
- No gradients and no additional brand hues. Status colours live in the app tokens
  (`--app-ok`, `--app-warn`, `--app-bad`) and are for product UI states only.

## Typography

- Display (`.display`): Geist Sans, weight 800, uppercase, `letter-spacing: -0.04em`,
  `line-height: 0.92`.
- Stats (`.stat`): same treatment with tabular numerals.
- Labels (`.label-mono`): Geist Mono, uppercase, `letter-spacing: 0.12em`, muted colour.
- Body: Geist Sans with system fallbacks, antialiased.
- Highlight (`.text-highlight`): solid accent block behind black text for a single phrase.

## Shape & layout

- `--radius: 0px` — sharp, brutalist edges on marketing surfaces. The app (dashboard/admin)
  deliberately uses the calmer `--app-*` tokens instead; do not mix the two languages.
- Marketing pages sit on the faint 64px grid (`.bg-grid`).
- Panels are flat: card token + 1px border token, no decorative shadows.
- Brand mark: 2x2 squares — three foreground squares, one accent square (top right).

## Social / off-site surfaces

Social creatives (Instagram posts, reels, stories, covers) use the dark marketing tokens
above unchanged: `#0A0A0A` background with the 64px grid, `#F2F1EC` display type,
`#CCFF00` highlight blocks with black text, Geist Mono-style labels, sharp corners, and an
`indexfast.co` footer lockup (no social handle watermark). Local rendering fallbacks when
Geist is unavailable: a heavy grotesque (e.g. Noto Sans Black) for display and a mono
(e.g. Noto Sans Mono) for labels, preserving the same layout rules.
