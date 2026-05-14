#!/bin/bash
set -e

APP_DIR="/opt/aci-transponder-demo"

echo "Updating Ubuntu packages..."
sudo apt update
sudo apt upgrade -y

echo "Updating Docker containers..."
cd "$APP_DIR"
docker compose pull
docker compose up -d

echo "Cleaning unused Docker images..."
docker image prune -f

echo "Update complete."
