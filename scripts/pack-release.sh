#!/usr/bin/env bash
# Build and pack the shared packages as GitHub Release assets (no npm registry).
# Usage: scripts/pack-release.sh <version> <out-dir>
# Client sites depend on:
#   https://github.com/xentcloud/AgencyManager/releases/download/pkg-v<version>/agency-manager-<name>-<version>.tgz
set -euo pipefail
VERSION="$1"; OUT="$(cd "$2" && pwd)"
REPO="${GITHUB_REPOSITORY:-xentcloud/AgencyManager}"
BASE="https://github.com/$REPO/releases/download/pkg-v$VERSION"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for pkg in site-schema astro-core; do
  v=$(node -p "require('$ROOT/packages/$pkg/package.json').version")
  [ "$v" = "$VERSION" ] || { echo "packages/$pkg is $v, expected $VERSION" >&2; exit 1; }
done

pnpm --dir "$ROOT" --filter "./packages/site-schema" --filter "./packages/astro-core" build

# astro-core depends on site-schema; point that dependency at the release asset instead of `workspace:`.
cp "$ROOT/packages/astro-core/package.json" "$OUT/.astro-core-package.json.bak"
trap 'cp "$OUT/.astro-core-package.json.bak" "$ROOT/packages/astro-core/package.json"; rm -f "$OUT/.astro-core-package.json.bak"' EXIT
node -e "
  const fs = require('fs'); const p = '$ROOT/packages/astro-core/package.json';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.dependencies['@agency-manager/site-schema'] = '$BASE/agency-manager-site-schema-$VERSION.tgz';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
"
(cd "$ROOT/packages/site-schema" && pnpm pack --pack-destination "$OUT" >/dev/null)
(cd "$ROOT/packages/astro-core" && pnpm pack --pack-destination "$OUT" >/dev/null)
ls "$OUT"/*.tgz
