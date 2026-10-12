#!/usr/bin/env bash
# Kodni serverga yuboradi va konteynerlarni qayta quradi.
#   bash tools/deploy.sh
# Serverda /opt/fazo-club/.env oldindan bo'lishi kerak (.env.example asosida).
set -euo pipefail

HOST="${DEPLOY_HOST:-fazo}"
DIR="${DEPLOY_DIR:-/opt/fazo-club}"
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Commit qilinmagan o'zgarishlar bor — avval commit qiling" >&2
  exit 1
fi
SHA="$(git rev-parse --short HEAD)"
echo "→ $SHA ni $HOST:$DIR ga yuboryapman"

# Tarmoq uzilishi va .env yo'qligini farqlaymiz (ssh o'zi 255 qaytaradi)
set +e
ssh -o ConnectTimeout=15 "$HOST" "mkdir -p $DIR && test -f $DIR/.env"
rc=$?
set -e
if [ $rc -eq 255 ]; then echo "❌ $HOST ga ulanib bo'lmadi (tarmoq/SSH) — qayta urinib ko'ring" >&2; exit 1; fi
if [ $rc -ne 0 ]; then echo "❌ $HOST:$DIR/.env yo'q" >&2; exit 1; fi

rsync -az --delete \
  --exclude node_modules --exclude .next --exclude dist --exclude storage \
  --exclude .git --exclude .claude --exclude '.env' --exclude '.env.dockertest' \
  ./ "$HOST:$DIR/"

ssh "$HOST" "cd $DIR && GIT_SHA=$SHA docker compose up -d --build --remove-orphans && docker image prune -f >/dev/null"

echo "→ sog'lik tekshiruvi"
for i in $(seq 1 30); do
  if ssh "$HOST" "curl -fsS http://127.0.0.1:4600/api/health" 2>/dev/null | grep -q "$SHA"; then
    echo "✅ $SHA ishlayapti"
    exit 0
  fi
  sleep 3
done
echo "❌ API javob bermadi — loglar: ssh $HOST 'cd $DIR && docker compose logs --tail=100 api'" >&2
exit 1
