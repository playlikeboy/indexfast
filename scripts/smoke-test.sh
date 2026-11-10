#!/usr/bin/env bash
# Live smoke test for the public site.
# Why: a route that 404s or 500s in production (or a sitemap entry pointing at a dead page)
# hurts both users and indexing, and tests cannot catch deploy-time breakage. This checks the
# key routes, every URL in /sitemap.xml, and that protected surfaces still refuse anonymous
# access. Exits non-zero on any failure. Usage: scripts/smoke-test.sh [base-url]
set -uo pipefail

BASE="${1:-https://indexfast.co}"
BASE="${BASE%/}"
fail=0
checked=0

check() {
  local url="$1" expected="$2"
  local code attempt
  # Retry transient network errors so one dropped connection does not open an issue.
  for attempt in 1 2 3; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -A "IndexFast-HealthCheck/1.0" "$url" || true)
    [[ "$code" =~ ^($expected)$ ]] && break
    sleep 2
  done
  checked=$((checked + 1))
  if [[ ! "$code" =~ ^($expected)$ ]]; then
    echo "FAIL $code (want $expected) $url"
    fail=$((fail + 1))
  fi
}

# Core routes and machine-readable files.
for path in / /pricing /about /contact /privacy /terms /tools /blog /resources /robots.txt /sitemap.xml /llms.txt; do
  check "$BASE$path" "200"
done

# Database reachable and the hourly cron has succeeded in the last 2 hours (503 otherwise).
check "$BASE/api/health" "200"

# Protected surfaces must not be served to anonymous visitors.
check "$BASE/dashboard" "30[0-9]|401|403"
check "$BASE/api/v1/sites" "401|403"

# Every URL the sitemap advertises must resolve, otherwise search engines get dead links.
urls=$(curl -sS --max-time 30 "$BASE/sitemap.xml" | grep -o '<loc>[^<]*</loc>' | sed -e 's/<loc>//' -e 's/<\/loc>//' | sort -u)
if [ -z "$urls" ]; then
  echo "FAIL sitemap.xml has no <loc> entries"
  fail=$((fail + 1))
fi
for url in $urls; do
  check "$url" "200"
done

echo "Checked $checked URLs, $fail failed."
[ "$fail" -eq 0 ]
