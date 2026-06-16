#!/bin/sh
set -e

export PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export POSTGRES_DB="${POSTGRES_DB:-onperfumaria}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export DATABASE_URL="${DATABASE_URL:-postgres://postgres@127.0.0.1:5432/onperfumaria?sslmode=disable}"

mkdir -p "$PGDATA" /run/postgresql
chown -R postgres:postgres "$PGDATA" /run/postgresql

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  su-exec postgres initdb -D "$PGDATA" --username="$POSTGRES_USER" --auth=trust
  su-exec postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses='127.0.0.1' -p 5432" -w start
  su-exec postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB" || true
  su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop
fi

su-exec postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses='0.0.0.0' -p 5432" -w start

cleanup() {
  su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop
}

trap cleanup INT TERM

cd /app
exec /app/api
