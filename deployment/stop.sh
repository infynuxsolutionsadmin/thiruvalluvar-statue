#!/bin/bash
set -e

echo "Stopping Thiruvalluvar Voice AI..."
sudo systemctl stop thiruvalluvar-backend
echo "Stopped."
