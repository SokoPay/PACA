#!/usr/bin/env bash
# One-shot PACA setup for the shared SokoPay droplet (host Caddy on 80/443).
#
#   cd /opt/paca && bash deploy/setup-droplet.sh
#
# Safe to re-run: every step checks whether it is already done. It never touches
# other projects' containers or volumes, and backs up the Caddyfile before editing.
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_DIR="$(pwd)"
ENV_FILE="$REPO_DIR/.env.production"
CADDYFILE="/etc/caddy/Caddyfile"
PORT=8090

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓ %s\033[0m\n' "$*"; }
warn() { printf '    \033[33m! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mSTOPPED: %s\033[0m\n' "$*"; exit 1; }

dc() { docker compose -p paca -f "$REPO_DIR/docker-compose.prod.yml" --env-file "$ENV_FILE" "$@"; }

[ "$(id -u)" -eq 0 ] || die "run this as root (or with sudo)."
command -v docker >/dev/null || die "Docker is not installed."
docker compose version >/dev/null 2>&1 || die "the 'docker compose' plugin is missing."

# ------------------------------------------------------------------ questions
say "Two questions"
if [ -f "$ENV_FILE" ]; then
  DOMAIN="$(sed -n 's|^PUBLIC_URL="https://\(.*\)"|\1|p' "$ENV_FILE")"
  ok ".env.production already exists (domain: ${DOMAIN:-unknown}) — keeping it."
else
  read -rp "    Domain for PACA (e.g. ukcloudlogin.com): " DOMAIN
  DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%%/*}"
  [ -n "$DOMAIN" ] || die "no domain given."
  read -rsp "    Paystack TEST secret key (sk_test_..., input hidden; Enter to skip): " PAYSTACK_KEY; echo
  if [ -n "$PAYSTACK_KEY" ] && [[ "$PAYSTACK_KEY" != sk_test_* ]]; then
    die "that is not a test key (it must start with sk_test_). Never use a live key on the test server."
  fi
  read -rp "    Cedis per 1 US dollar for pricing [12.5]: " USD_RATE
  USD_RATE="${USD_RATE:-12.5}"
fi

# ------------------------------------------------------------------ checks
say "Checking the droplet"
if [ -n "$(ss -tlnH "( sport = :$PORT )")" ]; then
  if [[ "$(docker ps --format '{{.Names}}')" == *paca-caddy-* ]]; then
    ok "port $PORT is PACA's own (already running)."
  else
    die "port $PORT is already used by something else. Tell Claude which program: ss -tlpn '( sport = :$PORT )'"
  fi
else
  ok "port $PORT is free."
fi

SERVER_IP="$(curl -4 -fsS --max-time 5 ifconfig.me || true)"
DNS_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
if [ -n "$SERVER_IP" ] && [ "$SERVER_IP" = "$DNS_IP" ]; then
  ok "$DOMAIN points to this droplet ($SERVER_IP)."
else
  warn "$DOMAIN resolves to '${DNS_IP:-nothing}', this droplet is '${SERVER_IP:-unknown}'."
  warn "HTTPS will only work once the A record points here. Continuing anyway."
fi

AVAIL_MB="$(free -m | awk '/^Mem:/{print $7}')"
ok "memory available: ${AVAIL_MB} MB"

# ------------------------------------------------------------------ swap
say "Swap (protects the other apps during the build)"
if [ -n "$(swapon --show --noheadings)" ]; then
  ok "swap already on."
else
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "2 GB swap added."
fi

# ------------------------------------------------------------------ settings
if [ ! -f "$ENV_FILE" ]; then
  say "Writing .env.production (fresh secrets)"
  umask 077
  cat > "$ENV_FILE" <<EOF
PUBLIC_URL="https://$DOMAIN"
SITE_ADDRESS=":80"
HTTP_BIND="127.0.0.1:$PORT"
HTTPS_BIND="127.0.0.1:8453"
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
JWT_ACCESS_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
JWT_REFRESH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
PAYSTACK_SECRET_KEY="$PAYSTACK_KEY"
PAYSTACK_CURRENCY="GHS"
PAYSTACK_USD_RATE="$USD_RATE"
PAYSTACK_CHANNELS="card,mobile_money,bank,bank_transfer"
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="2525"
SMTP_USER=""
SMTP_PASS=""
BREVO_API_KEY=""
MAIL_FROM_EMAIL=""
MAIL_FROM_NAME="PACA"
ANTHROPIC_API_KEY=""
EOF
  chmod 600 "$ENV_FILE"
  ok "saved to $ENV_FILE — back this file up somewhere safe."
fi

# ------------------------------------------------------------------ build + start
say "Building and starting PACA (first time: 10-20 minutes — leave it running)"
dc up -d --build

say "Waiting for the API to become healthy"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$PORT/api/v1/health" >/dev/null 2>&1; then break; fi
  sleep 5
done
curl -fsS "http://127.0.0.1:$PORT/api/v1/health" >/dev/null 2>&1 \
  || die "the API did not come up. Show Claude the output of:  dc logs --tail 80 api"
ok "PACA is running on 127.0.0.1:$PORT"

# ------------------------------------------------------------------ reference data
say "Loading membership tiers, topics and starter questions"
dc run --rm migrate npm run db:seed >/dev/null || die "loading seed data failed. Show Claude: dc run --rm migrate npm run db:seed"
ok "seed data loaded."

# ------------------------------------------------------------------ host caddy
say "Connecting $DOMAIN through the droplet's Caddy"
if [ ! -f "$CADDYFILE" ]; then
  warn "$CADDYFILE not found — add this block to your Caddy config by hand:"
  sed "s/paca.example.com/$DOMAIN/" deploy/host-caddy-paca.caddy | grep -v '^#'
elif grep -q "^${DOMAIN}[[:space:]]*{" "$CADDYFILE"; then
  ok "$DOMAIN is already in $CADDYFILE."
else
  BACKUP="$CADDYFILE.bak-$(date +%Y%m%d-%H%M%S)"
  cp "$CADDYFILE" "$BACKUP"
  { echo; sed "s/paca.example.com/$DOMAIN/" deploy/host-caddy-paca.caddy | grep -v '^#'; } >> "$CADDYFILE"
  if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
    systemctl reload caddy
    ok "added and Caddy reloaded (backup: $BACKUP)."
  else
    cp "$BACKUP" "$CADDYFILE"
    die "Caddy rejected the new config, so it was restored unchanged. Show Claude: grep -n import $CADDYFILE"
  fi
fi

# ------------------------------------------------------------------ alias
grep -q "alias dc='docker compose -p paca" ~/.bashrc 2>/dev/null \
  || echo "alias dc='docker compose -p paca -f $REPO_DIR/docker-compose.prod.yml --env-file $ENV_FILE'" >> ~/.bashrc

# ------------------------------------------------------------------ done
say "Done"
cat <<EOF
    1. Open https://$DOMAIN (the HTTPS certificate can take a minute the first time).
    2. Register your admin account on the site, then run:
         cd $REPO_DIR && bash deploy/make-superadmin.sh you@example.com
    3. Paystack dashboard > Settings > API Keys & Webhooks (Test) > Webhook URL:
         https://$DOMAIN/api/v1/payments/paystack/webhook

    Update later:  cd $REPO_DIR && git pull && bash deploy/setup-droplet.sh
EOF
