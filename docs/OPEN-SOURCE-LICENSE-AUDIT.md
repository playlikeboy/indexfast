# Open-source license audit

Purpose: this document lists every external source and candidate dependency for the SEO platform
work, its license, the exact copyright line, how we may reuse it, and what we owe in return.
IndexFast is a proprietary network service, so copyleft licenses matter even without
distributing binaries. The root file `THIRD_PARTY_NOTICES.md` holds the notice text for anything
copied; this document is the policy behind it. Licenses were read from each repo's `LICENSE`
file (or `Cargo.toml`/`package.json` where noted) on 2026-11-21. Re-check a license before
copying from a newer commit.

This is an engineering record, not legal advice.

---

## 1. Reuse modes

| Mode | Meaning | Obligation |
|---|---|---|
| Copy-adapt | Source code copied into `src/` and changed | Keep copyright line and permission notice in a header comment of each copied file, plus an entry in `THIRD_PARTY_NOTICES.md` |
| Install | Added to `package.json` as a dependency | License ships in `node_modules`; list notable ones in `THIRD_PARTY_NOTICES.md`; Apache-2.0 NOTICE files are kept if present |
| Reimplement | Our own code written from an idea, public docs, or check names | None legally; keep a clean-room note for AGPL sources (who read what, and that no code was copied) |
| Data | A data file copied | As the data license says |
| Skip | Not used | - |

---

## 2. Primary sources

| Source | License | Copyright line (verbatim) | Reuse mode | What we take | Obligations |
|---|---|---|---|---|---|
| OpenSEO (github.com/every-app/open-seo, `af3f995f`) | MIT | "Copyright (c) 2026 Ben Senescu" | Copy-adapt | DataForSEO fetchers, envelope, pricing math, metered-client pattern; crawler page analyzer, issue checks, discovery, URL policy, crawl throttle; keyword, domain, backlinks, rank tracking, AI visibility services; selected Postgres Drizzle tables; GSC and GA4 clients | MIT header per copied file; `THIRD_PARTY_NOTICES.md` entry; do not use the "OpenSEO" brand name |
| OpenSEO `.agents/skills/deslop` | MIT | "Copyright (c) 2026 Stephen D. Turner" | Skip | - | - |
| CrawlSEO | MIT | "Copyright (c) 2026 crawlseo" | Copy-adapt | `robots.ts` policy wrapper, `noindex.ts`, `issuesFromPage` rules, content score, remediation text, `aggregate.ts`, opportunity math (CTR curve, striking distance, low CTR, decay, cannibalization), alert rules, PSI parsing, MCP text formatters, CSV injection guard | MIT header; `THIRD_PARTY_NOTICES.md` entry |
| SerpBear | MIT | "Copyright (c) 2022 Amruth Pillai" (kept exactly as written, although the maintainer is towfiqi) | Copy-adapt (narrow) | API-vendor adapter shape (`ScraperSettings`), smart pagination strategy, `getSerp` domain/URL matching | MIT header; `THIRD_PARTY_NOTICES.md` entry. Direct Google scraping providers excluded |
| CodoSEO | AGPL-3.0-only | SafrowLabs (per `Cargo.toml` license field) | Reimplement (ideas only) | Check names and concepts, share-weighted score idea, crawl diff change kinds, AI access findings, CI gating idea | Zero code, tests, templates, message text or remediation copy. No line-by-line translation from Rust. Clean-room note required |
| CodoSEO `crates/geo/data/ai-bots.json` (+ schema) | CC0-1.0 | None required ("Use it for anything, no attribution needed") | Data | AI bot registry (27 entries) | None; we still credit it in `THIRD_PARTY_NOTICES.md` and re-verify entries against each operator's `source_url` |

---

## 3. Candidate dependencies

Install only when the feature that needs them lands. Pin exact versions for young packages.

