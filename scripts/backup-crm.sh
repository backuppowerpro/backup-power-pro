#!/bin/bash
# backup-crm.sh — Timestamped local backup of crm.html
# Runs via launchd daily. Keeps last 30 backups.

BACKUP_DIR="/Users/keygoodson/Desktop/CLAUDE/_backups/crm"
SRC="/Users/keygoodson/Desktop/CLAUDE/crm/crm.html"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEST="$BACKUP_DIR/crm-$TIMESTAMP.html"

cp "$SRC" "$DEST"
echo "[$(date)] Backup saved: $DEST"

# Keep only the last 30 backups to avoid disk bloat
ls -t "$BACKUP_DIR"/crm-*.html 2>/dev/null | tail -n +31 | xargs rm -f
