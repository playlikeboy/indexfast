# IndexFast SEO (vendored OpenSEO)

This folder is OpenSEO (https://github.com/every-app/open-seo, MIT, commit af3f995f), copied in
without its git history and lightly modified to run as "IndexFast SEO" on https://seo.indexfast.co.
IndexFast itself (the Next.js app at the repo root) is unchanged and links here from its nav.

## Changes from upstream
- Worker and resource names: `indexfast-seo`, `indexfast-seo-audit`, `indexfast-seo-*-selfhost`
  (deploy/alchemy/alchemy.access.ts, alchemy.run.ts).
- Visible product name in the UI (.tsx text only). Protocol strings (crawler user agent
  `OpenSEO-Audit`, token issuers) are unchanged on purpose.
- Sign-in: `AUTH_MODE=password` (its own accounts). Single sign-on with IndexFast is planned.

## Deploy (Cloudflare, same account as IndexFast)
```bash
cd openseo
pnpm install
# .env.selfhost (gitignored) holds AUTH_MODE, CUSTOM_DOMAIN=seo.indexfast.co and secrets.
# DATAFORSEO_API_KEY = base64("login:password") from https://app.dataforseo.com/api-access
set -a; . ../.env; set +a   # CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
CI=1 pnpm alchemy cloudflare bootstrap   # once: alchemy state store worker
CI=1 pnpm deploy:selfhost --yes
```
Then open https://seo.indexfast.co right away and create the administrator account
(registration closes after the first account).

## Updating from upstream
Copy a newer upstream checkout over this folder (excluding .git, node_modules, web), then
re-apply the changes listed above.
