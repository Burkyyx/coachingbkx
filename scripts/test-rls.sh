#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Tests de sécurité de la base (politiques RLS) avec pgTAP.
#
# Lance une base Postgres Supabase jetable dans Docker, applique toutes les
# migrations, exécute les fichiers supabase/tests/*.test.sql, puis supprime la base.
#
#   npm run test:rls            # tout lancer
#   KEEP_DB=1 npm run test:rls  # garder la base ouverte après les tests (port 54329)
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${RLS_TEST_IMAGE:-supabase/postgres:17.6.1.054}"
NAME="elan-rls-test"
PORT="${RLS_TEST_PORT:-54329}"
export PGPASSWORD=postgres
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
# Super-utilisateur de l'image Supabase (uniquement pour la mise à niveau de test).
PSQL_ADMIN=(psql -h 127.0.0.1 -p "$PORT" -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -X)

cleanup() {
  if [[ "${KEEP_DB:-0}" != "1" ]]; then
    docker rm -f "$NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if ! command -v psql >/dev/null; then
  echo "psql est requis (sur Mac : brew install libpq && brew link --force libpq)" >&2
  exit 1
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
echo "▶ Démarrage de la base de test ($IMAGE)…"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" "$IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if "${PSQL[@]}" -c 'select 1' >/dev/null 2>&1; then break; fi
  sleep 1
done
# Laisse le script d'initialisation de l'image se terminer.
sleep 3
for _ in $(seq 1 30); do
  if "${PSQL[@]}" -c "select 1 from pg_roles where rolname = 'authenticated'" 2>/dev/null | grep -q 1; then break; fi
  sleep 1
done

echo "▶ Mise à niveau de l'environnement de test…"
"${PSQL_ADMIN[@]}" -f "$ROOT/scripts/rls-test-shim.sql"

echo "▶ Application des migrations…"
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f" >/dev/null
done

echo "▶ Exécution des tests…"
FAILED=0
TOTAL=0
cd "$ROOT/supabase/tests"
for f in *.test.sql; do
  OUT=$("${PSQL[@]}" -t -A -f "$f" 2>&1) || { echo "✗ $f (erreur SQL)"; echo "$OUT"; FAILED=1; continue; }
  N_OK=$(grep -c '^ok ' <<<"$OUT" || true)
  N_KO=$(grep -c '^not ok ' <<<"$OUT" || true)
  TOTAL=$((TOTAL + N_OK + N_KO))
  if [[ "$N_KO" -gt 0 ]] || grep -q '# Looks like' <<<"$OUT"; then
    echo "✗ $f"
    grep -E '^not ok|^#' <<<"$OUT" || true
    FAILED=1
  else
    echo "✓ $f ($N_OK tests)"
  fi
done

if [[ "$FAILED" -ne 0 ]]; then
  echo "❌ Des tests RLS ont échoué."
  exit 1
fi
echo "✅ $TOTAL tests RLS réussis."
