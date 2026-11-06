#!/bin/bash
# P+Carder 每週一定期自動排程：抓取最新賽事與卡展資訊
echo "[Weekly Sync] Starting weekly sync at $(date)..."
curl -s -X POST http://localhost:3000/api/cron/sync-all || curl -s -X POST http://127.0.0.1:3000/api/cron/sync-all
echo ""
echo "[Weekly Sync] Completed at $(date)."
