#!/bin/bash
# ============================
# SIM24 — Database Restore Script
# ============================
# Usage:
#   docker compose exec backup backup-restore.sh                    # List backups
#   docker compose exec backup backup-restore.sh latest             # Restore latest
#   docker compose exec backup backup-restore.sh sim24_20260615_030000.sql.gz  # Restore specific

set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_NAME="${POSTGRES_DB:-sim24}"
DB_USER="${POSTGRES_USER:-sim24}"
DB_HOST="${POSTGRES_HOST:-postgres}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

error_exit() { log "ERROR: $*"; echo "Available backups:"; ls -1 "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -10; exit 1; }

case "${1:-list}" in
  list)
    echo "Available backups:"
    ls -lh "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | awk '{print $5, $9}' || echo "No backups found."
    ;;
  latest)
    RESTORE_FILE="${BACKUP_DIR}/latest.sql.gz"
    if [ ! -f "${RESTORE_FILE}" ]; then
      error_exit "No latest backup found at ${RESTORE_FILE}"
    fi
    ;;
  *)
    RESTORE_FILE="${BACKUP_DIR}/${1}"
    if [ ! -f "${RESTORE_FILE}" ]; then
      error_exit "Backup file not found: ${1}"
    fi
    ;;
esac

if [ "${1}" != "list" ]; then
  log "WARNING: This will OVERWRITE the current database '${DB_NAME}'!"
  log "Press Ctrl+C within 5 seconds to cancel..."
  sleep 5
  
  log "Starting restore from: ${RESTORE_FILE}"
  log "Stopping application (if running) prevents writes during restore..."
  
  gunzip -c "${RESTORE_FILE}" | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-password \
    2>&1
  
  log "Restore completed successfully from: ${RESTORE_FILE}"
fi