#!/usr/bin/env bash
# Captures one route from the running dev server at desktop and mobile widths,
# for side-by-side comparison against docs/prototype/prototype.html.
#
# Uses the installed Google Chrome in headless mode: visual comparison was
# chosen over a pixel-diff harness partly to avoid taking on a
# browser-automation dependency, so adding one here would miss the point.
#
#   ./scripts/compare-screens.sh / home
#   CHROME_PROFILE="$PWD/tmp/chrome-profile" ./scripts/compare-screens.sh /admin admin-dash
#
# Routes under /admin need a session. Headless Chrome starts with no cookies and
# will photograph the login redirect instead. Create a signed-in profile once:
#
#   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
#     --user-data-dir="$PWD/tmp/chrome-profile" http://localhost:3000/admin/login
#
# then pass it via CHROME_PROFILE. tmp/ is git-ignored, so the session never
# reaches the repository.
set -euo pipefail

ROUTE="${1:?usage: compare-screens.sh <route> <name>}"
NAME="${2:?usage: compare-screens.sh <route> <name>}"
BASE="${BASE_URL:-http://localhost:3000}"
OUT="tmp/screens"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

[ -x "$CHROME" ] || { echo "Google Chrome not found at $CHROME" >&2; exit 1; }
mkdir -p "$OUT"

curl -fsS -o /dev/null "$BASE$ROUTE" || {
  echo "dev server not answering at $BASE$ROUTE -- run 'npm run dev' first" >&2
  exit 1
}

# WIDTH FLOOR -- READ BEFORE CHANGING THE NARROW VALUE.
#
# Chrome on macOS will not lay out below a 500px CSS viewport, whatever
# --window-size asks for. Ask for 390 and it renders at 500 and then crops the
# PNG to 390 -- which looks exactly like horizontal overflow and is not. That
# artifact was mistaken for a real responsive defect once during this work,
# and the narrow capture is pinned at 500 so it cannot happen twice.
#
# Verified by rendering a page that reports document.documentElement.clientWidth
# and scrollWidth: both read 500 for requested widths of 320, 390 and 430, in
# both --headless=new and the old headless mode.
#
# Genuine sub-500 verification needs a real device, or CDP
# Emulation.setDeviceMetricsOverride, which would mean the browser-automation
# dependency this harness exists to avoid.
for size in "1440,2400:desktop" "500,1800:narrow"; do
  dims="${size%%:*}"; label="${size##*:}"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --virtual-time-budget=6000 \
    --window-size="$dims" \
    ${CHROME_PROFILE:+--user-data-dir="$CHROME_PROFILE"} \
    --screenshot="$OUT/${NAME}-${label}.png" \
    "$BASE$ROUTE" 2>/dev/null
  echo "wrote $OUT/${NAME}-${label}.png (${dims})"
done
