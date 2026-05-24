# Deployment — cmipaportal.com

CI/CD pipeline that builds the Next.js app on GitHub Actions and atomically
deploys it to a VPS via SSH. Capistrano-style releases with automatic
rollback on failure.

---

## Architecture

```
┌──────────────┐    git push main     ┌────────────────────┐
│  Developer   │ ───────────────────▶ │  GitHub repo       │
└──────────────┘                      └─────────┬──────────┘
                                                │ webhook
                                                ▼
                                      ┌────────────────────┐
                                      │  GitHub Actions    │
                                      │  - build .next     │
                                      │  - typecheck       │
                                      │  - tar artifact    │
                                      └─────────┬──────────┘
                                                │ scp + ssh
                                                ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  VPS (45.32.150.96 · Ubuntu)                                 │
   │                                                              │
   │  /var/www/cmipaportal/                                       │
   │    ├── releases/20260524-143022-a1b2c3d/                     │
   │    ├── releases/20260524-150811-d4e5f6a/                     │
   │    ├── releases/20260524-160419-9z8y7x6/  ◀── new            │
   │    ├── current → releases/20260524-160419-9z8y7x6/  (swap)   │
   │    └── shared/                                               │
   │        ├── .env.production  (never committed)                │
   │        └── logs/                                             │
   │                                                              │
   │  PM2 (process manager) ──▶ Node on 127.0.0.1:3000            │
   │  nginx (reverse proxy + SSL)                                 │
   │  Let's Encrypt (auto-renew via certbot.timer)                │
   └──────────────────────────────────────────────────────────────┘
                                                ▲
                                                │
                                       https://cmipaportal.com
```

**Why this design**

| Concern | Solution |
|---|---|
| Zero downtime | Atomic symlink swap of `current/` |
| Rollback safety | Keep last 5 releases; `pm2 reload` to previous on health-check fail |
| No secrets in git | `.env.production` lives in `shared/` on the VPS only |
| Other apps on box | Dedicated SSH user you choose (not root), scoped sudoers; nginx vhost detection refuses to overwrite; UFW additive; default site untouched |
| Port collision | Auto-detects free port if 3000 is busy, persists choice in `shared/runtime.env`, exports as `PORT` to PM2 |
| Fast deploys | Hardlinked `node_modules` reuse when lockfile unchanged |
| Visibility | GitHub Actions logs + `/var/log/cmipaportal/deploy-*.log` |

### Server-adaptation checks performed at bootstrap

Before installing anything, the script runs a `0/9 · Inspect server` step that:

1. **Lists other apps under `/var/www`** — prints their names as a warning so you know what's co-tenant. Their files, processes, and configs are never touched.
2. **Scans nginx `sites-enabled/` for a conflicting vhost** on `cmipaportal.com`. If another vhost already claims the domain, bootstrap **refuses to overwrite** and exits with the offending file path.
3. **Auto-picks a free TCP port** starting at 3000. If 3000 is busy, tries 3001, 3002, … Picks the first free one and persists it to `/var/www/cmipaportal/shared/runtime.env`. The deploy script reads this file and passes `PORT=<picked>` to PM2 + nginx upstream.
4. **Inventories existing PM2 processes** — printed as a warning so you can see what else is running. We only manage our own `cmipaportal` process name.
5. **Inventories existing Let's Encrypt certs** — printed as info. Certbot is scoped by domain so other sites are unaffected.
6. **UFW is additive** — if it's already active with custom rules, we just `ufw allow OpenSSH` + `ufw allow 'Nginx Full'`. If it was inactive, we enable it (SSH already whitelisted, so you won't be locked out).
7. **The default nginx site is left in place** — nginx routes by `server_name`, so leaving `sites-enabled/default` alone is safe and avoids breaking other apps that may rely on it.

---

## One-time setup

### 1. Create the SSH user yourself (as root, on the VPS)

You choose the username and the password — the bootstrap script will never do this for you. Example:

```bash
adduser myappuser          # creates the user
passwd  myappuser          # you choose the password
usermod -aG sudo myappuser # optional, but bootstrap will scope sudo anyway
```

Pick whatever username you want — `myappuser`, `apiops`, `cmportal`, etc. The script makes **no assumption about the name**.

### 2. Run the bootstrap on the VPS (run ONCE, as root)

Pass your chosen username via `APP_USER`:

```bash
# Option A — pipe from GitHub
curl -fsSL https://raw.githubusercontent.com/Nekoutb/apiworkflow/main/scripts/vps-bootstrap.sh \
  | APP_USER=myappuser LE_EMAIL=you@yourdomain.com bash

# Option B — clone + run
git clone https://github.com/Nekoutb/apiworkflow.git /tmp/repo
APP_USER=myappuser LE_EMAIL=you@yourdomain.com bash /tmp/repo/scripts/vps-bootstrap.sh
```

The script will **refuse to run** if `APP_USER` is not set or the user does not exist on the system.

