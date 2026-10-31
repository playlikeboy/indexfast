# Design: IndexFast

The locked system. Every Hallmark and Impeccable run reads this first, and every surface (marketing,
dashboard, admin, Stack Auth screens) shares it. Change it on purpose; the file is the rule.

## System

- Genre: modern-minimal
- Theme: Cobalt (Hallmark deal 1/3, seed `indexfast-agent-native-seo-indexing-5b49·0fa31046·2026-10-31·r0`), scaffolded with `theme.mjs scaffold cobalt --redesign full --scope app`
- Axes: light paper / grotesk-sans display / cool accent · posture: restrained · modes: light + dark
- Anti-reference: the retired brutalist look (acid-lime `#ccff00`, Geist, zero radius, uppercase tracked mono labels, highlighted words). Nothing new may bring any of it back.
- Character: an exact, technical register. Cool near-white paper ruled with hairlines, Familjen Grotesk heads over IBM Plex Sans, code on graphite, keycap buttons with a real bottom edge, panels cut on two opposite corners, one electric cobalt signal.

## Source of truth

`src/app/globals.css` is the only place a colour, face, size, radius, shadow or duration is defined.
Components reach tokens through Tailwind utilities (`bg-background`, `text-muted`, `font-display`,
`rounded-card`, `max-w-page`) or `var(--token)`. No literal colour, no `font-family`, no hex in a
`className` (`bg-[#...]`). The only exception is `src/components/ui/stack-theme.ts`, an sRGB mirror
for Stack Auth, whose colour parser reads neither `oklch()` nor `var()`; re-derive it when a token moves.

## Palette roles

| Role (utility) | Token | Use |
| --- | --- | --- |
| `background` / `surface` | `--color-paper` | Page ground; sticky chrome sits on it |
| `well` | `--color-paper-2` | A tinted region with no border (empty states, code header, hover) |
| `sunken` | `--color-paper-3` | Trays under keys, pressed and selected states |
| `panel` | `--color-panel` | Raised content inside a Panel; lighter than the ground in both modes |
| `foreground` / `ink` | `--color-ink` | Body text and every heading (one heading colour) |
| `ink-2` | `--color-ink-2` | Secondary text that still has to read as content |
| `muted` | `--color-muted` | Labels, hints, table heads, field edges (5.7:1 on paper) |
| `border` / `border-strong` | `--color-rule` / `--color-rule-2` | Hairlines between rows and around surfaces; strong under table heads |
| `accent` / `signal` | `--color-accent` | The one primary action, focus, current selection, live state, links on hover |
| `accent-foreground` | `--color-accent-ink` | Text on a cobalt fill |
| `accent-wash` | `--color-accent-wash` | One highlighted row in a table, never a section band |
| `danger`, `warning`, `success` | `--color-error`, `--color-warning`, `--color-success` | Status text and its icon; `*-wash` only behind one row or one message |
| `code-bg`, `code-bg-2`, `code-fg`, `code-muted`, `code-accent` | graphite family | Code, commands, API responses, terminal output |
| `chart-1..3` | `--color-chart-*` | Series colours; series 1 is the signal |

Cobalt stays under 5% of any screen. Never a warm accent, a gradient button, a purple-to-blue
gradient, or red and green as the only signal.

## Type

- Display: Familjen Grotesk 600 for heads and figures, 500 for item titles and labels on controls; tracking `-0.028em`, line-height 1.02 to 1.05, sentence case, `text-wrap: balance`.
- Body: IBM Plex Sans 400 and 500, 16px minimum, line-height 1.55, measure 45 to 75ch.
- Code and machine values: JetBrains Mono, only for code, keys, URLs, hashes and measured figures; never a label, heading or chip.
- Labels, table heads, captions, nav links: the body face a step smaller (`text-sm`), `text-muted`, sentence case, untracked. Never uppercase tracked labels, never mono labels.
- Scale (Persuade, marketing): 1.25 ratio from 16px; roles `text-display` (fluid to 84px), `text-display-s`, `text-section` (h2), `text-title` (h3), `text-lead`.
- Scale (Operate, app): put `data-scope="app"` on the app shell root and the same utilities resolve to a fixed 1.2 ratio (page title 1.728rem, section 1.2rem). No fluid heads in the app.
- Figures that compare use tabular numerals (`.num`, Stat, numeric table cells).

## Space, radius, depth, layers

- Space: `--space-3xs` 2px, `2xs` 4, `xs` 8, `sm` 12, `md` 16, `lg` 24, `xl` 40, `2xl` 64, `3xl` 96, `4xl` 144. In Tailwind these are `gap-0.5/1/2/3/4/6/10/16/24/36`. Never an off-scale length.
- Containers: `max-w-page` (1440px, marketing) and `max-w-app` (1200px, dashboard and admin), centred, padded by `--gutter` (64 / 24 / 16px). At 1920 the gutters grow; the grid does not.
- Section rhythm: `--section-gap-s`, `--section-gap`, `--section-gap-l` (Section helper).
- Radius: `--radius-card` 8px (panels), `--radius-input` 6px (fields, keys); cut corners via `corner-shape` where supported. No pills on buttons.
- Depth: hairlines first, then a paper step, then a cut Panel. A surface has a border or a shadow, never both. Only keys carry an edge shadow. Dark mode has no drop shadows.
- Z: base 1, raised 10, dropdown 100, sticky 200, sticky-nav 300, modal 400, toast 500, tooltip 600.

## Motion

