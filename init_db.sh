#!/usr/bin/env bash
# Bootstrap a local PostgreSQL instance via Homebrew for the staging backend.
# Also builds and installs the `pg_ivm` extension from source (required by
# the @effectstream/db system migration). Idempotent: re-running is safe.
#
# Usage:
#   ./init_db.sh                       # install + start + create role + db + pg_ivm
#   ./init_db.sh --clean               # drop the existing DB first, then recreate
#   PG_VERSION=15 ./init_db.sh         # pin a specific Homebrew major version
#   PG_IVM_VERSION=v1.9 ./init_db.sh   # pin a specific pg_ivm release tag
#
# After this runs successfully, paste the printed DB_* lines into .env.staging
# (at the repo root) and start the sync node:
#   bun run start.staging.ts

set -euo pipefail

CLEAN=0
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=1 ;;
    -h|--help)
      sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      printf "Unknown argument: %s\n" "$arg" >&2
      exit 1 ;;
  esac
done

PG_VERSION="${PG_VERSION:-16}"
PG_FORMULA="postgresql@${PG_VERSION}"
DB_NAME="${DB_NAME:-payment_app_staging}"
DB_USER="${DB_USER:-postgres}"
DB_PW="${DB_PW:-postgres}"
DB_PORT="${DB_PORT:-5432}"

step() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "    \033[1;32m✓\033[0m %s\n" "$*"; }
err()  { printf "    \033[1;31m✗\033[0m %s\n" "$*" >&2; }

if [[ "$(uname -s)" != "Darwin" ]]; then
  err "This script targets macOS / Homebrew. Detected: $(uname -s)"
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  err "Homebrew is not installed. Install it from https://brew.sh and re-run."
  exit 1
fi
ok "Homebrew found at $(command -v brew)"

step "Installing ${PG_FORMULA} (if not already installed)"
if brew list --formula "${PG_FORMULA}" >/dev/null 2>&1; then
  ok "${PG_FORMULA} already installed"
else
  brew install "${PG_FORMULA}"
  ok "${PG_FORMULA} installed"
fi

PG_PREFIX="$(brew --prefix "${PG_FORMULA}")"
PSQL="${PG_PREFIX}/bin/psql"
PG_ISREADY="${PG_PREFIX}/bin/pg_isready"

step "Starting ${PG_FORMULA} service"
brew services start "${PG_FORMULA}" >/dev/null
ok "Service started (brew services list | grep ${PG_FORMULA})"

step "Waiting for Postgres to accept connections on port ${DB_PORT}"
for i in {1..30}; do
  if "${PG_ISREADY}" -q -p "${DB_PORT}" -h localhost; then
    ok "Postgres is ready"
    break
  fi
  if [[ $i -eq 30 ]]; then
    err "Postgres did not become ready within 30s"
    exit 1
  fi
  sleep 1
done

# pg_ivm (Incremental View Maintenance) is required by the @effectstream/db
# system migration 0.0.0. It's not a Postgres contrib extension and is not
# packaged by Homebrew, so we build it from source against the local pg_config.
PG_IVM_VERSION="${PG_IVM_VERSION:-v1.9}"
PG_IVM_CACHE_DIR="${PG_IVM_CACHE_DIR:-${HOME}/.cache/payment-app/pg_ivm}"
PG_CONFIG_BIN="${PG_PREFIX}/bin/pg_config"
EXT_DIR="$("${PG_CONFIG_BIN}" --sharedir)/extension"

step "Ensuring pg_ivm extension is installed (build against ${PG_FORMULA})"
if [[ -f "${EXT_DIR}/pg_ivm.control" ]]; then
  ok "pg_ivm already installed at ${EXT_DIR}/pg_ivm.control"
