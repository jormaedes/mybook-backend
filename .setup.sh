#!/usr/bin/env bash
# setup-db.sh — prepara o PostgreSQL local para o Odin Book.
# Idempotente: podes correr várias vezes sem estragar nada.
#
# Uso:
#   ./setup-db.sh            cria utilizador + base de dados (se ainda não existirem) e o .env
#   ./setup-db.sh --reset    apaga e recria a base de dados (perde todos os dados!)

set -euo pipefail

DB_USER="${DB_USER:-jluis}"
DB_PASS="${DB_PASS:-jluis}"
DB_NAME="${DB_NAME:-mybook_db}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# --- pré-requisitos ---------------------------------------------------------
if ! command -v psql >/dev/null 2>&1; then
  echo "Erro: psql não encontrado. Instala o PostgreSQL primeiro." >&2
  echo "  Debian/Ubuntu: sudo apt install postgresql postgresql-client" >&2
  echo "  macOS (brew):  brew install postgresql" >&2
  exit 1
fi

if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
  echo "Erro: o servidor PostgreSQL não está a correr em ${DB_HOST}:${DB_PORT}." >&2
  echo "  Linux: sudo systemctl start postgresql" >&2
  echo "  macOS: brew services start postgresql" >&2
  exit 1
fi

# Corre o psql como superutilizador local.
# No Linux o superuser é 'postgres'; no macOS (Homebrew) é o teu utilizador.
psql_admin() {
  if [[ "$(uname)" == "Darwin" ]]; then
    psql -d postgres "$@"
  else
    sudo -u postgres psql "$@"
  fi
}

# --- reset opcional ---------------------------------------------------------
if [[ "${1:-}" == "--reset" ]]; then
  echo "A apagar a base de dados '${DB_NAME}'..."
  psql_admin -c "DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE);"
fi

# --- utilizador -------------------------------------------------------------
# CREATEDB é necessário: o 'prisma migrate dev' cria uma shadow database.
if [[ -z "$(psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" ]]; then
  echo "A criar o utilizador '${DB_USER}'..."
  psql_admin -c "CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}' CREATEDB;"
else
  echo "Utilizador '${DB_USER}' já existe — a garantir password e CREATEDB..."
  psql_admin -c "ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}' CREATEDB;"
fi

# --- base de dados ----------------------------------------------------------
if [[ -z "$(psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" ]]; then
  echo "A criar a base de dados '${DB_NAME}'..."
  psql_admin -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
else
  echo "Base de dados '${DB_NAME}' já existe."
fi

# --- .env (nunca sobrescreve um existente) ----------------------------------
if [[ ! -f .env ]]; then
  echo "A criar .env..."
  {
    echo "DATABASE_URL=\"${DATABASE_URL}\""
    if command -v openssl >/dev/null 2>&1; then
      echo "SESSION_SECRET=\"$(openssl rand -hex 32)\""
    else
      echo "SESSION_SECRET=\"muda-isto\""
    fi
    echo "CLOUDINARY_CLOUD_NAME="
    echo "CLOUDINARY_API_KEY="
    echo "CLOUDINARY_API_SECRET="
  } > .env
else
  echo ".env já existe — não foi alterado."
  echo "Confirma que contém: DATABASE_URL=\"${DATABASE_URL}\""
fi

# --- teste de ligação -------------------------------------------------------
if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
  echo "Ligação OK: ${DATABASE_URL}"
else
  echo "Aviso: não consegui ligar com ${DB_USER}. Verifica o pg_hba.conf (método md5/scram para 127.0.0.1)." >&2
  exit 1
fi

echo
echo "Pronto. Próximos passos:"
echo "  npm install"
echo "  npx prisma migrate dev --name init"
echo "  npx prisma generate"
echo "  npm run seed"