# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary (inferred, user delegated the choice on 2026-11-01): indie developers and "vibe coders" who ship sites fast (Next.js, AI-built apps, programmatic SEO) and find their new pages are not discovered or indexed. They want to add a domain, host one key file, and leave the rest on autopilot.

Secondary: AI agents in Claude Code, Cursor and similar IDEs that run indexing work through the MCP server, REST API, CLI or the downloadable SKILL.md on a human's behalf; and SEO operators or agencies managing several sites who need queue visibility and diagnostics.

## Product Purpose

IndexFast finds pages search engines have not picked up, diagnoses technical blockers, and pushes URLs into legitimate discovery channels (IndexNow, Bing Webmaster API, Google Search Console, and other official engine APIs). Success means a site owner's new and changed URLs reach every engine that accepts them, with an honest record of what was sent and what each engine answered.

## Positioning

Agent-native (confirmed by the user). IndexFast is built to be driven by AI agents as a first-class surface: an authenticated MCP server on every plan, a REST API with scoped keys, a CLI, and a SKILL.md agents can install. A human sets it up once; an agent can run indexing operations end to end.

## Operating Context

- Setup: add a domain, IndexFast generates an IndexNow key; the user hosts `https://<host>/<key>.txt`; fetching that file is the ownership proof.
- Background: an hourly Cloudflare Worker cron syncs sitemaps and drains a submission queue with throttle-aware retries.
- Agents connect with an `idxf_` API key in their MCP client config.
- Billing: Razorpay prepaid 30-day plans (Free, Pro $19, Unlimited $99), read from `src/lib/platform/plans.ts`.

## Capabilities and Constraints

- Never guarantees Google indexing. Google's Indexing API is used only for eligible JobPosting and livestream BroadcastEvent pages, per Google's policy.
- Nothing is submitted for a site whose ownership is not verified.
- No black-hat or grey-hat techniques; no silent submission to third-party directories without an official API.
- Runtime: Cloudflare Workers (128 MB, short CPU budgets), Neon Postgres over HTTP, Next.js 16 App Router, Tailwind CSS v4.
- Free public SEO tools exist under `/tools/*` and need no signup.

## Brand Commitments

- Name: IndexFast. Domain: indexfast.co.
- Logo files: `public/logo.png`, `public/logo-mark.png`.
- The previous brutalist look (acid-lime #ccff00, Geist, zero radius) is retired by the user's request on 2026-11-01; treat it as an anti-reference.
- Voice: plain, technical, honest about limits.

## Evidence on Hand

- Product screenshots: capture from the running dashboard (none committed yet).
- Video: `public/IndexFast-Editorial-v2.mp4`.
- Real engine documentation and limits in `src/lib/resources/search-engines.ts`.
- Absent, must not be fabricated: testimonials, customer logos, usage or performance statistics, case studies.

## Product Principles

1. Agents are users. Every capability a human gets in the dashboard is reachable by an agent through MCP or API.
2. Honest by default. Show exactly what was sent, to which engine, and what it answered; never imply a guarantee.
3. Zero-config first. The default path is one input and one key file; everything else is optional depth.
4. Safe at scale. Respect engine rate limits and policies even when that means waiting.
