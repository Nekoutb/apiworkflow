# API Cameroun — Production Application

Next.js 15 + TypeScript + PostgreSQL (Prisma) + Auth.js v5 + Tailwind.

This is the production codebase referenced in [`../PROJECT_PLAN.md`](../PROJECT_PLAN.md). The HTML click-through in [`../demo/`](../demo/) is the stakeholder-facing reference for design language and workflow behaviour.

## Phase 0 status

What's in this scaffold:

- ✓ Next.js 15 App Router + TypeScript + Tailwind set up
- ✓ Cameroon-flag-derived design system (`tailwind.config.ts`, `globals.css`)
- ✓ Full Prisma schema covering: users (investor + 10 staff roles), dossiers (with full lifecycle states), documents (with verification), opinions (Avis), equipment lists, annual reports, audit cases, sanctions, recourses, history, notifications, audit trail (SHA-256-chained), reference data
- ✓ Auth.js v5 (Credentials provider, JWT sessions, Prisma adapter; OIDC/OAuth/2FA wiring stubs)
- ✓ Public landing page, login page, investor dashboard stub, staff dashboard stub
- ✓ i18n shell (FR/EN dictionary, default FR)
- ✓ Security headers baseline (HSTS, X-Frame-Options, etc.)

What's *not* yet implemented (Phase 1 onwards):

- Real signup flow
- TOTP 2FA challenge
- New-request wizard
- Document upload to S3
- 6-stage state machine + SLA engine
- Avis flow with mandatory tax + customs gate (Art. 30.5)
- DG signature + acte d'agrément PDF generation
- Notifications service (email + in-app)
- Audit trail writes

## Local development

### Prerequisites

- Node.js 22 LTS or higher
- PostgreSQL 16 (local or remote)
- A `.env` file (copy from `.env.example` and fill values)

### Setup

```powershell
# from this directory
npm install

# spin up PostgreSQL locally (Docker is easiest)
docker run -d --name apicm-pg `
  -e POSTGRES_PASSWORD=dev `
  -e POSTGRES_DB=apicameroun `
  -p 5432:5432 postgres:16

# copy env and edit
copy .env.example .env

# push the schema to the local DB
npm run db:push

# start the dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check |
| `npm run db:push` | Sync schema to DB (dev / no migrations) |
| `npm run db:migrate` | Create + apply a migration |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |

## Deployment target

Hosting: **AWS eu-west-3 (Paris)** per [`../PROJECT_PLAN.md`](../PROJECT_PLAN.md) §🔒.

Suggested production stack:
- App: AWS App Runner or ECS Fargate (Docker)
- DB: RDS for PostgreSQL 16 (Multi-AZ in Phase 3)
- Storage: S3
- Mail: SES
- Secrets: AWS Secrets Manager
- CDN: CloudFront in front of the Next.js app

The GitHub Actions workflow for production deploy will be added in Phase 0 — week 2.

## Folder layout

```
app/
├── prisma/
│   └── schema.prisma         # Full data model
├── public/
│   └── favicon.svg
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/auth/[...nextauth]/route.ts
│   │   ├── investor/page.tsx
│   │   ├── staff/page.tsx
│   │   ├── login/page.tsx
│   │   ├── layout.tsx        # Root layout (HTML + CSS reset)
│   │   ├── page.tsx          # Marketing landing
│   │   └── globals.css       # Tailwind + design tokens
│   ├── components/
│   │   └── brand/Logo.tsx
│   └── lib/
│       ├── auth.ts           # Auth.js v5 config
│       ├── cn.ts             # className utility
│       ├── db.ts             # Prisma client singleton
│       └── i18n.ts           # Bilingual dictionary
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.ts
├── .env.example
└── .gitignore
```

## License

Internal — Présidence de la République du Cameroun. Not for public distribution.