This installs Node 20, PM2, nginx, certbot, UFW, **fail2ban**; verifies your chosen user exists; grants that user limited sudo (nginx reload only); prepares the release folder layout owned by that user; and configures SSH to allow password auth only for that user (root stays key-only).

**The script never sets, changes, or rotates the password** — you manage that with `passwd <user>`. Re-running is fully idempotent.

### 3. Add app runtime secrets to GitHub (NOT the VPS)

The `.env.production` file on the VPS is **rebuilt automatically on every deploy** from GitHub Secrets. You never SSH in to edit it.

GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

**All APP_* secrets are optional.** `vps-bootstrap.sh` auto-provisions sensible defaults for `DATABASE_URL` and `AUTH_SECRET` directly on the VPS. Set GitHub Secrets only if you want to override.

| Secret | Required? | Value |
|---|---|---|
| `APP_DATABASE_URL` | Optional | Postgres URL (Neon, RDS, etc.). Leave **unset** to use the local Postgres provisioned by `vps-bootstrap.sh` |
| `APP_AUTH_SECRET` | Optional | Auth.js session secret. Leave **unset** to use the random 32-byte base64 string generated by `vps-bootstrap.sh` |
| `APP_ANTHROPIC_API_KEY` | Optional | Claude API key — leave unset for graceful stub |
| `APP_BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob token — leave unset for graceful stub |
| `APP_RESEND_API_KEY` | Optional | Resend email key — leave unset for graceful stub |

**About the database:** `vps-bootstrap.sh` installs PostgreSQL 16 locally on the VPS, creates a `cmipaportal` database + user with a random 28-char password, and writes the connection string to `/var/www/cmipaportal/shared/runtime.env`. Nightly `pg_dump` backups go to `/var/backups/cmipaportal/` with 7-day retention.

**About `AUTH_SECRET`:** generated once by bootstrap (`openssl rand -base64 32`), persisted at `/root/.cmipaportal-auth-secret` (mode 600), and never rotated on re-runs — so logged-in user sessions survive bootstrap re-runs.

To override either value with a managed service (e.g. Neon, or rotate AUTH_SECRET), set the corresponding `APP_*` GitHub Secret. The workflow logs which source it used on every deploy:
```
→ DATABASE_URL source: VPS local Postgres
→ AUTH_SECRET source:  VPS local secret
```

To rotate any value, just update the GitHub Secret and trigger a deploy — the file gets overwritten atomically (`chmod 600`) on the server. There is no other source of truth.

### 4. Add DNS records (at your registrar)

| Type | Name | Value |
|------|------|-------|
| A | `@` | `45.32.150.96` |
| A | `www` | `45.32.150.96` |

Wait for propagation: `dig +short cmipaportal.com` should return your VPS IP.

### 5. Re-run certbot (only if bootstrap couldn't issue SSL because DNS wasn't ready)

```bash
certbot --nginx -d cmipaportal.com -d www.cmipaportal.com \
  --non-interactive --agree-tos -m you@yourdomain.com --redirect
