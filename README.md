# API Cameroun — Internal Workflow Demo

Internal accreditation workflow for the **Agence de Promotion des Investissements (API) du Cameroun**, built against [Ordonnance n° 2025/002 du 18 juillet 2025](#).

## What's in this repo

| Path | Purpose |
|---|---|
| `demo/index.html` | Self-contained click-through demo of the internal portal + investor portal (FR/EN, login, 6-stage workflow, document verification, notifications) |
| `demo/logo.svg` | Standalone logo asset (override by dropping a real `logo.png` next to it) |
| `WORKFLOW_DESIGN.md` | Full design document — process maps, role matrix, data model, screen inventory, technical architecture |
| `.github/workflows/deploy.yml` | GitHub Actions workflow that auto-deploys `demo/` to Hostinger on every push to `main` |

## Auto-deploy to Hostinger

The `demo/` folder is automatically pushed to your Hostinger site whenever a commit lands on the `main` branch.

### One-time setup — GitHub Secrets

Go to `Settings → Secrets and variables → Actions → New repository secret` and add:

| Name | What to paste | Where to find it |
|---|---|---|
| `FTP_HOST` | `ftp.yourdomain.com` (or the IP shown) | hPanel → Files → FTP Accounts → *Hostname* |
| `FTP_USER` | FTP username | hPanel → Files → FTP Accounts → *Username* |
| `FTP_PASSWORD` | FTP password | hPanel → Files → FTP Accounts → *Change password* if unknown |
| `FTP_TARGET_DIR` | e.g. `/public_html/demo/` | The folder under your site root where the demo should live |

After the four secrets are set, every push to `main` triggers an upload. You can also trigger manually from `Actions → Deploy demo to Hostinger → Run workflow`.

### Local development

Open `demo/index.html` directly in a browser — works offline, no build step. State persists in `localStorage` per browser.

To reset to seeded data: avatar menu → *Réinitialiser les données*.

## Demo accounts

**API staff (6 roles, one per workflow stage):**
- Marie Etoundi — Réceptionniste (Guichet Unique)
- Paul Nkomo — Instructeur (Service Technique)
- Jeanne Mballa — Représentant fiscal (DGI)
- Samuel Ngono — Représentant douanier (DGD)
- Christine Abena — Chef du Guichet Unique
- Dr. Pierre Eyenga — Directeur Général

**Investors (3 seeded + 1 with no dossier to demo the upload flow):**
- Eric Tchoua / SARL AGRO-CAM
- Florence Kameni / SA CAMINDUSTRIE
- Patrick Mbarga / DATA-CENTER DOUALA SUARL
- Sophie Mengue / STARTUP CAMTECH SARL (no dossier yet)

Any password is accepted in demo mode.

## Legal basis

The workflow is driven by **Ordonnance n° 2025/002 du 18 juillet 2025** fixant les incitations à l'investissement en République du Cameroun. Articles directly mobilised by the demo:

- **Art. 3** — eligible sectors
- **Arts. 6–8** — eligibility criteria (common + new + extension projects)
- **Arts. 10–12** — fiscal & customs incentives by category (A/B/C) and ZDP uplift
- **Art. 29** — création du Guichet Unique
- **Art. 30** — convention procedure & 10-business-day instruction SLA
- **Art. 30.5** — mandatory tax + customs Avis
- **Art. 31** — 12 mandatory clauses of the convention
- **Art. 33** — equipment-list validation
- **Art. 39** — Comité d'audit et de recours

See [`WORKFLOW_DESIGN.md`](WORKFLOW_DESIGN.md) for the full mapping.
