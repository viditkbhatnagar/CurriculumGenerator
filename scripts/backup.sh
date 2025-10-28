#!/bin/bash

# Automated backup script for Curriculum Generator App
# Runs daily at 2:00 AM UTC via cron or AWS EventBridge

set -e

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/backups"
S3_BUCKET="${BACKUP_S3_BUCKET:-curriculum-app-backups}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup at $(date)"

# 1. Backup PostgreSQL database
echo "Backing up PostgreSQL database..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/postgres_${ENVIRONMENT}_${TIMESTAMP}.sql.gz"

# 2. Backup Redis data (if persistence is enabled)
echo "Backing up Redis data..."
if [ -n "$REDIS_URL" ]; then
  redis-cli --rdb "$BACKUP_DIR/redis_${ENVIRONMENT}_${TIMESTAMP}.rdb" || echo "Redis backup skipped (not available)"
fi

# 3. Export Pinecone index metadata
echo "Backing up Pinecone metadata..."
if [ -n "$PINECONE_API_KEY" ]; then
  # Export index stats and configuration
  curl -X GET "https://controller.${PINECONE_ENVIRONMENT}.pinecone.io/databases" \
    -H "Api-Key: ${PINECONE_API_KEY}" \
    > "$BACKUP_DIR/pinecone_metadata_${ENVIRONMENT}_${TIMESTAMP}.json" || echo "Pinecone backup skipped"
fi

# 4. Upload to S3
echo "Uploading backups to S3..."
aws s3 sync "$BACKUP_DIR" "s3://${S3_BUCKET}/${ENVIRONMENT}/${TIMESTAMP}/" \
  --storage-class STANDARD_IA \
  --sse AES256

# 5. Cleanup old backups (keep last 30 days)
echo "Cleaning up old backups..."
CUTOFF_DATE=$(date -d '30 days ago' +%Y%m%d)
aws s3 ls "s3://${S3_BUCKET}/${ENVIRONMENT}/" | while read -r line; do
  BACKUP_DATE=$(echo "$line" | awk '{print $2}' | cut -d'/' -f1 | cut -d'_' -f1)
  if [ "$BACKUP_DATE" -lt "$CUTOFF_DATE" ]; then
    BACKUP_PATH=$(echo "$line" | awk '{print $2}')
    echo "Deleting old backup: $BACKUP_PATH"
    aws s3 rm "s3://${S3_BUCKET}/${ENVIRONMENT}/${BACKUP_PATH}" --recursive
  fi
done

# 6. Cleanup local files
rm -rf "$BACKUP_DIR"

# 7. Send notification
echo "Backup completed successfully at $(date)"

# Optional: Send SNS notification
if [ -n "$SNS_TOPIC_ARN" ]; then
  aws sns publish \
    --topic-arn "$SNS_TOPIC_ARN" \
    --subject "Backup Completed - ${ENVIRONMENT}" \
    --message "Database backup completed successfully at $(date). Backup ID: ${TIMESTAMP}"
fi

exit 0
