#!/bin/bash
# ============================
# SIM24 — Database Initialization
# ============================
# This script runs automatically when the PostgreSQL container starts
# for the first time. It creates extensions and initial schema if needed.

set -e

echo "Initializing database extensions..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable UUID generation
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    
    -- Enable full-text search
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    
    -- For connection pooling and monitoring
    CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
EOSQL

echo "Database initialization completed successfully."