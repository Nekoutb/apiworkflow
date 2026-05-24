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
| Other apps on box | Dedicated `deploy` user (not root), scoped sudoers |
| Fast deploys | Hardlinked `node_modules` reuse when lockfile unchanged |
| Visibility | GitHub Actions logs + `/var/log/cmipaportal/deploy-*.log` |

---

## One-time setup

### 1. On the VPS (run ONCE, as root)

```bash
# Option A — pipe from GitHub
curl -fsSL https://raw.githubusercontent.com/Nekoutb/apiworkflow/main/scripts/vps-bootstrap.sh \
  | LE_EMAIL=you@yourdomain.com bash

# Option B — clone + run
git clone https://github.com/Nekoutb/apiworkflow.git /tmp/repo
LE_EMAIL=you@yourdomain.com bash /tmp/repo/scripts/vps-bootstrap.sh
```

This installs Node 20, PM2, nginx, certbot, UFW; creates the `deploy` user;
prepares the release folder layout; generates an SSH key pair; and prints the
private key + values you need for GitHub Secrets.

**At the end it prints:**

```
VPS_HOST     = 45.32.150.96
VPS_USER     = deploy
VPS_PORT     = 22
VPS_SSH_KEY  = (the private key it generated)
```

### 2. Fill in the real env vars on the VPS

```bash
nano /var/www/cmipaportal/shared/.env.production
```

Replace the placeholders with the real Neon `DATABASE_URL`, `AUTH_SECRET`, and
any optional integration keys (Claude, Resend, Vercel Blob).

**Generate a fresh AUTH_SECRET** if you suspect the existing one was exposed:
```bash
openssl rand -base64 32
```

### 3. Add DNS records (at your registrar)

| Type | Name | Value |
|------|------|-------|
| A | `@` | `45.32.150.96` |
| A | `www` | `45.32.150.96` |

Wait for propagation: `dig +short cmipaportal.com` should return your VPS IP.

### 4. Re-run certbot (only if bootstrap couldn't issue SSL because DNS wasn't ready)

```bash
certbot --nginx -d cmipaportal.com -d www.cmipaportal.com \
  --non-interactive --agree-tos -m you@yourdomain.com --redirect
```

### 5. Add GitHub Secrets

GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Value |
|---|---|
| `VPS_HOST` | `45.32.150.96` |
| `VPS_USER` | `deploy` |
| `VPS_PORT` | `22` |
| `VPS_SSH_KEY` | Private key printed by `vps-bootstrap.sh` (include `-----BEGIN/END-----`) |
| `VPS_KNOWN_HOSTS` *(optional but recommended)* | Output of `ssh-keyscan -H 45.32.150.96` |

### 6. Create the `production` environment in GitHub (optional)

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
ssh deploy@45.32.150.96 'ls -1t /var/log/cmipaportal/ | head -5'
ssh deploy@45.32.150.96 'tail -200 /var/log/cmipaportal/deploy-<release-id>.log'

# Live app logs
ssh deploy@45.32.150.96 'pm2 logs cmipaportal --lines 100 --nostream'

# What's currently live
ssh deploy@45.32.150.96 'readlink /var/www/cmipaportal/current'
```

### Manual rollback

```bash
ssh deploy@45.32.150.96
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
| **Env link** | Symlink `shared/.env.production` into release | Hard fail (env file missing on VPS) |
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
| `Permission denied (publickey)` in GH Actions | `VPS_SSH_KEY` is missing newlines, or the public key wasn't appended to `~deploy/.ssh/authorized_keys` |
| Build OK, deploy hangs on "SSH preflight" | UFW blocking SSH from GH runners — `ufw status` and ensure `22/tcp` is allowed |
| Deploy succeeds but site shows 502 | PM2 process crashed at boot. `ssh … 'pm2 logs cmipaportal'` to see why (commonly: bad `DATABASE_URL`) |
| `Missing /var/www/cmipaportal/shared/.env.production` | You skipped step 2 of one-time setup |
| Certbot fails: `Detail: Fetching … timeout` | DNS not pointing to this server yet — wait, then re-run certbot |
| Releases folder grows huge | `KEEP_RELEASES` defaults to 5 — adjust at the top of `scripts/vps-deploy.sh` |
| Need to redeploy the same commit | Actions → Run workflow → enable `skip_build_cache` if you suspect a cached build |

---

## Security notes

- **The `deploy` user has limited sudo** — only `systemctl reload/restart nginx`. It cannot install packages, modify other apps, or touch root-owned files.
- **The SSH deploy key is ed25519** and only authorises `deploy@cmipaportal` from GitHub Actions. Rotate by re-running `vps-bootstrap.sh` and updating the `VPS_SSH_KEY` secret.
- **`.env.production` lives only on the VPS** in `shared/`, mode `600`, owned by `deploy`. It is never copied through GitHub Actions logs or artifacts.
- **No secrets are baked into the build artifact** — runtime env is loaded from `.env.production` after symlink swap.
- **HTTPS is enforced** by certbot's `--redirect` flag (HTTP 301 → HTTPS).
- **Firewall (UFW)** allows only SSH + HTTP + HTTPS.

If a password or key is ever exposed:
1. `passwd <user>` on the server
2. Regenerate deploy key: `ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""`
3. Update `~/.ssh/authorized_keys`
4. Update `VPS_SSH_KEY` in GitHub Secrets
5. Rotate `AUTH_SECRET` in `/var/www/cmipaportal/shared/.env.production` + reload PM2
