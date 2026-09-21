#!/usr/bin/env bash
# Run database migrations and seeds against Neon
# Usage: DATABASE_URL="postgresql://..." ./scripts/deploy-db.sh

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set"
  echo "Usage: DATABASE_URL=\"postgresql://user:pass@host/db?sslmode=require\" ./scripts/deploy-db.sh"
  exit 1
fi

echo "Running migrations against Neon..."
cd backend
python -m alembic upgrade head

echo "Seeding colleges..."
python -m seeds.colleges

echo "Seeding scholarship slabs..."
python -m seeds.scholarships

echo "Seeding local admin..."
python -m seeds.local_admin

echo "Database setup complete!"