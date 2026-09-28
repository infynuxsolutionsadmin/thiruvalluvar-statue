#!/bin/bash
set -e

echo "Starting Thiruvalluvar Voice AI..."

# Verify .env exists
if [ ! -f "/opt/thiruvalluvar/app/.env" ]; then
    echo "ERROR: /opt/thiruvalluvar/app/.env is missing."
    exit 1
fi

sudo systemctl start thiruvalluvar-backend
echo "Started. Run './deployment/health-check.sh' to verify."
