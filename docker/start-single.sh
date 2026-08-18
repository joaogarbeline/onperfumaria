#!/bin/sh
set -e

export PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export POSTGRES_DB="${POSTGRES_DB:-onperfumaria}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
export DATABASE_URL="${DATABASE_URL:-postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}?sslmode=disable}"

mkdir -p "$PGDATA" /run/postgresql
chown -R postgres:postgres "$PGDATA" /run/postgresql

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  pwfile=$(mktemp)
  printf '%s' "$POSTGRES_PASSWORD" > "$pwfile"
  chown postgres:postgres "$pwfile"
  su-exec postgres initdb -D "$PGDATA" --username="$POSTGRES_USER" --auth=scram-sha-256 --pwfile="$pwfile"
  rm -f "$pwfile"
  su-exec postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses='127.0.0.1' -p 5432" -w start
  su-exec postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB" || true
  su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop
fi

su-exec postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses='127.0.0.1' -p 5432" -w start

cleanup() {
  su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop
}

trap cleanup INT TERM

cd /app
exec /app/api
