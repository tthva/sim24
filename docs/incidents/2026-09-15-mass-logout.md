# Incident Report — Mass Logout & Login Outage (2026-09-15)

**Status:** RESOLVED
**Severity:** SEV-1 (total loss of operator/admin access, ~1h40m auth outage; login endpoint 500 for ~16 min)
**Systems affected:** SIM24 authentication (all operators + admin), Postgres connectivity
**Related:** JWT_SECRET rotation runbook (executed same day, evening); `.wslconfig` memory cap (applied same day)

---

## 1. Executive summary

At **13:19:42 local (UTC+3:30)** the WSL2 VM hosting all Docker containers was
restarted by a WSL update cycle (`wslinstaller` activity; Docker Desktop itself
was NOT restarted — up since 09-12). Postgres, Redis, and MinIO went down and
were recreated at **09:49:53–55Z (13:19:53 local)**.

Because `requireAuth` performs a **fail-closed** DB check (tokenVersion +
session revocation status) on every guarded API call, the outage instantly
became a fleet-wide 401 storm. The client-side 401 handlers (`WithAuth`,
`AutoRefreshSession`) then cleared each browser's auth cookies
(`POST /api/auth/logout` + redirect to `/login?force=1`) — every operator
landed on the login page.

Login itself returned **500 P1001** ("Can't reach database server at
`127.0.0.1:5433`") from **13:19:54 until ~13:35:40**: the Windows loopback
port proxy (winnat) restored host→container connectivity several minutes after
the containers were already healthy.

**Resolution:** `net stop/start winnat` + `pm2 reload sim24`. Login confirmed
for all operators and admin. **No data lost; no server-side session mass
revocation** (476/487 sessions still live in DB afterwards).

---

## 2. Timeline (local time = UTC+3:30)

| Time | Event | Evidence |
|---|---|---|
| 12:28:47–12:30:40 | PM2 workers stopped & restarted (pre-incident, unrelated; JWT is stateless) | `~/.pm2/pm2.log`: "App [sim24:0] exited with code [1] via signal [SIGINT]" → "online" |
| **13:19:42–45** | **WSL2 VM bounced** — all `wsl`, `wslhost`, `wslrelay`, `wslinstaller` processes started. Docker Desktop up since 09-12 (not restarted) | `Get-Process wsl*` start times |
| **13:19:53–55** | All Docker containers recreated simultaneously | `docker inspect`: app2/worker `startedAt=2026-09-15T09:49:53Z`; Postgres `pg_postmaster_start_time()=09:49:55Z` |
| 13:18:17 | One routine user logout (operator, 192.168.1.8) — just before the bounce | `pm2-out.log` `"event":"logout" … status:200` |
| **13:19:54–13:35:40** | **Login outage:** every `POST /api/operator/auth` → 500 P1001 | `pm2-error.log`: `Invalid prisma.user.findUnique() invocation: Can't reach database server at 127.0.0.1:5433` + `code: 'P1001'` |
| 13:30:38–41 | `pm2 reload sim24` ran — did NOT fix connectivity (P1001 continued at 13:35) | `~/.pm2/pm2.log` reload sequence (`_old_` workers stopped) |
| ~13:36 | Diagnostics: `127.0.0.1:{5433,16379,3000}` reachable; `sim24-db` healthy; sessions intact (476/487 live) | `Test-NetConnection`, `docker ps`, read-only SQL |
| ~15:0x | `net stop/start winnat` + `pm2 reload sim24` → **login restored** | User confirmation; all accounts back on dashboards |

---

## 3. Root cause chain

```
WSL2 VM restart (wsl update cycle, 13:19:42)
        ├─► Postgres/Redis/MinIO down → recreated 09:49:53Z
        ├─► host→127.0.0.1:5433 loopback proxy (winnat) down ~16 min
        │      (container "healthy" long before host proxy recovered)
        ├─► requireAuth DB check fails CLOSED on every guarded API
        │      → 401 for ALL logged-in users (simultaneous "random logout")
        ├─► client 401 handlers clear cookies + redirect /login?force=1
        │      (correct — but with DB down, login also fails)
        └─► POST /api/operator/auth → 500 P1001 (13:19:54–13:35:40)
               → "suddenly logged out AND cannot log back in"
```

**Why the outage outlived the containers:** Docker publishes ports via the
**winnat loopback proxy**; after a WSL VM bounce that proxy re-establishes
lazily. Containers were `Up (healthy)` from ~13:20, but
`Test-NetConnection 127.0.0.1 -Port 5433` only succeeded after the winnat
restart. PM2 workers (host processes) correctly reported P1001 even while
`docker exec` DB queries worked — the container was fine; the host-side pipe
was not.

**Ruled out:**
- *Replay cascade:* zero `[AUTH] Refresh token reuse detected!` lines on 09-15
  (only pair: 2026-09-10 05:58:30, `operator_price`, from the pre-30s-grace
  race — `tokenVersion=2` dates from then).
- *Mass revocation:* `live_sessions=476/487`, `live_refresh=481/596`, all
  users `active=t`, tokenVersions 0 (except operator_price=2).
- *JWT_SECRET mismatch:* an early diagnostic misread `pm2 env` (split on `=`
  inside the base64-padded value) as a "5-char secret". A runtime signature
  probe (`GET /login` with a `.env`-signed token → 307 to landing) proved
  workers verify with the `.env` secret. Workers consistent.
- *Redis loss:* not the auth store; rate limiter is fail-open.

---

## 4. Impact

- **Availability:** all operators + admin logged out at 13:19; login restored
  ~15:0x (≈1h40m total outage; login endpoint 500 for the first ~16 min).
- **Data:** none lost. No mass token revocation.
- **User action:** every user re-logged in after the fix (cookies cleared
  client-side; server-side sessions mostly still live).
- **Side damage:** `sim24-app1` crash-looped after the bounce
  (`npx prisma migrate deploy` → npm registry failure → 52 restarts, ~94%
  CPU). Resolved same day by stopping app1/app2/worker (Docker apps unused —
  PM2 serves :3000; docker ports unpublished, nginx not running).

## 5. Resolution

```
net stop winnat        # (Admin PowerShell) — drops ALL Docker published ports briefly
Start-Sleep 5
net start winnat       # re-establishes 5433/16379/9000-9001/9187/9121/9100 forwards
Start-Sleep 3
pm2 reload sim24       # rebuild Prisma pools against the live DB
```
Login verified for operator_product and all other accounts. CPU dropped from
94% (app1 crash-flap) to ~0.6%; `vmmem` capped via `.wslconfig`
(`memory=3GB, processors=2, swap=1GB`) → 4109 → 1585 MB (separate workstream,
same day).

---

## 6. The PM2 env snapshot pitfall (latent, must-fix with rotation)

PM2 stores the environment **captured at the last `pm2 start`** and reuses it
on plain `pm2 reload`/`restart`. `ecosystem.config.js` re-parses `.env` via
`loadEnvFile()` on every reload — but PM2's daemon-level env merge can shadow
config-injected values, and a stale snapshot survives any reload that omits
`--update-env`.

**Consequence:** if `.env` is edited (JWT rotation, DB URL change), plain
`pm2 reload` may silently keep serving with the **old** values.

**Rule going forward:**
```
After ANY .env change:   pm2 reload sim24 --update-env
After a PM2 daemon restart (pm2 update / reboot / pm2 kill): verify env:
    npx pm2 env 0 | findstr JWT_SECRET   (compare against .env — never print the value)
```

> ⚠️ 2026-09-15: the JWT_SECRET was exposed in plaintext in an engineering
> transcript during this investigation (a masking regex in a diagnostic
> command failed). **Rotation is scheduled the same day** per the runbook
> (`openssl rand -hex 32` → `.env` (+ `.env.local`) → `pm2 reload sim24
> --update-env` → one-time re-login for everyone). Do not reuse the leaked
> value anywhere.

---

## 7. Action items

| # | Item | Priority | Status |
|---|---|---|---|
| 1 | JWT_SECRET rotation (leak remediation) | P0 | Scheduled 2026-09-15 evening (manual) |
| 2 | `docker start sim24-backup` after 03:00 window | P1 | Pending (backup suspended) |
| 3 | Fix container healthchecks: `curl -f` treats 401 as failure → status-code matcher or unauthenticated 200 probe | P1 | Pending |
| 4 | Auth resilience: short-lived (30–60s) in-worker negative cache for tokenVersion/session checks so a DB blip does not eject the fleet (deliberate security trade-off — decide explicitly) | P1 | Proposed |
| 5 | P0 endpoint security review: `GET /api/sim-value`, `GET /api/search-forms`, `POST /api/webhook/crm` (HMAC), remove `/api/debug-secret` | P1 | Pending |
| 6 | JWT access lifetime 60m → 15m **only after** Redis-backed tokenVersion/session cache exists (otherwise 15m + fail-closed DB = this incident, amplified) | P2 | Pending |
| 7 | Stop WSL/Docker updates auto-running during work hours; schedule `wsl --update` maintenance window | P2 | Pending |
| 8 | Finalize or formally retire the Docker serving track (app1/app2/worker stopped 2026-09-15; PM2 is canonical) | P2 | Pending |
| 9 | Fix `users.lastLogin` bookkeeping (stale — max 2026-08-23 despite daily logins) | P3 | Pending |
| 10 | Loki crash-loop (exit 1, 32+ restarts) — fix config or remove from stack | P3 | Pending |
| 11 | Strip UTF-8 BOM + quoted values from `.env` (caused a false-negative in a Node-side env parser during diagnosis) | P3 | Pending |

---

## 8. Diagnostic appendix

```powershell
# WSL bounce evidence
Get-Process wsl,wslhost,wslrelay,wslinstaller | Select Name,Id,StartTime

# Container recreate evidence (identical timestamps)
docker inspect sim24-db --format '{{.State.StartedAt}}'

# Host-side reachability (the discriminator: container healthy vs host proxy)
Test-NetConnection 127.0.0.1 -Port 5433

# DB state (read-only, via docker exec — bypasses the broken host proxy)
$q | docker exec -i sim24-db psql -U sim24 -d sim24
#   → live_sessions=476/487, live_refresh=481/596  (no mass revocation)

# JWT secret consistency probe (signature-only, no DB, no values printed)
#   sign a token with the .env secret → GET /login → 307 = workers use .env secret

# PM2 env snapshot pitfall
npx pm2 env 0 | findstr JWT_SECRET    # compare length/hash vs .env, never print
```

### Lessons learned
1. **Fail-closed auth + shared-fate DB = fleet-wide logout on any DB blip.**
   The security design is correct; the resilience gap is real. Mitigate via
   action item 4 — not by weakening fail-closed.
2. **"Container healthy" ≠ "host can reach it"** on Docker Desktop/WSL2.
   Always probe from the consumer's own network position (the host, for PM2).
3. **PM2 env snapshots are sticky.** `.env` changes are invisible to reloads
   without `--update-env`.
4. **Mask secrets by construction, not by regex afterthought** — printing
   `pm2 env` raw leaked the secret; rotation was required.
5. Keep a read-only diagnostic path into the DB (`docker exec … psql`) — it
   worked through the whole host-proxy outage and anchored every decision.
