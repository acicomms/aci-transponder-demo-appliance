#!/bin/bash
set -e

APP_DIR="/opt/aci-transponder-demo"
BACKUP_ROOT="$APP_DIR/backups"
DATE=$(date +"%Y%m%d-%H%M%S")
BACKUP_DIR="$BACKUP_ROOT/$DATE"

mkdir -p "$BACKUP_DIR"

echo "Backing up config files..."
tar -czf "$BACKUP_DIR/config-backup.tar.gz" \
  "$APP_DIR/docker-compose.yml" \
  "$APP_DIR/.env" \
  "$APP_DIR/config" \
  "$APP_DIR/scripts" \
  2>/dev/null || true

echo "Saving Docker volume list..."
docker volume ls > "$BACKUP_DIR/docker-volumes.txt"

echo "Backup created at:"
echo "$BACKUP_DIR"
