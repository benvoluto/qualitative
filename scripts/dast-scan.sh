#!/usr/bin/env bash
#
# OWASP ZAP baseline scan against a deployed environment.
#
# Usage:
#   scripts/dast-scan.sh                            # scans https://qualitative.one
#   scripts/dast-scan.sh https://staging.example    # scans a different URL
#
# Outputs:
#   docs/security/dast-reports/zap-YYYYMMDD-HHMMSS.html
#   docs/security/dast-reports/zap-YYYYMMDD-HHMMSS.json
#
# Requirements:
#   - Docker installed and running
#
# Notes:
#   - The baseline scan is passive (does not attack the target). It is safe to run
#     against production. It crawls the site for ~1 minute and inspects responses.
#   - If you want an active scan that exercises forms and inputs, run against a
#     staging environment using `zap-full-scan.py` instead — never against
#     production.

set -euo pipefail

TARGET_URL="${1:-https://qualitative.one}"
REPORT_DIR="$(cd "$(dirname "$0")/.." && pwd)/docs/security/dast-reports"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
HTML_REPORT="zap-${STAMP}.html"
JSON_REPORT="zap-${STAMP}.json"

mkdir -p "$REPORT_DIR"

echo "Running ZAP baseline scan against $TARGET_URL"
echo "Reports will land in $REPORT_DIR/"

docker run --rm \
  -v "$REPORT_DIR:/zap/wrk:rw" \
  -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t "$TARGET_URL" \
  -r "$HTML_REPORT" \
  -J "$JSON_REPORT" \
  -I

# zap-baseline.py exit codes:
#   0 = no warnings, 1 = warnings, 2 = errors. -I above forces 0 on warnings.

echo
echo "Done."
echo "HTML report: $REPORT_DIR/$HTML_REPORT"
echo "JSON report: $REPORT_DIR/$JSON_REPORT"