else
  command -v git >/dev/null 2>&1 || {
    err "git is required to build pg_ivm"
    exit 1
  }
  command -v make >/dev/null 2>&1 || {
    err "make is required (install Xcode Command Line Tools: xcode-select --install)"
    exit 1
  }

  mkdir -p "${PG_IVM_CACHE_DIR}"
  if [[ ! -d "${PG_IVM_CACHE_DIR}/.git" ]]; then
    git clone --depth 1 --branch "${PG_IVM_VERSION}" \
      https://github.com/sraoss/pg_ivm.git "${PG_IVM_CACHE_DIR}"
  else
    git -C "${PG_IVM_CACHE_DIR}" fetch --depth 1 origin "${PG_IVM_VERSION}"
    git -C "${PG_IVM_CACHE_DIR}" checkout "${PG_IVM_VERSION}"
  fi

  make -C "${PG_IVM_CACHE_DIR}" PG_CONFIG="${PG_CONFIG_BIN}" clean >/dev/null
  make -C "${PG_IVM_CACHE_DIR}" PG_CONFIG="${PG_CONFIG_BIN}"
  make -C "${PG_IVM_CACHE_DIR}" PG_CONFIG="${PG_CONFIG_BIN}" install

  ok "pg_ivm ${PG_IVM_VERSION} installed into ${EXT_DIR}"

  # CREATE EXTENSION loads the shared library on demand, but restarting the
  # server avoids any stale state from prior partial installs.
  brew services restart "${PG_FORMULA}" >/dev/null
  for i in {1..30}; do
    if "${PG_ISREADY}" -q -p "${DB_PORT}" -h localhost; then
      ok "Postgres restarted with pg_ivm available"
      break
    fi
    if [[ $i -eq 30 ]]; then
      err "Postgres did not become ready after pg_ivm install"
      exit 1
    fi
    sleep 1
  done
fi

# On macOS, Homebrew's postgres ships with a superuser matching the OS user
# (no `postgres` role by default). We create one to match the effectstream
# DB_USER/DB_PW defaults so the staging env stays simple.
SUPERUSER="$(whoami)"

step "Ensuring role '${DB_USER}' exists with password '${DB_PW}'"
ROLE_EXISTS=$("${PSQL}" -tA -d postgres -U "${SUPERUSER}" -p "${DB_PORT}" \
  -c "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}';" 2>/dev/null || true)
if [[ "${ROLE_EXISTS}" == "1" ]]; then
  ok "Role '${DB_USER}' already exists"
  "${PSQL}" -q -d postgres -U "${SUPERUSER}" -p "${DB_PORT}" \
    -c "ALTER ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PW}' SUPERUSER;" >/dev/null
  ok "Password and SUPERUSER attribute synced"
else
  "${PSQL}" -q -d postgres -U "${SUPERUSER}" -p "${DB_PORT}" \
    -c "CREATE ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PW}' SUPERUSER;"
  ok "Role '${DB_USER}' created"
fi

if [[ "${CLEAN}" == "1" ]]; then
  step "Dropping database '${DB_NAME}' (--clean)"
  # Terminate any open connections so DROP DATABASE doesn't error.
  "${PSQL}" -q -d postgres -U "${SUPERUSER}" -p "${DB_PORT}" \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null
  "${PSQL}" -q -d postgres -U "${SUPERUSER}" -p "${DB_PORT}" \
    -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
  ok "Database '${DB_NAME}' dropped"
fi

step "Ensuring database '${DB_NAME}' exists"
DB_EXISTS=$("${PSQL}" -tA -d postgres -U "${SUPERUSER}" -p "${DB_PORT}" \
  -c "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}';" 2>/dev/null || true)
if [[ "${DB_EXISTS}" == "1" ]]; then
  ok "Database '${DB_NAME}' already exists"
else
  "${PSQL}" -q -d postgres -U "${SUPERUSER}" -p "${DB_PORT}" \
    -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";"
  ok "Database '${DB_NAME}' created"
fi

step "Verifying connection as '${DB_USER}'"
PGPASSWORD="${DB_PW}" "${PSQL}" -q -h localhost -p "${DB_PORT}" \
  -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" >/dev/null
ok "Connected successfully"

printf "\n\033[1;32mDone.\033[0m Postgres is running and the staging DB is ready.\n\n"
printf "Add these to \033[1m.env.staging\033[0m at the repo root (the sync node and batcher read them):\n\n"
cat <<EOF
  DB_HOST=localhost
  DB_PORT=${DB_PORT}
  DB_USER=${DB_USER}
  DB_PW=${DB_PW}
  DB_NAME=${DB_NAME}

Useful commands:
  brew services list                                  # check status
  brew services restart ${PG_FORMULA}                 # restart
  brew services stop ${PG_FORMULA}                    # stop
  ${PSQL} -h localhost -U ${DB_USER} -d ${DB_NAME}    # interactive shell
EOF
