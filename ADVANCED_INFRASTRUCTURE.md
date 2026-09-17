# SIM24 — Advanced Production Infrastructure Guide

> **Version:** 2.0.0  
> **Server Spec:** 16GB RAM | 4 CPU Cores | HDD Storage  
> **Last Updated:** 2026-06-15

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Visual Architecture Diagram](#2-visual-architecture-diagram)
3. [Service Roles & Responsibilities](#3-service-roles--responsibilities)
4. [Server Resource Allocation](#4-server-resource-allocation)
5. [Network Topology](#5-network-topology)
6. [Scaling Strategy](#6-scaling-strategy)
7. [Failover Behavior](#7-failover-behavior)
8. [Zero-Downtime Deployment](#8-zero-downtime-deployment)
9. [Backup & Restore Procedures](#9-backup--restore-procedures)
10. [Logging Stack (Loki + Promtail)](#10-logging-stack-loki--promtail)
11. [Metrics & Monitoring Stack](#11-metrics--monitoring-stack)
12. [Redis Queue System (BullMQ)](#12-redis-queue-system-bullmq)
13. [Object Storage (MinIO)](#13-object-storage-minio)
14. [HDD Optimization Guide](#14-hdd-optimization-guide)
15. [Cloudflare Integration](#15-cloudflare-integration)
16. [Security Reference](#16-security-reference)
17. [Deployment How-To](#17-deployment-how-to)
18. [Troubleshooting Common Issues](#18-troubleshooting-common-issues)

---

## 1. Architecture Overview

The SIM24 infrastructure follows a **microservices-inspired monolithic** architecture optimized for a single high-capacity server. All services run as Docker containers orchestrated via Docker Compose.

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Two Next.js app instances** | Provides redundancy during deploys; one instance handles requests while the other restarts. Each instance is fully independent and shares only the database and Redis. |
| **Nginx load balancer** | Distributes traffic between app instances with least-connections, upstream health checks, and automatic failover. |
| **HDD-optimized PostgreSQL** | Custom configuration tuned for mechanical disks: higher `random_page_cost`, larger buffers, aggressive vacuum schedule. |
| **Redis for caching + queue** | Single Redis instance serves both as application cache and BullMQ job queue backend. |
| **MinIO for file storage** | S3-compatible object storage for uploaded files, form attachments, and backup targets. |
| **Loki + Promtail for logs** | Lightweight log aggregation — Loki indexes only metadata (labels) and stores raw logs compressed in object storage. |
| **Prometheus + cAdvisor + exporters** | Full metrics pipeline: container-level stats from cAdvisor, host stats from node_exporter, DB/Redis/Nginx from dedicated exporters. |
| **Separate backup container** | Isolated backup process run on a cron schedule. Does not interfere with app or database performance. |
| **All ports bound to 127.0.0.1** | Only Nginx (port 80) is exposed to the public. All other services are internal-only for security. |

---

## 2. Visual Architecture Diagram

```
                          ┌──────────────────────────────────────────────┐
                          │            Cloudflare (CDN / WAF)            │
                          │  (Optional: DDoS protection, SSL, caching)   │
                          └──────────────────┬───────────────────────────┘
                                             │ Port 80/443
                                             ▼
                          ┌──────────────────────────────────────────────┐
                          │          Nginx Load Balancer (Port 80)       │
                          │  • least_conn upstream to app1:3000, app2:3000│
                          │  • Gzip compression                          │
                          │  • Rate limiting (30 r/s API, 5 r/m login)   │
                          │  • Static asset caching (1 year for _next/*) │
                          │  • WebSocket support                         │
                          │  • Security headers                          │
                          │  • Cloudflare Real IP                        │
                          └──────┬──────────────────┬────────────────────┘
                                 │                  │
                    ┌────────────▼──────┐    ┌──────▼────────────┐
                    │     app1:3000     │    │     app2:3000     │
                    │ Next.js Instance 1│    │ Next.js Instance 2│
                    │ • API routes      │    │ • API routes      │
                    │ • SSR / frontend  │    │ • SSR / frontend  │
                    │ • Health check    │    │ • Health check    │
                    └────────┬──────────┘    └─────────┬─────────┘
                             │                         │
         ┌───────────────────┼─────────────────────────┼─────────────────────┐
         │                   │                         │                     │
         ▼                   ▼                         ▼                     ▼
   ┌──────────┐       ┌──────────┐              ┌──────────┐          ┌──────────┐
   │PostgreSQL│       │  Redis   │              │  MinIO   │          │  Worker  │
   │  :5432   │       │  :6379   │              │  :9000   │          │  :3010   │
   │  HDD opt │       │ Cache +  │              │ S3 Object│          │  BullMQ  │
   │          │       │ Queue    │              │ Storage  │          │  Jobs    │
   └────┬─────┘       └────┬─────┘              └────┬─────┘          └────┬─────┘
        │                  │                         │                     │
        └──────────────────┼─────────────────────────┼─────────────────────┘
                           │                         │
                           ▼                         ▼
                 ┌──────────────────┐       ┌──────────────────┐
                 │   promtail       │       │  cAdvisor         │
                 │   Log Collector  │       │  Container Metrics│
                 └────────┬─────────┘       └────────┬──────────┘
                          │                          │
                          ▼                          ▼
                 ┌──────────────────┐       ┌──────────────────┐
                 │      Loki        │       │   Prometheus      │
                 │   Log Storage    │       │   Metrics Store   │
                 └────────┬─────────┘       └────────┬──────────┘
                          │                          │
                          └──────────┬───────────────┘
                                     ▼
                          ┌──────────────────┐
                          │     Grafana      │
                          │   :3001 (0wn)    │
                          │ Dashboards +     │
                          │ Alerting         │
                          └──────────────────┘

                 ┌──────────────────────────────────────┐
                 │         Backup Container              │
                 │  • Daily pg_dump at 03:00             │
                 │  • 14-day retention                   │
                 │  • Optional remote S3 sync (Sun 03:30)│
                 │  • SHA256 checksums                   │
                 │  • Prometheus metrics export          │
                 └──────────────────────────────────────┘
```

### Port Allocation

| Port | Service | Access | Notes |
|------|---------|--------|-------|
| **80** | Nginx | Public (0.0.0.0) | HTTP reverse proxy |
| **443** | Nginx | Public (0.0.0.0) | HTTPS (when SSL configured) |
| **3001** | Grafana | Internal (127.0.0.1) | Dashboard UI |
| **5432** | PostgreSQL | Internal (127.0.0.1) | Database |
| **6379** | Redis | Internal (127.0.0.1) | Cache + Queue |
| **9000** | MinIO API | Internal (127.0.0.1) | S3-compatible storage |
| **9001** | MinIO Console | Internal (127.0.0.1) | Management UI |
| **9090** | Prometheus | Internal (127.0.0.1) | Metrics |
| **3100** | Loki | Internal (127.0.0.1) | Log ingestion |
| **9100** | Node Exporter | Internal (127.0.0.1) | Host metrics |
| **9187** | Postgres Exporter | Internal (127.0.0.1) | DB metrics |
| **9121** | Redis Exporter | Internal (127.0.0.1) | Redis metrics |
| **9113** | Nginx Exporter | Internal (127.0.0.1) | Nginx metrics |
| **8080** | cAdvisor | Internal (127.0.0.1) | Container metrics |

---

## 3. Service Roles & Responsibilities

### Core Application

| Service | Count | Role | Image |
|---------|-------|------|-------|
| `app1` | 1 | Primary Next.js instance | Custom (Dockerfile) |
| `app2` | 1 | Secondary Next.js instance (redundancy) | Custom (Dockerfile) |
| `nginx` | 1 | Reverse proxy & load balancer | `nginx:1.25-alpine` |
| `worker` | 1 | BullMQ background job processor | Custom (Dockerfile) |

### Data Stores

| Service | Role | Image |
|---------|------|-------|
| `postgres` | Primary database | `postgres:15-alpine` |
| `redis` | Cache + message queue | `redis:7-alpine` |
| `minio` | S3-compatible file storage | `minio/minio:latest` |

### Monitoring & Observability

| Service | Role | Image |
|---------|------|-------|
| `prometheus` | Metrics collection & alerting | `prom/prometheus:v2.53.0` |
| `grafana` | Dashboard visualization | `grafana/grafana:11.1.0` |
| `loki` | Log aggregation | `grafana/loki:3.1.0` |
| `promtail` | Log shipping | `grafana/promtail:3.1.0` |

### Metrics Exporters

| Service | What it monitors | Image |
|---------|-----------------|-------|
| `node-exporter` | Host CPU, RAM, disk, network | `prom/node-exporter:v1.8.1` |
| `cadvisor` | Per-container CPU, memory, network, disk I/O | `gcr.io/cadvisor/cadvisor:v0.49.1` |
| `postgres-exporter` | PostgreSQL query performance, connections, locks | `prometheuscommunity/postgres-exporter:v0.15.0` |
| `redis-exporter` | Redis memory, hit rate, connected clients | `oliver006/redis_exporter:v1.63.0` |
| `nginx-exporter` | Nginx request count, active connections | `nginx/nginx-prometheus-exporter:1.3.0` |

### Maintenance

| Service | Role | Image |
|---------|------|-------|
| `backup` | Daily PostgreSQL dumps, retention, remote sync | `postgres:15-alpine` |
| `minio-setup` | One-time bucket creation on first run | `minio/mc:latest` |

---

## 4. Server Resource Allocation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   16 GB RAM — 4 vCPU — HDD — Single Server                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RAM Allocation:                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL  │  1 GB    │  ████████████████████████████████          │   │
│  │  app1        │  768 MB  │  █████████████████████████████████████████ │   │
│  │  app2        │  768 MB  │  █████████████████████████████████████████ │   │
│  │  Worker      │  512 MB  │  ████████████████████████                  │   │
│  │  Redis       │  256 MB  │  ████████████                              │   │
│  │  MinIO       │  512 MB  │  ████████████████████████                  │   │
│  │  Prometheus  │  512 MB  │  ████████████████████████                  │   │
│  │  Loki        │  512 MB  │  ████████████████████████                  │   │
│  │  Grafana     │  256 MB  │  ████████████                              │   │
│  │  Nginx       │  128 MB  │  ██████                                    │   │
│  │  Exporters   │  128 MB  │  ██████                                    │   │
│  │  Backup      │  256 MB  │  ████████████                              │   │
│  │  OS Overhead │  2 GB    │  ████████████████████████████████████████  │   │
│  ├──────────────┼──────────┼────────────────────────────────────────────┤   │
│  │  TOTAL       │ ~7.6 GB  │  (47.5% — buffer remaining)               │   │
│  └──────────────┴──────────┴────────────────────────────────────────────┘   │
│                                                                             │
│  CPU Allocation (4 cores):                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL  │  2.0 CPU  │  ████████████████████████████████████████ │   │
│  │  app1        │  1.0 CPU  │  ████████████████████                      │   │
│  │  app2        │  1.0 CPU  │  ████████████████████                      │   │
│  │  Worker      │  1.0 CPU  │  ████████████████████                      │   │
│  │  MinIO       │  0.5 CPU  │  █████████                                 │   │
│  │  Prometheus  │  0.5 CPU  │  █████████                                 │   │
│  │  Loki        │  0.5 CPU  │  █████████                                 │   │
│  │  Others      │  0.9 CPU  │  ████████████████                          │   │
│  ├──────────────┼──────────┼────────────────────────────────────────────┤   │
│  │  TOTAL       │  6.4 CPU  │  (over-provisioned for burst; 1.6x headroom)│   │
│  └──────────────┴──────────┴────────────────────────────────────────────┘   │
│                                                                             │
│  Disk Allocation (HDD):                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL  │  10 GB   │  ██████████████████████████████            │   │
│  │  MinIO       │   5 GB   │  ████████████████                          │   │
│  │  Prometheus  │   5 GB   │  ████████████████                          │   │
│  │  Loki        │   5 GB   │  ████████████████                          │   │
│  │  Docker      │   3 GB   │  ██████████                                │   │
│  │  App          │   2 GB   │  ██████                                    │   │
│  │  OS + Other  │  10 GB   │  ██████████████████████████████            │   │
│  ├──────────────┼──────────┼────────────────────────────────────────────┤   │
│  │  TOTAL       │  40 GB   │  (recommend 50 GB+ for growth)            │   │
│  └──────────────┴──────────┴────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Resource Limit Configuration

| Service | `mem_limit` | `cpus` | `mem_reservation` | `pids_limit` |
|---------|-------------|--------|-------------------|--------------|
| app1 | 768M | 1.0 | 512M | 256 |
| app2 | 768M | 1.0 | 512M | 256 |
| worker | 512M | 1.0 | 256M | 256 |
| postgres | 1G | 2.0 | 512M | 200 |
| redis | 256M | 0.5 | 128M | — |
| minio | 512M | 0.5 | 256M | — |
| nginx | 128M | 0.3 | 64M | — |
| prometheus | 512M | 0.5 | 256M | — |
| grafana | 256M | 0.3 | 128M | — |
| loki | 512M | 0.5 | 256M | — |
| exporters | 128M | 0.2 | 64M | — |
| backup | 256M | 0.2 | 128M | — |

---

## 5. Network Topology

```
Docker Network: sim24-net (bridge, subnet: 172.24.0.0/16)
                │
                ├── postgres (172.24.0.2)
                ├── redis    (172.24.0.3)
                ├── app1     (172.24.0.4)
                ├── app2     (172.24.0.5)
                ├── nginx    (172.24.0.6)  ← Public: 0.0.0.0:80
                ├── minio    (172.24.0.7)
                ├── prometheus (172.24.0.8)
                ├── grafana  (172.24.0.9)
                ├── loki     (172.24.0.10)
                ├── promtail (172.24.0.11)
                ├── worker   (172.24.0.12)
                └── backup   (172.24.0.13)
```

**DNS Resolution:** Docker's embedded DNS (`127.0.0.11`) resolves service names within the network.  
All services communicate using service names: `app1`, `app2`, `postgres`, `redis`, etc.

---

## 6. Scaling Strategy

### Current Architecture (Single Server, 16GB)

The infrastructure is designed for **vertical scaling** within a single server:

| Component | Current | Max Recommended |
|-----------|---------|-----------------|
| App instances | 2 | 4 (requires more CPU + RAM) |
| Worker instances | 1 | 3 (for higher queue throughput) |
| PostgreSQL connections | 100 | 200 (with more RAM) |
| Redis memory | 200 MB | 1 GB (with more RAM) |

### Scaling to Multi-Server (Future)

To scale beyond a single server:

1. **Extract PostgreSQL** to a dedicated database server
2. **Extract Redis** to a dedicated caching layer
3. **Add a second Nginx** as a failover pair
4. **Run app instances** across multiple Docker hosts
5. **Add a shared file system** (NFS or distributed MinIO) for uploaded files

### Horizontal App Scaling

The app instances are fully stateless — they share nothing except the database and Redis.  
To add more instances:

```yaml
# In docker-compose.yml, add:
app3:
  build: .
  container_name: sim24-app3
  # ... same config as app1
  depends_on:
    - postgres
    - redis

# Add to nginx upstream:
# server app3:3000 max_fails=5 fail_timeout=30s weight=1;
```

### Queue Worker Scaling

BullMQ workers can be scaled independently:

```yaml
worker2:
  build: .
  container_name: sim24-worker2
  environment:
    QUEUE_CONCURRENCY: 5
    SERVICE_TYPE: worker
  command: ["node", "worker.js"]
```

---

## 7. Failover Behavior

### Application Failover

```
┌─────────┐     ┌─────────┐
│  app1   │ ──▶ │  app2   │  (Nginx detects failure via health check)
└─────────┘     └─────────┘
     │                │
     ▼                ▼
Nginx: app1 health check fails (5 x 15s = 75s)
Nginx: marks app1 as down, routes all traffic to app2
Nginx: continues health-checking app1 every 15s
Nginx: when app1 recovers, adds it back to the pool
```

- **Detection time:** 75 seconds (5 health check failures × 15s interval)
- **Recovery time:** ~15 seconds after container restarts
- **Zero data loss:** App instances share the same database

### Database Failover

PostgreSQL runs as a single instance in this setup. For production-critical needs:

1. Set up **WAL streaming replication** to a standby
2. Use **pgpool-II** or **Patroni** for automatic failover
3. Or use a managed PostgreSQL service (RDS, Cloud SQL, etc.)

### Redis Failover

Redis runs as a single instance. For production-critical needs:

1. Enable **Redis Sentinel** for automatic failover
2. Or use **Redis Cluster** for sharding
3. Or use a managed Redis service (ElastiCache, Upstash, etc.)

### Nginx Failover

Nginx is a single point of failure on port 80. For high availability:

1. Run a second Nginx instance on a different port
2. Use **keepalived** for virtual IP failover
3. Or put Cloudflare in front and use their **Load Balancing** feature

### Recovery Procedure

If the entire server goes down:

```bash
# 1. SSH into server
ssh deploy@YOUR_SERVER_IP

# 2. Check Docker status
docker ps -a

# 3. Restart all services
docker compose up -d

# 4. Verify health
curl -f http://localhost/api/auth/check
curl -f http://localhost:3001/api/health  # Grafana

# 5. Check logs if something failed
docker compose logs --tail=50 app1
```

---

## 8. Zero-Downtime Deployment

### How It Works

The architecture supports **rolling updates** with zero downtime:

1. Nginx load-balances traffic between `app1` and `app2`
2. During a deploy, we update one instance at a time
3. Nginx automatically routes traffic away from the instance being updated

### Zero-Downtime Deploy Script

```bash
#!/bin/bash
# zero-downtime-deploy.sh
# Run this on the server to deploy with zero downtime

set -e

echo "=== Starting Zero-Downtime Deployment ==="
cd /opt/sim24

# Step 1: Pull latest code
git pull origin main

# Step 2: Build new Docker image
docker compose build app1

# Step 3: Update app2 first (if running)
echo "Updating app2..."
docker compose up -d --no-deps --force-recreate app2
echo "Waiting for app2 health check..."
sleep 30

# Verify app2 is healthy
if ! curl -sf http://localhost:3000/api/auth/check; then
  echo "app2 failed health check!"
  exit 1
fi

# Step 4: Now update app1
echo "Updating app1..."
docker compose up -d --no-deps --force-recreate app1
echo "Waiting for app1 health check..."
sleep 30

# Verify app1 is healthy
if ! curl -sf http://localhost:3000/api/auth/check; then
  echo "app1 failed health check!"
  exit 1
fi

# Step 5: Run database migrations (if any)
echo "Running database migrations..."
docker compose exec -T app1 npx prisma migrate deploy || echo "No pending migrations."

# Step 6: Clean up old images
docker image prune -f

echo "=== Deployment completed successfully ==="
```

### CI/CD Integration (GitHub Actions)

The existing `.github/workflows/deploy.yml` pipeline has been updated to:

1. Build the Docker image once
2. Push to GHCR with both `latest` and `sha-<commit>` tags
3. SSH into server and perform the rolling update
4. Run Prisma migrations as the last step
5. Post-deployment health check against the public endpoint

---

## 9. Backup & Restore Procedures

### Automated Daily Backups

| Schedule | Action | Retention |
|----------|--------|-----------|
| Daily at 03:00 | Full `pg_dump` → gzip → local volume | 14 days |
| Weekly Sunday 03:30 | Full `pg_dump` → gzip → local + remote S3 | 14 days local, per remote config |

### Backup Features

- **Compressed:** gzip compression (typically 80-90% reduction)
- **Checksummed:** SHA256 hash recorded for each backup
- **Size tracked:** File size written to metrics file
- **Prometheus metrics:** Backup success/failure, timestamp, size

### Local Backup Location

```
/backups/                          # Docker volume: pgbackups
├── sim24_20260615_030000.sql.gz   # Daily backup
├── sim24_20260614_030000.sql.gz   # Previous day
├── sim24_20260613_030000.sql.gz
├── latest.sql.gz                  # Symlink to most recent
├── backup_summary.txt             # Last backup metadata
└── .metrics                       # Prometheus file-based metrics
```

### Manual Backup

```bash
# Trigger immediate backup
docker compose exec backup backup.sh

# Backup with remote upload
docker compose exec backup backup.sh --remote
```

### Restore from Backup

```bash
# List available backups
docker compose exec backup backup-restore.sh list

# Restore the latest backup
docker compose exec backup backup-restore.sh latest

# Restore a specific backup
docker compose exec backup backup-restore.sh sim24_20260615_030000.sql.gz
```

---

## 10. Logging Stack (Loki + Promtail)

### Architecture

```
Docker Containers  ──▶  Promtail  ──▶  Loki  ──▶  Grafana
  (logs via          (reads Docker      (indexes &      (visualizes
   json-file)         logs + nginx       stores logs)    via Explore)
                      access/error)
```

### What's Collected

| Source | What's Logged | Labels |
|--------|---------------|--------|
| All Docker containers | JSON-formatted docker logs | `job: docker`, `container_name` |
| Nginx access | Apache-style combined format | `job: nginx`, `type: access` |
| Nginx error | Error level (warn/error/crit) | `job: nginx`, `type: error`, `level` |
| Application (app1/app2/worker) | Application stdout/stderr | `job: app`, `app_instance` |
| System logs | /var/log/syslog | `job: system`, `process` |

### Log Retention

- **Storage:** 7 days (configurable via `LOKI_RETENTION_PERIOD`)
- **Compaction:** Runs every 10 minutes
- **Query limit:** 5000 entries max per query

### Querying Logs in Grafana

1. Open Grafana → Explore
2. Select data source: **Loki**
3. Use LogQL queries:

```logql
# All logs from the app
{job="app", app_instance="app1"}

# Nginx 5xx errors
{job="nginx", type="error"} |= "5[0-9][0-9]"

# Errors in the last hour
{job="app"} |= "error" |= "Error" |= "ERROR"

# Rate of errors by instance
rate({job="app"} |~ "error|Error|ERROR" [5m])
```

---

## 11. Metrics & Monitoring Stack

### Metrics Pipeline

```
                        ┌──────────────┐
Host Stats ────────────▶│ Node Exporter│────┐
                        └──────────────┘    │
                        ┌──────────────┐    │
Container Stats ───────▶│   cAdvisor   │────┤
                        └──────────────┘    │
                        ┌──────────────┐    │    ┌──────────┐    ┌─────────┐
PostgreSQL ─────────────┤Postgres Exp │────┼───▶│Prometheus│───▶│ Grafana │
                        └──────────────┘    │    └──────────┘    └─────────┘
                        ┌──────────────┐    │
Redis ──────────────────┤Redis Exporter│────┤
                        └──────────────┘    │
                        ┌──────────────┐    │
Nginx ─────────────────▶│Nginx Exporter│────┘
                        └──────────────┘
```

### Pre-Configured Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| AppDown | `up{job="app"} == 0` for 1m | Critical |
| HighErrorRate | 5xx rate > 5% for 5m | Warning |
| HighLatency | 95th percentile > 2s for 5m | Warning |
| PostgresDown | `up{job="postgres"} == 0` for 1m | Critical |
| PostgresHighConnections | Active connections > 80 for 5m | Warning |
| PostgresDiskFull | Disk usage > 85% for 5m | Critical |
| RedisDown | `up{job="redis"} == 0` for 1m | Critical |
| RedisMemoryHigh | Memory > 80% for 5m | Warning |
| HighCPUUsage | Host CPU > 85% for 10m | Warning |
| HighMemoryUsage | Host memory > 85% for 5m | Warning |
| DiskSpaceLow | Available disk < 15% for 5m | Critical |
| ContainerRestarting | Container has restarted | Warning |
| BackupFailed | No backup in 24h | Critical |

### Grafana Dashboards

**SIM24 - Overview Dashboard** (auto-provisioned):
- App uptime (stat panel)
- HTTP request rate per instance (graph)
- HTTP error rate percentage (graph)
- Database connections (graph)
- Memory usage gauge (with thresholds: 70% yellow, 90% red)
- CPU usage (graph)
- Redis cache hit rate (graph)
- Disk usage gauge
- Nginx requests/sec (graph)

---

## 12. Redis Queue System (BullMQ)

### Architecture

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│  app1    │          │  app2    │          │  worker  │
│ (producer)│         │ (producer)│         │(consumer)│
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     └──────────┬──────────┘                     │
                │                                │
         ┌──────▼──────┐                  ┌──────▼──────┐
         │    Redis    │◀────────────────│  BullMQ     │
         │  Queue Keys │                  │  Processor  │
         └─────────────┘                  └─────────────┘
```

### How It Works

1. **Producer** (app1/app2): Adds jobs to Redis queue via BullMQ
2. **Queue** (Redis): Stores pending, active, completed, and failed jobs
3. **Consumer** (worker): Pulls jobs from Redis, processes them, marks as done

### Environment Variables

```env
QUEUE_REDIS_URL=redis://redis:6379
QUEUE_CONCURRENCY=5
SERVICE_TYPE=worker
```

### Usage in Application Code (Not Modifying Business Logic)

The worker container is pre-configured but idle (`tail -f /dev/null`).  
To integrate with the app, a developer would:

```typescript
// lib/queue.ts — Example integration (not implemented, just reference)
import { Queue, Worker } from 'bullmq';

const connection = { host: 'redis', port: 6379 };

// Producer (add to app1 or app2)
export const formSubmissionQueue = new Queue('form-submissions', { connection });

await formSubmissionQueue.add('process-form', {
  formId: 'abc123',
  formType: 'sell_direct',
  formData: { ... }
});

// Consumer (in worker container)
const worker = new Worker('form-submissions', async (job) => {
  const { formId, formData } = job.data;
  // Process in background (send to CRM, send SMS, generate PDF, etc.)
}, { connection, concurrency: 5 });
```

---

## 13. Object Storage (MinIO)

### Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────────────────────────────┐
│  app1    │────▶│  MinIO   │────▶│  /data (Docker volume: miniodata)  │
│  app2    │     │  :9000   │     │  Bucket: sim24-uploads            │
└──────────┘     └──────────┘     └──────────────────────────────────┘
```

### Access Credentials

| Variable | Description |
|----------|-------------|
| `MINIO_ROOT_USER` | Admin username (default: `sim24admin`) |
| `MINIO_ROOT_PASSWORD` | Admin password (REQUIRED to set) |
| `MINIO_ENDPOINT` | Internal API endpoint: `http://minio:9000` |
| `MINIO_BUCKET` | Default bucket: `sim24-uploads` |

### Auto-Created Bucket

The `minio-setup` service runs once after MinIO is healthy and creates:
- Bucket: `sim24-uploads`
- Policy: Public read (for serving uploaded files directly)

### How to Use in Application

```typescript
// lib/storage.ts — Example S3 integration (reference only)
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'sim24admin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || '',
  },
  forcePathStyle: true,  // Required for MinIO
});

// Upload a file
export async function uploadFile(filename: string, buffer: Buffer, mimeType: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.MINIO_BUCKET || 'sim24-uploads',
    Key: filename,
    Body: buffer,
    ContentType: mimeType,
  });
  return s3.send(command);
}

// Get a file URL
export function getFileUrl(filename: string) {
  return `${process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET}/${filename}`;
}
```

### Management Console

Access the MinIO web console at `http://YOUR_SERVER_IP:9001`  
(Only accessible from localhost — use SSH tunnel or VPN)

---

## 14. HDD Optimization Guide

### PostgreSQL Settings for HDD

| Parameter | Recommended Value | Rationale |
|-----------|------------------|-----------|
| `shared_buffers` | 512 MB | ~25% of total RAM — cache frequently accessed data |
| `effective_cache_size` | 1536 MB | Tells planner OS can cache ~1.5 GB |
| `work_mem` | 32 MB | Per-operation sort memory (higher = faster sorts on HDD) |
| `maintenance_work_mem` | 128 MB | For VACUUM, CREATE INDEX — higher = faster maintenance |
| `random_page_cost` | 4.0 | HDD is ~4x slower than SSD for random reads |
| `seq_page_cost` | 2.0 | Sequential reads also suffer on HDD vs SSD |
| `effective_io_concurrency` | 2 | HDD can handle ~2 concurrent I/O operations |
| `wal_writer_delay` | 1000 ms | Less frequent WAL writes = fewer disk seeks |

### Docker Log Rotation

All containers use:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"    # Maximum log file size
    max-file: "3"      # Keep 3 rotated files
    compress: "true"   # Compress rotated logs
```

This prevents logs from consuming excessive disk space on a HDD.

### Filesystem Recommendations

- Use **ext4** with `noatime` mount option to reduce writes
- Consider using **XFS** for PostgreSQL data volume
- Keep Docker volumes on a separate partition from the OS
- Monitor disk I/O with `iostat -x 5`

---

## 15. Cloudflare Integration

### DNS Setup

```
Type: A
Name: @
IPv4: YOUR_SERVER_IP
Proxy status: Proxied (orange cloud)
TTL: Auto
```

### Nginx Configuration

The nginx config already includes all Cloudflare IP ranges and the correct header:

```nginx
set_real_ip_from 103.21.244.0/22;  # (all Cloudflare ranges)
real_ip_header CF-Connecting-IP;
real_ip_recursive on;
```

### What Cloudflare Provides

| Feature | How It Works |
|---------|--------------|
| DDoS Protection | Always-on, layer 3/4/7 |
| SSL/TLS | Flexible/Full/Full-Strict |
| Caching | Cache static assets at edge |
| WAF | OWASP rules, rate limiting |
| CDN | Global edge network |
| Analytics | Request metrics, security events |

### Cache Rules (Recommended)

Create a Cloudflare Cache Rule:
- **URL:** `sim24.ir/_next/static/*`
- **Cache Level:** Standard
- **Edge TTL:** 1 month
- **Browser TTL:** 1 year

---

## 16. Security Reference

### Exposed Ports

| Port | Service | Access Scope |
|------|---------|--------------|
| 80 | Nginx HTTP | Public (Cloudflare proxied) |
| 443 | Nginx HTTPS | Public (when SSL configured) |

All other ports are bound to `127.0.0.1` only.

### UFW Rules Summary

```
Allow: 80/tcp (HTTP)
Allow: 443/tcp (HTTPS)
Allow: SSH (with rate limiting)
Deny: All other incoming traffic
```

### Fail2Ban Jails

| Jail | Filter | Max Retry | Ban Time |
|------|--------|-----------|----------|
| sshd | SSH auth failures | 5 | 1 hour |
| nginx-http-auth | HTTP auth failures | 10 | 10 min |
| nginx-badbots | Known bad bots | 1 | 24 hours |
| nginx-nohome | 404 scanning | 10 | 1 hour |

### Docker Security

- Containers run as **non-root user** (`nextjs:nextjs` UID 1001)
- Read-only root filesystem where possible
- `--cap-drop=ALL` for application containers (future enhancement)
- Seccomp default profile applied automatically

---

## 17. Deployment How-To

### First-Time Setup on Fresh Ubuntu Server

```bash
# 1. SSH into server
ssh root@YOUR_SERVER_IP

# 2. Update system
apt update && apt upgrade -y

# 3. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 4. Create project directory & clone
mkdir -p /opt/sim24 && cd /opt/sim24
git clone https://github.com/YOUR_ORG/sim24.git .

# 5. Configure environment
cp .env.example .env
nano .env   # Set all required variables

# 6. Apply firewall
sudo bash security/ufw-rules.sh
sudo cp security/fail2ban-jail.conf /etc/fail2ban/jail.d/sim24.conf
sudo systemctl restart fail2ban

# 7. Build and start all services
docker compose build
docker compose up -d

# 8. Run migrations
docker compose exec app1 npx prisma migrate deploy

# 9. Optional: Seed database
docker compose exec app1 npx prisma db seed

# 10. Verify
curl -f http://localhost/api/auth/check
```

### Starting the Stack

```bash
docker compose up -d
```

### Stopping the Stack

```bash
docker compose down
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app1
docker compose logs -f nginx

# Last 100 lines
docker compose logs --tail=100 app1
```

### Updating the Stack

```bash
# Pull latest code
git pull origin main

# Build new image
docker compose build app1

# Rolling update (app2 first, then app1)
docker compose up -d --no-deps --force-recreate app2
sleep 30
docker compose up -d --no-deps --force-recreate app1

# Run migrations
docker compose exec app1 npx prisma migrate deploy

# Clean old images
docker image prune -f
```

---

## 18. Troubleshooting Common Issues

### App Container Crashes Immediately

```bash
# Check logs
docker compose logs app1

# Common causes:
# - DATABASE_URL is wrong or unreachable
# - JWT_SECRET not set
# - Port 3000 already in use
```

### Nginx 502 Bad Gateway

```bash
# Check if app instances are running
docker compose ps app1 app2

# Test app health directly
curl -f http://localhost:3000/api/auth/check

# Check nginx config syntax
docker compose exec nginx nginx -t
```

### Database Connection Refused

```bash
# Check PostgreSQL is healthy
docker compose ps postgres

# Check connection from app
docker compose exec app1 sh -c "nc -zv postgres 5432"

# Verify DATABASE_URL in env
docker compose exec app1 env | grep DATABASE_URL
```

### High Disk Usage

```bash
# Check Docker disk usage
docker system df

# Find large volumes
docker volume ls | xargs docker volume inspect

# Check backup volume size
docker run --rm -v pgbackups:/backups alpine du -sh /backups

# Clean unused Docker data
docker system prune -af
```

### Prometheus or Grafana Not Starting

```bash
# Check permissions on config files
ls -la prometheus/prometheus.yml
ls -la grafana/datasources/

# Fix if needed
chmod 644 prometheus/*.yml
chmod 644 grafana/datasources/*.yml
```

### Loki Promtail Can't Read Docker Logs

```bash
# Check promtail logs
docker compose logs promtail

# Common cause: insufficient permissions
# Fix: Ensure /var/lib/docker/containers is readable
# If running Docker rootless, adjust paths
```

---

## Appendix: Quick Reference

```bash
# ─── Lifecycle ───
docker compose up -d                    # Start all services
docker compose down                     # Stop all services
docker compose restart app1             # Restart a service
docker compose ps                       # List running services

# ─── Logs ───
docker compose logs -f --tail=100 app1  # Follow app1 logs
docker compose logs -f nginx            # Follow nginx logs
docker compose logs -f postgres         # Follow database logs

# ─── Database ───
docker compose exec app1 npx prisma migrate deploy     # Run migrations
docker compose exec app1 npx prisma db seed            # Seed data
docker compose exec postgres psql -U sim24 -d sim24    # SQL console

# ─── Backups ───
docker compose exec backup backup.sh                   # Manual backup
docker compose exec backup backup-restore.sh list      # List backups
docker compose exec backup backup-restore.sh latest    # Restore latest

# ─── Monitoring ───
open http://localhost:3001                              # Grafana
open http://localhost:9090                              # Prometheus
open http://localhost:9001                              # MinIO Console

# ─── System ───
docker stats                            # Live resource usage
docker compose top                      # Process list
htop                                    # Host resource monitor
```

---

> **Document Version:** 2.0.0  
> **Author:** DevOps Engineering  
> **Review Date:** 2026-06-15  
> **Next Review:** 2026-09-15