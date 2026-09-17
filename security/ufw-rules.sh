#!/bin/bash
# ============================
# SIM24 — UFW Firewall Rules
# ============================
# Run this script on the host to configure the firewall.
# Usage: sudo bash security/ufw-rules.sh

set -e

echo "=== Configuring UFW Firewall for SIM24 ==="

# Reset existing rules (use with caution on production)
# ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# --- Essential services ---

# SSH (change port if custom)
ufw allow ssh
# ufw allow 2222/tcp  # Uncomment if using custom SSH port

# HTTP / HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# --- Monitoring (bind to specific IP if possible) ---

# Grafana (only accessible from specific IPs)
ufw allow from 127.0.0.1 to any port 3001 proto tcp
# ufw allow from YOUR_ADMIN_IP to any port 3001 proto tcp

# Prometheus (internal only)
ufw allow from 127.0.0.1 to any port 9090 proto tcp

# Node Exporter (internal only)
ufw allow from 127.0.0.1 to any port 9100 proto tcp

# --- Docker internal traffic ---
ufw allow from 172.16.0.0/12 to any port 5432 proto tcp  # PostgreSQL internal
ufw allow from 172.16.0.0/12 to any port 6379 proto tcp  # Redis internal

# --- Rate limiting (prevent brute force on SSH) ---
ufw limit ssh/tcp

# Enable the firewall
ufw --force enable

echo ""
echo "=== UFW Status ==="
ufw status verbose

echo ""
echo "=== Done ==="
echo "Firewall configured. Save these rules: sudo ufw status numbered"