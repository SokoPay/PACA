#!/usr/bin/env bash
# Promote a registered account to SUPERADMIN on the droplet.
#
#   cd /opt/paca && bash deploy/make-superadmin.sh you@example.com
set -euo pipefail
cd "$(dirname "$0")/.."

EMAIL="${1:-}"
[ -n "$EMAIL" ] || { echo "Usage: bash deploy/make-superadmin.sh you@example.com"; exit 1; }

docker compose -p paca -f docker-compose.prod.yml --env-file .env.production \
  run --rm migrate npm run --silent db:promote -- "$EMAIL" SUPERADMIN

echo "Log out of the site, log back in, then open /admin."
