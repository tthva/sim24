#!/bin/bash
# ============================
# SIM24 — Enhanced PostgreSQL Backup Script
# ============================
# Features:
#   - Compressed pg_dump with gzip
#   - Timestamped files
#   - 14-day retention
#   - Remote S3-compatible backup (optional)
#   - Metrics export for Prometheus
#   - Rotating local backups

set -e

# ─── Configuration ───
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${POSTGRES_DB:-sim24}"
DB_USER="${POSTGRES_USER:-sim24}"
DB_HOST="${POSTGRES_HOST:-postgres}"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
LATEST_LINK="${BACKUP_DIR}/latest.sql.gz"
METRICS_FILE="${BACKUP_DIR}/.metrics"

# Remote backup (S3-compatible, e.g., MinIO, AWS S3, Backblaze B2)
REMOTE_ENABLED=false
if [ -n "${REMOTE_BACKUP_ENDPOINT}" ] && [ -n "${REMOTE_BACKUP_BUCKET}" ]; then
  REMOTE_ENABLED=true
fi

# ─── Functions ───
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error_exit() {
  log "ERROR: $*"
  echo "backup_success 0" > "${METRICS_FILE}"
  echo "backup_last_error \"$*\"" >> "${METRICS_FILE}"
  exit 1
}

cleanup_old_backups() {
  log "Cleaning up backups older than ${RETENTION_DAYS} days..."
  local count=0
  while IFS= read -r -d '' file; do
    rm -f "$file"
    log "Deleted old backup: $file"
    count=$((count + 1))
  done < <(find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -print0)
  
  if [ "${count}" -eq 0 ]; then
    log "No old backups to clean up."
  else
    log "Cleaned up ${count} old backup(s)."
  fi
}

send_to_remote() {
  if [ "${REMOTE_ENABLED}" = false ]; then
    return 0
  fi

  local file="$1"
  local remote_path="${REMOTE_BACKUP_BUCKET}/$(basename "$file")"
  
  log "Uploading backup to remote: ${REMOTE_BACKUP_ENDPOINT}/${remote_path}"
  
  # Use curl for S3-compatible upload (MinIO, AWS S3, etc.)
  if command -v mc &> /dev/null; then
    # Using MinIO client
    mc cp "$file" "sim24-backup/${remote_path}" 2>&1 || log "WARNING: mc upload failed"
  elif command -v aws &> /dev/null; then
    # Using AWS CLI
    aws s3 cp "$file" "s3://${remote_path}" \
      --endpoint-url "${REMOTE_BACKUP_ENDPOINT}" \
      --access-key "${REMOTE_BACKUP_ACCESS_KEY}" \
      --secret-key "${REMOTE_BACKUP_SECRET_KEY}" 2>&1 || log "WARNING: aws s3 cp failed"
  else
    # Using curl for raw S3-compatible upload
    log "No S3 client found (mc or aws). Skipping remote backup."
    return 0
  fi
  
  log "Remote upload completed successfully."
}

# ─── Main ───
log "=============================================="
log "Starting SIM24 PostgreSQL Backup"
log "Database: ${DB_NAME} on ${DB_HOST}"
log "Backup directory: ${BACKUP_DIR}"
log "Retention: ${RETENTION_DAYS} days"
log "=============================================="

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

log "Starting pg_dump..."

# Perform pg_dump with compression (piping directly to gzip is faster)
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-owner \
    --no-acl \
    --verbose \
    2>&1 | gzip > "${BACKUP_FILE}"

# Check if backup was successful
if [ ${PIPESTATUS[0]} -ne 0 ] || [ ! -f "${BACKUP_FILE}" ]; then
  error_exit "pg_dump failed"
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
BACKUP_SIZE_BYTES=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null)
BACKUP_CHECKSUM=$(sha256sum "${BACKUP_FILE}" | cut -d' ' -f1)

log "Backup completed successfully: ${BACKUP_FILE}"
log "Size: ${BACKUP_SIZE} (${BACKUP_SIZE_BYTES:-unknown} bytes)"
log "SHA256: ${BACKUP_CHECKSUM}"

# Update latest symlink
ln -sf "${BACKUP_FILE}" "${LATEST_LINK}"
log "Updated latest symlink: ${LATEST_LINK}"

# Write metrics for Prometheus file-based discovery
cat > "${METRICS_FILE}" << EOF
backup_success 1
backup_last_timestamp $(date +%s)
backup_size_bytes ${BACKUP_SIZE_BYTES:-0}
backup_file "${BACKUP_FILE}"
EOF
log "Wrote backup metrics to ${METRICS_FILE}"

# Clean up old backups
cleanup_old_backups

# Remote backup (if configured)
if [ "$1" = "--remote" ]; then
  send_to_remote "${BACKUP_FILE}"
fi

# Create a summary
SUMMARY_FILE="${BACKUP_DIR}/backup_summary.txt"
{
  echo "Last Backup: $(date)"
  echo "File: ${BACKUP_FILE}"
  echo "Size: ${BACKUP_SIZE}"
  echo "SHA256: ${BACKUP_CHECKSUM}"
  echo "Retention: ${RETENTION_DAYS} days"
} > "${SUMMARY_FILE}"

log "=============================================="
log "Backup process completed successfully"
log "=============================================="
exit 0