| Package | License | Use | Workers fit | Notes |
|---|---|---|---|---|
| `robots-parser` (samclarke) | MIT | robots.txt evaluation | Yes | Pure JS |
| `@adobe/structured-data-validator` | Apache-2.0 | JSON-LD / rich results validation | Partial; verify extractor deps | Young repo, pin version; keep NOTICE if present |
| `schema-dts` | Apache-2.0 | schema.org TypeScript types | Types only (dev) | - |
| `@mozilla/readability` | Apache-2.0 | Main-content extraction | Yes, CPU heavy | Run in cron or Workflow only |
| `linkedom` | ISC | Server DOM for readability | Yes | - |
| `jose` | MIT | JWT/JWS on Web Crypto (Google service accounts, signed tokens) | Yes | Use instead of `googleapis` |
| `crux-api` (treosh) | MIT | CrUX field data client | Yes | Small; may copy instead of install (then MIT header) |
| `flesch-kincaid`, `syllable` (words) | MIT | Readability formulas | Yes | Stable, tiny |
| `@cloudflare/puppeteer` / browser-run | Apache-2.0 | Browser Rendering for JS checks | Yes (binding) | Only with the Browser Rendering binding |
| `node-html-parser` or `htmlparser2` | MIT | HTML parsing fallback | Yes | Prefer native `HTMLRewriter` |
| `web-vitals` | Apache-2.0 | Customer RUM snippet | Client only | Only if a RUM snippet ships |

Design references (ideas, or MIT/Apache code with notice if ever copied): Canonry (MIT),
Elmo (MIT), iannuttall/seo (Apache-2.0, keep NOTICE), dataforseo/mcp-server-typescript
(Apache-2.0), AnswerDotAI/llms-txt (Apache-2.0), seonaut (MIT), linkinator (MIT),
GEO-optim/GEO (Apache-2.0), nuxt-seo / nuxt-modules/robots (MIT), mcp-gsc (MIT),
google-analytics-mcp (Apache-2.0), indexnow-action (MIT), Common Crawl data (use the data
under Common Crawl's terms of use).

---

## 4. Restricted list

Nothing below enters `src/`, the CLI, or any proprietary package.

| Source | License | Rule |
|---|---|---|
| CodoSEO (everything except `ai-bots.json`) | AGPL-3.0-only | Ideas only |
| Yoast `wordpress-seo` (incl. `yoastseo`) | GPL-3.0 | Ideas only; never copied |
| The SEO Framework | GPL-3.0 | Ideas only |
| microsoft/indexnow-wordpress-plugin | GPL-2.0 | May be forked only inside a separate GPL-compatible WordPress plugin that talks to IndexFast over the public REST API |
| Seo-Panel | GPL-2.0 | Skip |
| searxng | AGPL-3.0 | Skip (also SERP scraping) |
| firecrawl | AGPL-3.0 | Do not embed or self-host a modified copy; the hosted API may be used as a vendor under its terms |
| firecrawl/llmstxt-generator | No license | Skip |
| Hormold/indexplease | No license | Skip |
| ahonn/mcp-server-gsc | No LICENSE file (package.json says MIT) | Reference only until a LICENSE file exists |
| thedaviddias/llms-txt-hub | NOASSERTION | Link out only until the license is clear |
| `@every-app/*` (OpenSEO vendor packages) | Unverified | Skip |
| SerpBear `proxy`, `scrapingrobot`, `scrapingant` providers, LuanRT/google-this, CrawlSEO `autocomplete.ts` | MIT, but they scrape Google pages or unofficial endpoints | Skip for terms-of-service reasons, not license reasons |

---

## 5. Process

1. Before copying, confirm the license at the exact commit and record source path and commit in
   the file header.
2. Header format for copied code:
   ```ts
   /**
    * <intent comment: why this module exists>
    *
    * Adapted from <project> (<repo path>, commit <sha>).
    * Copyright (c) <year> <holder>. Licensed under the MIT License; see THIRD_PARTY_NOTICES.md.
    */
   ```
3. Add or update the entry in `THIRD_PARTY_NOTICES.md` in the same change.
4. For AGPL sources, write code without the source open and note in the PR which ideas came from
   where.
5. A WordPress plugin, if built, lives in its own repository or package with its own GPL-compatible
   license file.