```

### 6. Add GitHub Secrets

GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

**SSH transport secrets:**

| Secret | Required? | Value |
|---|---|---|
| `VPS_HOST` | ✅ | `45.32.150.96` |
| `VPS_USER` | ✅ | The Linux username **you** created (e.g. `myappuser`) |
| `VPS_PASSWORD` | ✅ | The password **you** assigned with `passwd <user>` |
| `VPS_PORT` | Optional | SSH port — defaults to `22` if unset |
| `VPS_KNOWN_HOSTS` | Optional | Output of `ssh-keyscan -H 45.32.150.96` (recommended for security) |

Both `VPS_USER` and `VPS_PASSWORD` are values you enter manually — neither is generated by the pipeline.

**Plus** the app runtime secrets from step 3 (`APP_DATABASE_URL`, `APP_AUTH_SECRET`, optional integration keys).

### 7. Create the `production` environment in GitHub (optional)

GitHub → **Settings** → **Environments** → **New environment** → name `production`.
You can add required reviewers here to gate every deploy behind manual approval.

---

## Day-to-day usage

### Auto-deploy

Any push to `main` that touches `app/**` triggers a deploy:

```bash
git add app/...
git commit -m "feat: …"
git push origin main
```

Watch progress at **GitHub → Actions → "Deploy to VPS (cmipaportal.com)"**.

### Manual deploy

**GitHub → Actions → "Deploy to VPS" → Run workflow**

### Inspect a deploy

```bash
# Pipeline log
# → GitHub Actions UI, "Deploy summary" section

# Server-side detailed log
ssh <your-user>@45.32.150.96 'ls -1t /var/log/cmipaportal/ | head -5'
ssh <your-user>@45.32.150.96 'tail -200 /var/log/cmipaportal/deploy-<release-id>.log'

# Live app logs
ssh <your-user>@45.32.150.96 'pm2 logs cmipaportal --lines 100 --nostream'

# What's currently live
ssh <your-user>@45.32.150.96 'readlink /var/www/cmipaportal/current'
```

### Manual rollback

```bash
ssh <your-user>@45.32.150.96
cd /var/www/cmipaportal
ls -1t releases/ | head -5             # pick a prior release
ln -sfn releases/<previous-id> current
pm2 reload cmipaportal --update-env
```

---

## Pipeline behaviour

| Step | What happens | On failure |
|---|---|---|
| **Build** (GH runner) | `npm ci` → `prisma generate` → `typecheck` → `next build` | Pipeline fails before reaching VPS — no impact on production |
| **Upload artifact** | `tar` + `scp` to `/tmp/release-<id>.tar.gz` | Pipeline fails — no impact on production |
| **Extract** | Untarred into `releases/<id>/` | Cleanup of partial release |
| **Sync .env** | Assemble env from `APP_*` secrets on runner → atomic scp to `shared/.env.production` → shred local copy | Hard fail — missing `APP_DATABASE_URL` or `APP_AUTH_SECRET` |
| **Env link** | Symlink `shared/.env.production` into release | Hard fail (only if sync step was skipped) |
| **Dependencies** | `npm ci --omit=dev` OR hardlink reuse from previous release | Rollback to previous release |
| **Prisma db push** | Schema sync to Neon (idempotent, refuses data loss) | Rollback |
| **Symlink swap** | `ln -sfn releases/<id> current` (atomic) | Reverted by trap |
| **PM2 reload** | Zero-downtime reload of the Node process | Rollback + PM2 restart on previous |
| **Health check** | Hits `http://127.0.0.1:3000/_health` for up to 60s | Rollback + dump last 80 PM2 log lines |
| **Smoke test** | GH Actions curls `https://cmipaportal.com` | Warning (does not roll back if internal health passed) |
| **Prune** | Removes old releases beyond the last 5 | Non-fatal |

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `Permission denied (password)` in GH Actions | `VPS_USER` or `VPS_PASSWORD` mismatches the OS account. Verify with `ssh <user>@<host>` from your laptop, then sync the GitHub secret(s) to match (the bootstrap script never changes either value) |
| `sshpass: command not found` | Workflow step "Setup SSH" failed to apt-install sshpass — check runner image |
| Locked out by fail2ban | SSH from a different IP and run `fail2ban-client set sshd unbanip <IP>` |
| Build OK, deploy hangs on "SSH preflight" | UFW blocking SSH from GH runners — `ufw status` and ensure `22/tcp` is allowed |
| Deploy succeeds but site shows 502 | PM2 process crashed at boot. `ssh … 'pm2 logs cmipaportal'` to see why (commonly: bad `DATABASE_URL`) |
| `Missing /var/www/cmipaportal/shared/.env.production` | The "Sync .env.production" workflow step was skipped or failed. Verify `APP_DATABASE_URL` and `APP_AUTH_SECRET` are set in GitHub Secrets |
| Certbot fails: `Detail: Fetching … timeout` | DNS not pointing to this server yet — wait, then re-run certbot |
| Releases folder grows huge | `KEEP_RELEASES` defaults to 5 — adjust at the top of `scripts/vps-deploy.sh` |
| Need to redeploy the same commit | Actions → Run workflow → enable `skip_build_cache` if you suspect a cached build |

---

## Security notes

- **The SSH user you chose has limited sudo** — only `systemctl reload/restart nginx`. It cannot install packages, modify other apps, or touch root-owned files. Scoped via `/etc/sudoers.d/<user>-cmipaportal`.
- **Password auth** is enabled **only for the user you chose** via a `Match User` block in `/etc/ssh/sshd_config.d/10-cmipaportal.conf`. Root SSH stays key-only (`PermitRootLogin prohibit-password`). All other system users are unaffected.
- **fail2ban** bans IPs after 5 failed SSH attempts in 10 minutes for 1 hour. Tune in `/etc/fail2ban/jail.d/sshd.local`.
- **`VPS_USER` and `VPS_PASSWORD`** are values you choose and enter manually — into both the OS (`adduser` / `passwd`) and into GitHub Secrets. The bootstrap script never creates users, never sets passwords, and never rotates anything.
- **`.env.production` lives only on the VPS** in `shared/`, mode `600`, owned by `deploy`. It is never copied through GitHub Actions logs or artifacts.
- **No secrets are baked into the build artifact** — runtime env is loaded from `.env.production` after symlink swap.
- **HTTPS is enforced** by certbot's `--redirect` flag (HTTP 301 → HTTPS).
- **Firewall (UFW)** allows only SSH + HTTP + HTTPS.

**Why password auth (not keys)?** Operator preference. Mitigated by:
1. Password auth scoped to one specific user only (root remains key-only)
2. fail2ban brute-force protection (5 fails / 10min → 1h ban)
3. Secret stored encrypted in GitHub Secrets (masked in logs)
4. You choose a strong password when you run `passwd <user>`

**User & password management policy:** The bootstrap script will **never** create users, generate usernames, set passwords, or rotate passwords. You create the user with `adduser <user>`, set its password with `passwd <user>`, and add both values manually into GitHub Secrets (`VPS_USER`, `VPS_PASSWORD`). If you ever need to change them, you do so manually on the server and update the secrets to match.
