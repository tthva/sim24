# SIM24 — Production Deployment Guide

> **Version:** 1.0.0  
> **Last Updated:** 2026-06-15  
> **Infrastructure:** Docker + Nginx + PostgreSQL + Redis + Monitoring (Prometheus/Grafana)

---

## Table of Contents

1. [Server Requirements](#1-server-requirements)
2. [Initial Server Setup](#2-initial-server-setup)
3. [Docker & Docker Compose Installation](#3-docker--docker-compose-installation)
4. [Firewall & Security Hardening](#4-firewall--security-hardening)
5. [Project Structure Overview](#5-project-structure-overview)
6. [Environment Configuration](#6-environment-configuration)
7. [First-Time Deployment](#7-first-time-deployment)
8. [Database Initialization & Seeding](#8-database-initialization--seeding)
9. [Verifying the Deployment](#9-verifying-the-deployment)
10. [SSL / TLS Configuration (Optional)](#10-ssl--tls-configuration-optional)
11. [CI/CD Pipeline (GitHub Actions)](#11-cicd-pipeline-github-actions)
12. [Updating the Application](#12-updating-the-application)
13. [Rollback Strategy](#13-rollback-strategy)
14. [Backup & Restore](#14-backup--restore)
15. [Monitoring with Grafana](#15-monitoring-with-grafana)
16. [Logging & Troubleshooting](#16-logging--troubleshooting)
17. [Security Checklist](#17-security-checklist)

---

## 1. Server Requirements

### Minimum Specifications
| Resource | Requirement |
|----------|-------------|
| **CPU** | 2 vCPUs |
| **RAM** | 4 GB |
| **Disk** | 20 GB SSD |
| **OS** | Ubuntu 22.04 LTS or 24.04 LTS |
| **Network** | Static public IP, open ports 80 (HTTP) and optional 443 (HTTPS) |

### Recommended Specifications for Production
| Resource | Requirement |
|----------|-------------|
| **CPU** | 4 vCPUs |
| **RAM** | 8 GB |
| **Disk** | 50 GB SSD (separate data volume for PostgreSQL) |
| **OS** | Ubuntu 24.04 LTS |
| **Swap** | 2 GB |

### Software Prerequisites (installed automatically by this guide)
- Docker Engine 24+
- Docker Compose Plugin v2+
- Git
- curl, wget, vim/nano
- UFW (Uncomplicated Firewall)
- Fail2Ban
- Node.js 22 (optional — only needed locally for development)

---

## 2. Initial Server Setup

SSH into your server and run:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common \
    git \
    ufw \
    fail2ban \
    htop \
    net-tools

# Set hostname
sudo hostnamectl set-hostname sim24

# Create deploy user (if not root)
sudo adduser deploy
sudo usermod -aG sudo deploy

# Copy SSH key for the deploy user
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# Disable SSH password authentication (for security)
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Set timezone
sudo timedatectl set-timezone Asia/Tehran
```

---

## 3. Docker & Docker Compose Installation

```bash
# Remove old versions
sudo apt remove -y docker docker-engine docker.io containerd runc

# Install Docker from official repo
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group (so you don't need sudo)
sudo usermod -aG docker $USER
# Log out and back in for this to take effect

# Verify installation
docker --version
docker compose version

# Enable Docker to start on boot
sudo systemctl enable docker

# Create project directory
sudo mkdir -p /opt/sim24
sudo chown $USER:$USER /opt/sim24

# Clone the repository
cd /opt/sim24
git clone https://github.com/YOUR_ORG/sim24.git .
```

> **Note:** Replace `YOUR_ORG` with your actual GitHub organization or username.

---

## 4. Firewall & Security Hardening

### Configure UFW

```bash
# Apply the UFW rules provided in the repository
sudo bash security/ufw-rules.sh

# Expected output shows port 80, 443, and SSH are open
# All other ports are denied
```

### Configure Fail2Ban

```bash
# Copy the Fail2Ban configuration
sudo cp security/fail2ban-jail.conf /etc/fail2ban/jail.d/sim24.conf

# Restart Fail2Ban
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

# Check status
sudo fail2ban-client status
```

### AppArmor / Seccomp (Docker Security)

Docker applies default seccomp profiles automatically. No additional action needed unless you require custom profiles.

---

## 5. Project Structure Overview

```
/opt/sim24/
├── app/                          # Next.js App Router (frontend + API)
├── components/                   # Reusable React components
├── lib/                          # Utility libraries (auth, jwt, prisma)
├── prisma/                       # Database schema, migrations, seed
├── public/                       # Static assets
├── nginx/
│   └── nginx.conf                # Nginx reverse proxy configuration
├── prometheus/
│   └── prometheus.yml            # Prometheus scrape configuration
├── grafana/
│   ├── datasources/              # Grafana data source provisioning
│   ├── dashboards/               # Grafana dashboard provisioning
│   └── dashboards/json/          # Pre-built dashboards
├── scripts/
│   ├── init-db.sh                # PostgreSQL initialization script
│   └── backup.sh                 # Automated backup script
├── security/
│   ├── ufw-rules.sh              # Firewall configuration
│   └── fail2ban-jail.conf        # Fail2Ban configuration
├── .github/workflows/
│   └── deploy.yml                # GitHub Actions CI/CD pipeline
├── Dockerfile                    # Production multi-stage Docker build
├── docker-compose.yml            # Full infrastructure definition
├── .env.example                  # Environment variable template
├── next.config.mjs               # Next.js configuration (standalone output)
├── package.json                  # Node.js dependencies
└── tsconfig.json                 # TypeScript configuration
```

---

## 6. Environment Configuration

### Create the .env file

```bash
cd /opt/sim24
cp .env.example .env
nano .env
```

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://sim24:STRONG_PASS@postgres:5432/sim24` |
| `POSTGRES_USER` | PostgreSQL username | `sim24` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `generate-a-strong-random-password` |
| `POSTGRES_DB` | PostgreSQL database name | `sim24` |
| `JWT_SECRET` | 64-char hex string for JWT signing | Generate with: `openssl rand -hex 32` |
| `NODE_ENV` | Runtime environment | `production` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NGINX_PORT` | `80` | Public HTTP port |
| `GRAFANA_PORT` | `3001` | Grafana UI port |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin username |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password (CHANGE in production) |
| `CRM_WEBHOOK_URL` | — | External CRM webhook endpoint |
| `CRON_API_KEY` | — | API key for cron jobs |

### Generate Secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate PostgreSQL password
openssl rand -base64 32
```

---

## 7. First-Time Deployment

### Step 1: Build and start all services

```bash
cd /opt/sim24

# Pull images and build (first time may take 5-10 minutes)
docker compose build

# Start all services in detached mode
docker compose up -d

# Check that all services are running
docker compose ps
```

Expected output:
```
NAME                IMAGE                           STATUS                    PORTS
sim24-app           sim24-app                       Up (healthy)              127.0.0.1:3000->3000/tcp
sim24-db            postgres:15-alpine              Up (healthy)              127.0.0.1:5432->5432/tcp
sim24-redis         redis:7-alpine                  Up (healthy)              127.0.0.1:6379->6379/tcp
sim24-nginx         nginx:1.25-alpine               Up                        0.0.0.0:80->80/tcp
sim24-prometheus    prom/prometheus:v2.53.0         Up                        127.0.0.1:9090->9090/tcp
sim24-grafana       grafana/grafana:11.1.0          Up                        127.0.0.1:3001->3000/tcp
sim24-backup        postgres:15-alpine              Up                        -
```

### Step 2: View logs

```bash
# Watch all services
docker compose logs -f

# Watch specific service
docker compose logs -f app
docker compose logs -f nginx
```

---

## 8. Database Initialization & Seeding

### Run Prisma Migrations

The app container automatically runs `npx prisma migrate deploy` on startup.  
If you need to run it manually:

```bash
# Exec into the app container
docker compose exec app npx prisma migrate deploy
```

### Seed the Database (Optional)

```bash
docker compose exec app npx prisma db seed
```

This creates initial admin and agent accounts as defined in `prisma/seed.ts`.

### Verify Database

```bash
# Connect directly to PostgreSQL
docker compose exec postgres psql -U sim24 -d sim24

# List tables
\dt

# Check admin user
SELECT * FROM "Admin";

# Exit
\q
```

---

## 9. Verifying the Deployment

### Health Checks

```bash
# Via Nginx (public)
curl -f http://YOUR_SERVER_IP/api/auth/check

# Directly to app (internal)
curl -f http://localhost:3000/api/auth/check

# Expected response:
# {"authenticated":false}
```

### Test the Full Flow

```bash
# 1. Test that the website loads
curl -sS http://YOUR_SERVER_IP | head -20

# 2. Test API health
curl -sS http://YOUR_SERVER_IP/api/auth/check

# 3. Test SIM value endpoint
curl -sS "http://YOUR_SERVER_IP/api/sim-value?phoneNumber=09123456789&condition=dry"

# 4. Test form submission (sell form)
curl -sS -X POST "http://YOUR_SERVER_IP/api/forms/sell" \
  -H "Content-Type: application/json" \
  -d '{"formType":"sell_direct","formData":{"dNm":"Test","dFm":"User","dPh":"09123456789","dProv":1,"dCity":1,"dBD":"15","dBM":"06","dBY":"1370","dOwn":"self","dCond":"new","dHk":"website"}}'
```

---

## 10. SSL / TLS Configuration (Optional but Recommended)

### Using Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install -y certbot

# Obtain certificate (temporarily stop Nginx)
docker compose stop nginx
sudo certbot certonly --standalone -d sim24.ir -d www.sim24.ir

# Restart Nginx
docker compose start nginx
```

### Update Nginx Configuration for HTTPS

Edit `nginx/nginx.conf` and uncomment the HTTPS server block.  
Then add the SSL certificate paths:

```nginx
server {
    listen 443 ssl http2;
    server_name sim24.ir www.sim24.ir;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    # ... rest of the config
}
```

Uncomment the SSL volume mount in `docker-compose.yml`:

```yaml
volumes:
  - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
  - /etc/letsencrypt:/etc/nginx/ssl:ro   # ← uncomment this
```

Then restart:

```bash
docker compose up -d --force-recreate nginx
```

### Auto-Renew Let's Encrypt

```bash
# Add a cron job for renewal
sudo crontab -e

# Add this line:
0 3 * * * docker compose -f /opt/sim24/docker-compose.yml stop nginx && certbot renew && docker compose -f /opt/sim24/docker-compose.yml start nginx
```

---

## 11. CI/CD Pipeline (GitHub Actions)

### Pipeline Overview

The pipeline defined in `.github/workflows/deploy.yml` has 5 stages:

```
Lint → Build → Docker Build & Push → Deploy → Health Check
```

### Setting Up GitHub Secrets

Go to your repository → **Settings** → **Secrets and variables** → **Actions**  
Add the following secrets:

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | Server IP address (e.g., `203.0.113.10`) |
| `DEPLOY_USER` | SSH username (e.g., `deploy`) |
| `DEPLOY_KEY` | SSH private key (content of the private key file, NOT the path) |
| `DEPLOY_PORT` | SSH port (usually `22`) |
| `DATABASE_URL` | Full PostgreSQL connection string |
| `JWT_SECRET` | 64-char hex JWT secret |
| `REDIS_URL` | Redis connection string |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `GRAFANA_ADMIN_USER` | Grafana admin username |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password |

### Pipeline Trigger

The pipeline runs automatically on:
- **Push to `main` or `master` branch**
- **Pull request** to `main` or `master`
- **Manual trigger** via GitHub Actions UI (workflow_dispatch)

---

## 12. Updating the Application

### Manual Update (without CI/CD)

```bash
cd /opt/sim24

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose build app
docker compose up -d --no-deps --force-recreate app

# Run new migrations (if any)
docker compose exec app npx prisma migrate deploy

# Verify
curl -f http://localhost:3000/api/auth/check
```

### Automatic Update (via CI/CD)

Simply push to `main` or `master`:

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
```

The GitHub Actions pipeline will:
1. ✅ Lint and type-check the code
2. ✅ Build the application
3. ✅ Build and push Docker image to `ghcr.io`
4. ✅ SSH into the server
5. ✅ Pull the new image
6. ✅ Recreate the app container
7. ✅ Run database migrations
8. ✅ Verify health check

---

## 13. Rollback Strategy

### Option 1: Rollback to Previous Docker Image

The CI/CD pipeline tags images with both `latest` and the commit SHA.  
To rollback to a specific version:

```bash
cd /opt/sim24

# List available tags on GHCR
docker pull ghcr.io/YOUR_ORG/sim24:main-abc1234

# Update docker-compose to use the specific tag
# Edit docker-compose.yml to add:
#   image: ghcr.io/YOUR_ORG/sim24:main-abc1234
# Remove the build section temporarily

# Restart
docker compose up -d --no-deps --force-recreate app
```

### Option 2: Database Rollback

Prisma supports migration rollbacks:

```bash
# Check migration history
docker compose exec app npx prisma migrate status

# Rollback the last migration
docker compose exec app npx prisma migrate reset

# Or rollback to a specific migration
docker compose exec app npx prisma migrate resolve --rolled-back "migration_name"
```

### Option 3: Full System Rollback

If the entire system is broken, restore from backup:

```bash
# Stop all services
docker compose down

# Restore database from backup
docker compose run --rm backup sh -c "pg_restore -h postgres -U sim24 -d sim24 /backups/sim24_YYYYMMDD_HHMMSS.sql"

# Restore previous application version
git checkout <previous-tag>
docker compose up -d --build
```

---

## 14. Backup & Restore

### Automated Daily Backups

The backup container runs `pg_dump` every day at **3:00 AM server time**.  
Backups are stored in the `pgbackups` Docker volume.

### Backup Retention

- Backups are kept for **7 days** (configurable via `RETENTION_DAYS` in `docker-compose.yml`)
- Old backups are automatically deleted

### Manual Backup

```bash
# Trigger a backup manually
docker compose exec backup backup.sh

# Or directly via pg_dump
docker compose exec postgres pg_dump -U sim24 -d sim24 | gzip > manual_backup_$(date +%Y%m%d).sql.gz
```

### List Available Backups

```bash
# Check the backup volume
docker run --rm -v sim24_pgbackups:/backups alpine ls -la /backups

# Or exec into the backup container
docker compose exec backup ls -la /backups
```

### Restore from Backup

```bash
# Stop the app (so no writes happen during restore)
docker compose stop app

# Restore the latest backup
docker compose exec -T postgres bash -c "gunzip -c < /backups/latest.sql.gz | psql -U sim24 -d sim24"

# Or restore a specific backup
docker compose exec -T postgres bash -c "gunzip -c < /backups/sim24_20260615_030000.sql.gz | psql -U sim24 -d sim24"

# Restart the app
docker compose start app
```

---

## 15. Monitoring with Grafana

### Accessing Grafana

| Service | URL | Default Credentials |
|---------|-----|-------------------|
| **Grafana** | `http://YOUR_SERVER_IP:3001` | `admin` / `admin` |
| **Prometheus** | `http://YOUR_SERVER_IP:9090` (internal only) | No auth |

> **Security Note:** Grafana port 3001 should only be accessible from specific IPs.  
> The UFW rules already restrict this to localhost. If you need remote access,  
> uncomment the admin IP line in `security/ufw-rules.sh`.

### Pre-Configured Dashboards

When Grafana starts for the first time, it automatically provisions:

1. **Prometheus data source** — connected to the internal Prometheus instance
2. **SIM24 Overview Dashboard** — an overview panel with:
   - App uptime
   - HTTP request rate and error rate
   - Database connections
   - Memory & CPU usage
   - Redis cache hit rate
   - Disk usage
   - Nginx requests/sec

### Accessing the Dashboard

1. Open `http://YOUR_SERVER_IP:3001`
2. Log in (default: `admin` / `admin` — change immediately)
3. Click **Dashboards** → **SIM24** → **SIM24 - Overview Dashboard**

### Setting Up Alerts

In Grafana, you can set up alert rules for:

- **High error rate** (>5% 5xx errors in 5 minutes)
- **High memory usage** (>85% for 10 minutes)
- **High CPU usage** (>90% for 5 minutes)
- **Low Redis cache hit rate** (<50%)
- **Database connection exhaustion** (>100 connections)
- **Application down** (service unreachable)

Alert notifications can be sent via:
- Email (SMTP)
- Slack
- Telegram
- PagerDuty
- Webhooks

---

## 16. Logging & Troubleshooting

### Accessing Logs

```bash
# Application logs
docker compose logs -f --tail=100 app

# Nginx logs
docker compose logs -f --tail=100 nginx

# PostgreSQL logs
docker compose logs -f --tail=100 postgres

# Redis logs
docker compose logs -f --tail=100 redis

# All services
docker compose logs -f
```

### Common Issues

#### Issue: App container exits immediately
```bash
# Check logs
docker compose logs app

# Common causes:
# 1. DATABASE_URL is wrong or unreachable
# 2. Prisma migration failed
# 3. Missing environment variables
```

#### Issue: "ECONNREFUSED" on PostgreSQL
```bash
# Verify PostgreSQL is healthy
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Verify DATABASE_URL has the correct host (use "postgres" not "localhost")
```

#### Issue: Nginx 502 Bad Gateway
```bash
# Check if app is running
docker compose ps app

# Check app health
curl -f http://localhost:3000/api/auth/check

# Check nginx logs
docker compose logs nginx
```

#### Issue: Port already in use
```bash
# Check what's using the port
sudo lsof -i :80
sudo lsof -i :3000

# Stop the conflicting service or change the port in .env
```

#### Issue: "prisma: error Engine crashed"
```bash
# This usually means the database is unreachable
# Verify the DATABASE_URL environment variable
docker compose exec app env | grep DATABASE_URL

# Check if PostgreSQL is accepting connections
docker compose exec postgres pg_isready -U sim24
```

---

## 17. Security Checklist

- [ ] **UFW firewall is enabled** with only ports 80, 443, and SSH open
- [ ] **Fail2Ban is running** with SSH and Nginx jails
- [ ] **SSH password authentication is disabled** (key-based only)
- [ ] **Root SSH login is disabled** (`PermitRootLogin no` in `/etc/ssh/sshd_config`)
- [ ] **Docker runs as non-root user** (user in `docker` group)
- [ ] **JWT_SECRET is strong** (64 hex chars, generated with `openssl rand -hex 32`)
- [ ] **PostgreSQL password is strong** (generated with `openssl rand -base64 32`)
- [ ] **Grafana default password is changed** (after first login)
- [ ] **Grafana is bound to localhost** (not publicly accessible)
- [ ] **Nginx server_tokens is off** (hides Nginx version)
- [ ] **Nginx security headers are set** (X-Frame-Options, X-XSS-Protection, HSTS, etc.)
- [ ] **Rate limiting is enabled** on API endpoints (30 req/s general, 5 req/min on login)
- [ ] **HTTPS is configured** with Let's Encrypt (recommended)
- [ ] **Docker containers run as non-root user** (running as `nextjs` user)
- [ ] **Automatic security updates** are enabled (`sudo dpkg-reconfigure --priority=low unattended-upgrades`)
- [ ] **Backups are working** (check `docker compose logs backup`)
- [ ] **Monitoring alerts are configured** in Grafana

---

## Quick Reference Commands

```bash
# ─── Lifecycle ───
docker compose up -d              # Start all services
docker compose down               # Stop all services
docker compose restart app        # Restart a single service
docker compose ps                 # List running services
docker compose logs -f app        # Follow app logs

# ─── Build & Deploy ───
docker compose build app          # Rebuild app image
docker compose pull app           # Pull latest image
docker compose up -d --no-deps --force-recreate app  # Replace app container

# ─── Database ───
docker compose exec app npx prisma migrate deploy    # Run migrations
docker compose exec app npx prisma db seed           # Seed data
docker compose exec postgres psql -U sim24 -d sim24  # Connect to DB

# ─── Backup ───
docker compose exec backup backup.sh                 # Trigger manual backup
docker compose exec backup ls -la /backups           # List backups

# ─── Monitoring ───
curl http://localhost:9090/graph                     # Prometheus UI
curl http://localhost:3001/login                     # Grafana UI

# ─── System ───
docker system df                     # Disk usage
docker compose top                   # Running processes
docker stats                        # Live resource usage
```

---

## Conclusion

Your SIM24 application is now deployed with:

- ✅ **High availability** — Docker restarts containers on failure
- ✅ **Automated backups** — Daily PostgreSQL dumps with 7-day retention
- ✅ **Monitoring** — Real-time metrics via Prometheus + Grafana
- ✅ **Security** — Firewall, Fail2Ban, rate limiting, secure headers
- ✅ **CI/CD** — Automated testing and deployment via GitHub Actions
- ✅ **Scalability** — Redis caching ready for rate limiting and session storage
- ✅ **Rollback capability** — Database rollback and image versioning

For questions or issues, refer to the `PROJECT_REPORT.md` for a complete technical overview, or check the application logs with `docker compose logs -f app`.