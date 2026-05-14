#!/bin/bash

echo "=== ACI Transponder Demo Appliance Status ==="
echo

echo "Hostname:"
hostname
echo

echo "IP Address:"
hostname -I
echo

echo "Docker containers:"
docker ps
echo

echo "Disk usage:"
df -h
echo

echo "Memory:"
free -h
echo

echo "Tailscale:"
tailscale status 2>/dev/null || echo "Tailscale not installed or not connected"