Brisk and functional. `--dur-micro` 120ms (press, colour), `--dur-short` 220ms (hover, menus),
`--dur-long` 420ms (dialogs, drawers). `--ease-out` for arrivals, `--ease-in` for exits. Animate
`transform` and `opacity` only; never `transition: all`, never width, height, top or left. Keys lift
1px on hover and sink on press. At most one reveal per marketing page, visible without script; none
in the app. Under `prefers-reduced-motion` every transition ends at once (global rule in globals.css);
a loader that must still turn takes `.keep-motion`.

## Components (`@/components/ui`)

| Component | Use it for | Notes |
| --- | --- | --- |
| `Button`, `buttonClass()` | Every action; `buttonClass` dresses a `Link` | `primary` once per screen (dialogs count as their own screen); `secondary` default; `ghost` for toolbars and tertiary actions; `danger` for destructive actions unless deleting is the page's one job. Sizes: `lg` 48px marketing, `md` 40px and `sm` 32px app (44px hit target kept). `loading` sets `aria-busy` and keeps the label. |
| `Field` + `Input` / `Textarea` / `Select` | Every form control | Field renders the label, the hint, and the error in the same reserved line, and passes `id`, `aria-describedby`, `aria-invalid` to the control. Match the input height to the button beside it (`size="lg"` with a `lg` key). Native select with a drawn chevron. |
| `Panel` | Content that is independently interactive or of a different kind | Cut corners, hairline edge, optional header (title, one-line description, actions). Never a Panel inside a Panel; split inside with hairlines. |
| `Status` | Live state of a site, URL, job or engine answer | Text plus one icon in the tone colour. Never a filled chip, never a dot. |
| `Badge` | Names and categories (plan, engine, scope) | Quiet cut tag; not for state. |
| `Table`, `Th`, `Td` | Lists of URLs, jobs, submissions, payments | Tables before cards in the app. Horizontal rules only, heads never wrap, `numeric` for figures. Scrolls in its own region on narrow screens. |
| `Stat` | One real computed figure | Top hairline between siblings; no icon tiles, no invented trend arrows. |
| `CodeBlock` | Commands, MCP config, API examples, key files | Graphite panel, real filename or language as title, working copy with a live result. Snippets must run; use `example.com` when no host exists. |
| `Keycap` | Keyboard shortcuts | Not a control. |
| `Tabs` | Switching views inside one screen | Roving tabindex, arrow keys, Home and End, `aria-controls`. When the view must be linkable (the site page `?view=`), use links with `aria-current="page"` instead: state that matters lives in the URL. |
| `EmptyState` | Any data region with nothing in it | What is empty, why it matters, the one action that fills it. |
| `Container`, `Stack`, `Section` | Page structure | One container recipe per surface, one spacing scale. |

Every region that loads data has four states: loading (skeleton in the shape of what is coming),
empty (`EmptyState`), error (what broke and what to do), and full.

## Persuade (web) vs Operate (app)

- **Marketing (Persuade).** One idea per screen. Hero: a headline of seven words or fewer, one sentence of twelve words or fewer, one or two actions, all visible at 1280 x 800. About 80 words per screen. Show the real product (dashboard captures, real engine responses, real CLI output on graphite), never a drawn browser window. Section heads say what the reader gets, never a category label like "Features". Proof only from material we have: no invented metrics, testimonials, logos or case studies.
- **App (Operate).** The tool disappears into the task. `data-scope="app"` on the shell, `max-w-app`, controls 32 to 40px, tables before cards, accent only for the primary action, focus and current state. The signature object is the submission queue: every URL, which engine got it, and what the engine answered. No greeting above stat cards, no decorative motion, a destructive action is confirmed or undoable.

## Dark mode

Class-based: the no-FOUC script in `layout.tsx` sets `.dark` on `<html>` from `localStorage.theme`
or the OS preference; `@custom-variant dark` keeps `dark:` utilities working. Dark is a re-derived
token set (`--dark-*` in `:root`, swapped in by `.dark`), never an inversion: paper L16, ink L94,
cards lighter than the ground, accent lighter and less saturated with dark text on it, no drop
shadows, hue never moves. Use semantic utilities and dark mode comes for free; reach for `dark:`
only for imagery.

## Do

- Use the semantic utilities and the primitives; add a token here before using a new value anywhere.
- Give every interactive element a visible `:focus-visible` ring (global default; do not remove it).
- Keep `overflow-x: clip` on html and body (global); use `min-w-0` on flex and grid children that hold text.
- Use `minmax(0, 1fr)` for grid tracks that hold images or code.
- Write like a changelog: the event, the endpoint, the status code. Never imply guaranteed Google indexing.

## Don't

- No eyebrows, no uppercase tracked labels, no small caps, no mono labels.
- No one italic, coloured or highlighted word inside a heading.
- No middle-dot meta strings, arrows glued to link text, decorative status dots, emoji icons.
- No card inside a card, no purple-to-blue gradient, no glow shadows, no hand-drawn browser or OS window.
- No `transition: all`, no animated width/height/top/left, no parallax, no bounce.
- No invented metric, testimonial, customer logo or case study.

## Legacy (delete after migration)

`label-mono`, `display`, `stat`, `text-highlight`, `bg-grid`, the `--app-*` and `--chart-*` variables
and the `card`, `card-hover`, `accent-dark` utilities still compile, re-pointed at Cobalt and
neutralised toward the rules above (labels lose capitals and tracking; `text-highlight` no longer
highlights). They live in the marked block at the end of `globals.css`. Migrate pages to
`@/components/ui`, then delete the block.

## Exports

`src/app/globals.css` in this project (Tailwind v4: raw tokens in `@theme static`, semantic roles in
`@theme inline`). DTCG or shadcn blocks are added here on request.
