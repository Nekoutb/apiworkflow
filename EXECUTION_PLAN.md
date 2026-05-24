# API Cameroun — Execution Plan
## Sequential activities · approve each gate before progressing

> **Working rule:** I do one **Activity** at a time. At the end of every activity is a **TEST GATE** — you verify, then say **"approve Aₙ"**. Nothing moves to the next activity until you approve.
>
> If a sub-task fails its own quick check, I fix it inside the same activity before reaching the gate.
>
> **Build-mode credentials:** every account = `admin` / `admin`. Real auth + onboarding is the very last activity.
>
> **Source-of-truth design:** the v3 mockups at https://nekoutb.github.io/apiworkflow/mockups/ — production implementation must look pixel-faithful to those 10 screens.

---

## Status legend

| Mark | Meaning |
|---|---|
| ⬜ | Not started |
| 🟡 | In progress |
| ✅ | Done & approved |
| ⛔ | Blocked (waiting on you) |

---

## Stack (locked, reaffirmed)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 + TypeScript | App Router, Server Actions |
| UI | Tailwind 4 + design tokens from v3 | Inter + Source Serif 4 |
| Database | PostgreSQL via Neon (free tier) | Serverless |
| ORM | Prisma | |
| Auth | Auth.js v5 Credentials | `admin`/`admin` during build |
| File storage | Vercel Blob | 1 GB free tier |
| AI | Anthropic Claude Sonnet | OCR + compliance + financial extraction |
| Email | Resend | 3 000/month free |
| Hosting | Vercel free tier | Auto-deploy from GitHub `main` |

---

## A0 — Foundations & first deploy ⬜
**Goal:** a live `https://*.vercel.app` URL with the v3 design language wired in.

| # | Sub-task | Status |
|---|---|---|
| A0.1 | New clean `app/` codebase (Next.js 15 + TS + Tailwind 4) | ⬜ |
| A0.2 | Tailwind config with v3 tokens (palette, fonts, type scale) | ⬜ |
| A0.3 | Source Serif 4 + Inter loaded via next/font | ⬜ |
| A0.4 | Prisma schema initialized, Neon Postgres connection string in env | ⬜ |
| A0.5 | Neon free-tier database created (I drive the signup via Chrome — you click "allow") | ⬜ |
| A0.6 | Vercel project created + linked to `Nekoutb/apiworkflow` (you grant 1-click GitHub OAuth on vercel.com) | ⬜ |
| A0.7 | Env vars set in Vercel: `DATABASE_URL`, `AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` | ⬜ |
| A0.8 | First deploy succeeds; landing page (mockup Screen I, marketing only, no login wired yet) is live | ⬜ |

**TEST GATE A0:** open the live URL on your phone + laptop, see the editorial hero — pure visual. Reply **"approve A0"**.

---

## A1 — Auth shell (admin/admin) ⬜
**Goal:** sign in with `admin`/`admin` and reach a protected page.

| # | Sub-task | Status |
|---|---|---|
| A1.1 | Install Auth.js v5 + bcryptjs + Credentials provider | ⬜ |
| A1.2 | `User` model in Prisma (id, email, passwordHash, name, userType, role, status) | ⬜ |
| A1.3 | Seed script creates 1 admin user `admin` / `admin` | ⬜ |
| A1.4 | `/login` route built per mockup Screen I (sign-in card) | ⬜ |
| A1.5 | Login form posts to Server Action → Auth.js | ⬜ |
| A1.6 | Middleware redirects unauthenticated requests to `/login` | ⬜ |
| A1.7 | Logout Server Action + button in header | ⬜ |
| A1.8 | Successful login lands on `/dashboard` (placeholder page) | ⬜ |

**TEST GATE A1:** open URL → redirected to `/login` → enter `admin`/`admin` → land on placeholder dashboard → logout → back to `/login`. Reply **"approve A1"**.

---

## A2 — Admin: user management ⬜
**Goal:** the admin can create staff with name + email + role, and each new staff lands on `admin`/`admin` until A22.

| # | Sub-task | Status |
|---|---|---|
| A2.1 | Role enum: `SECRETARY`, `DIR_INVESTMENTS`, `DIR_COMPLIANCE`, `DIR_EXTERNAL`, `DG`, `ADMIN` | ⬜ |
| A2.2 | `/admin/users` page built per mockup Screen VIII (table + create form) | ⬜ |
| A2.3 | Server Action `createStaffAction` (validates email, creates user with `admin` password hash, status active) | ⬜ |
| A2.4 | Welcome email via Resend ("compte créé · vos identifiants : admin / admin") | ⬜ |
| A2.5 | Edit user (change role, deactivate) | ⬜ |
| A2.6 | Seed 5 staff (one per role) so we can test workflow later | ⬜ |

**TEST GATE A2:** as admin, open `/admin/users`, create a new Secretary, the email arrives in their inbox; log out, log in as that Secretary with `admin`/`admin`. Reply **"approve A2"**.

---

## A3 — Data model (complete schema) ⬜
**Goal:** Prisma schema covering every domain object the next 18 activities need.

| # | Sub-task | Status |
|---|---|---|
| A3.1 | `Investor` model (id, userId fk, raisonSociale, niu, legalForm, country, isExisting) | ⬜ |
| A3.2 | `Convention` model (id, reference, investorId, sector, type, regime, status, currentStage, dates, amounts) | ⬜ |
| A3.3 | `Document` model (id, conventionId, kind enum, fileName, storageUri, sha256, uploadedAt, verification enum, verifiedBy, verifiedAt, rejectionReason) | ⬜ |
| A3.4 | `WorkflowEvent` model (id, conventionId, stage, action enum [received/signedoff/handedoff/rejected/returned], actorUserId, comment, ts) | ⬜ |
| A3.5 | `Comment` model (id, documentId/conventionId, authorUserId, body, ts) | ⬜ |
| A3.6 | `Notification` model (id, forUserId, conventionId, type, title, body, read, emailedAt, createdAt) | ⬜ |
| A3.7 | `AiAnalysis` model (id, documentId/conventionId, kind, content json, generatedAt) — caches Claude outputs | ⬜ |
| A3.8 | `FinancialSummary` model (id, conventionId, json blob — extracted financials) | ⬜ |
| A3.9 | `prisma db push` to Neon, regenerate client | ⬜ |
| A3.10 | Seed 3 sample conventions in mixed states for visual checks | ⬜ |

**TEST GATE A3:** open Prisma Studio (you click the URL I share), see the schema and the 3 seeded conventions. Reply **"approve A3"**.

---

## A4 — Investor portal: landing, sign-up, sign-in, new vs existing ⬜

| # | Sub-task | Status |
|---|---|---|
| A4.1 | Public landing (Screen I) live at `/` — no login required | ⬜ |
| A4.2 | Sign-up flow at `/signup` (raisonSociale, email, password set to `admin`) | ⬜ |
| A4.3 | Investor record created on sign-up, `isExisting = false` | ⬜ |
| A4.4 | Sign-in for investors via the same `/login` page (tabs) | ⬜ |
| A4.5 | After login: route to `/investor/new` if `isExisting=false` and no convention, else `/investor` | ⬜ |
| A4.6 | Existing investors flagged when created via the Import flow (A20) | ⬜ |

**TEST GATE A4:** sign up as a new investor → land on the upload page; manually flip `isExisting=true` in Prisma Studio → log in → land on the existing-investor dashboard. Reply **"approve A4"**.

---

## A5 — Investor: new dossier + document upload ⬜
**Goal:** investor uploads the 6 mandatory pieces and submits.

| # | Sub-task | Status |
|---|---|---|
| A5.1 | `/investor/new` page built per mockup Screen II | ⬜ |
| A5.2 | The 6 required document slots rendered (Art. 6) | ⬜ |
| A5.3 | Drag-and-drop + click-to-upload for each slot | ⬜ |
| A5.4 | Upload Server Action stores to Vercel Blob, writes `Document` row with `verification = PENDING` | ⬜ |
| A5.5 | Replace / re-upload for any slot | ⬜ |
| A5.6 | Submit dossier button — disabled until all 6 uploaded — creates `Convention` with `currentStage = SECRETARY`, status `SUBMITTED` | ⬜ |
| A5.7 | Email confirmation to investor on submit | ⬜ |

**TEST GATE A5:** new investor uploads 6 PDFs, submits, gets the confirmation email, sees the dossier in `/investor`. Reply **"approve A5"**.

---

## A6 — Investor: progress tracker ⬜

| # | Sub-task | Status |
|---|---|---|
| A6.1 | `/investor` dashboard lists all dossiers of this investor | ⬜ |
| A6.2 | Click dossier → `/investor/dossier/[id]` (mockup Screen IV) | ⬜ |
| A6.3 | 5-stage visual stepper with current stage highlighted | ⬜ |
| A6.4 | Editorial timeline of `WorkflowEvent` rows | ⬜ |
| A6.5 | SLA chip (per workflow event) | ⬜ |
| A6.6 | Email investor whenever stage advances (template skeleton; full templates in A17) | ⬜ |

**TEST GATE A6:** submit a dossier, see stage 1 (Secretariat) highlighted, no events beyond. Reply **"approve A6"**.

---

## A7 — Investor: existing-investor experience ⬜

| # | Sub-task | Status |
|---|---|---|
| A7.1 | `/investor` for existing investors shows the convention card (Screen III) | ⬜ |
| A7.2 | Download the signed convention PDF (uploaded at import or DG signature) | ⬜ |
| A7.3 | "Rapport annuel — Art. 32" form skeleton (year picker + submit) | ⬜ |
| A7.4 | Last-year performance KPIs displayed (from `Convention` data) | ⬜ |

**TEST GATE A7:** log in as an investor whose convention was imported (created via A20 later — for now we test via Prisma Studio manual flag); see the certificate-style card + KPIs. Reply **"approve A7"**.

---

## A8 — Staff portal: login + role-aware landing ⬜

| # | Sub-task | Status |
|---|---|---|
| A8.1 | Staff `/login` uses the same form, Personnel tab | ⬜ |
| A8.2 | After login: route to `/staff/inbox` (their corbeille) | ⬜ |
| A8.3 | Top header with gov-bar + user avatar + lang toggle | ⬜ |
| A8.4 | Left sidebar with "Ma corbeille" + "Récemment traités" + sections | ⬜ |

**TEST GATE A8:** log in as each of the 5 staff roles, land on each empty corbeille with correct role label in the header. Reply **"approve A8"**.

---

## A9 — Workflow Stage 1: Secretary view + manual verification ⬜

| # | Sub-task | Status |
|---|---|---|
| A9.1 | Secretary inbox lists conventions where `currentStage = SECRETARY` | ⬜ |
| A9.2 | Click → `/staff/dossier/[id]` with the 3-column shell (Screen V) | ⬜ |
| A9.3 | Center pane: dossier summary + document tiles | ⬜ |
| A9.4 | Action rail: Signoff / Handoff / Reject / Return / Comment buttons | ⬜ |
| A9.5 | Accept-a-document action (writes `Document.verification = ACCEPTED`) | ⬜ |
| A9.6 | Reject-a-document action with mandatory reason; investor gets notification + email | ⬜ |
| A9.7 | Signoff button (records `WorkflowEvent action=SIGNED_OFF`) | ⬜ |
| A9.8 | Handoff button (advances `currentStage = DIR_INVESTMENTS`, records event) | ⬜ |
| A9.9 | Per-stage time tracking: received timestamp, signed-off timestamp, handed-off timestamp, time-at-station | ⬜ |

**TEST GATE A9:** as Secretary, open a submitted dossier, reject one doc (investor notified), accept the rest, sign off, hand off → dossier disappears from Secretary inbox, appears in Director-Investments inbox. Reply **"approve A9"**.

---

## A10 — AI OCR + insights pane (Secretary) ⬜

| # | Sub-task | Status |
|---|---|---|
| A10.1 | Anthropic SDK installed, `ANTHROPIC_API_KEY` wired | ⬜ |
| A10.2 | Server-side function `analyseDocumentForCompleteness(documentId)` calling Claude Sonnet with the PDF | ⬜ |
| A10.3 | Returns structured JSON: `{completeness, ocr_excerpt, coherence_check, point_of_attention, recommendation}` | ⬜ |
| A10.4 | Cached in `AiAnalysis` table | ⬜ |
| A10.5 | Right pane on Screen V renders the 5 sections (Complétude · OCR · Cohérence · Attention · Recommandation) | ⬜ |
| A10.6 | "Re-analyser" button to force fresh analysis | ⬜ |

**TEST GATE A10:** open a dossier as Secretary, see real Claude-generated insights in the right pane; cost shown in your Anthropic console. Reply **"approve A10"**.

---

## A11 — Workflow Stage 2: Director of Investments + AI compliance pane ⬜

| # | Sub-task | Status |
|---|---|---|
| A11.1 | DirInv inbox lists `currentStage = DIR_INVESTMENTS` | ⬜ |
| A11.2 | Dossier page = same Screen VI layout | ⬜ |
| A11.3 | AI pane: `analyseComplianceWithCode(conventionId, focus='investments')` — Présentation · Fond · Forme · Attention · Verdict (score) | ⬜ |
| A11.4 | Action rail: Signoff / Handoff to Compliance / Reject / Return / Comment | ⬜ |
| A11.5 | Handoff advances `currentStage = DIR_COMPLIANCE` | ⬜ |

**TEST GATE A11:** as DirInv, open dossier, see AI compliance analysis vs Investment Code, sign + hand off. Reply **"approve A11"**.

---

## A12 — Workflow Stage 3: Director of Compliance ⬜

| # | Sub-task | Status |
|---|---|---|
| A12.1 | DirComp inbox | ⬜ |
| A12.2 | Same shell with focus='compliance' AI prompt | ⬜ |
| A12.3 | Handoff to DirExternal | ⬜ |

**TEST GATE A12:** flow continues. Reply **"approve A12"**.

---

## A13 — Workflow Stage 4: Director of External Regulations ⬜

| # | Sub-task | Status |
|---|---|---|
| A13.1 | DirExt inbox | ⬜ |
| A13.2 | Same shell with focus='external-regulations' AI prompt | ⬜ |
| A13.3 | Handoff to DG | ⬜ |

**TEST GATE A13:** flow continues. Reply **"approve A13"**.

---

## A14 — Workflow Stage 5: DG final signature + close ⬜

| # | Sub-task | Status |
|---|---|---|
| A14.1 | DG inbox | ⬜ |
| A14.2 | Dossier page shows synthèse of 4 prior signoffs (Screen VII) | ⬜ |
| A14.3 | AI consolidated verdict in right pane | ⬜ |
| A14.4 | "Signer & clore le dossier" button → status `CLOSED`, currentStage `CLOSED` | ⬜ |
| A14.5 | Generated convention PDF stored in Blob | ⬜ |
| A14.6 | Investor flagged `isExisting = true`; sees convention in their portal | ⬜ |
| A14.7 | Email convention to investor with PDF link | ⬜ |

**TEST GATE A14:** complete a full lifecycle from submission to DG signature, investor downloads the signed convention. Reply **"approve A14"**.

---

## A15 — Document viewer + comment thread ⬜

| # | Sub-task | Status |
|---|---|---|
| A15.1 | PDF.js (or `react-pdf-viewer`) embedded in the dossier page | ⬜ |
| A15.2 | Click any document tile → opens inline in the viewer | ⬜ |
| A15.3 | Comment thread anchored to the document (model `Comment` on Document) | ⬜ |
| A15.4 | Add comment Server Action; persisted with author + timestamp | ⬜ |
| A15.5 | Comments visible to staff across all stages | ⬜ |

**TEST GATE A15:** open a doc at any stage, add comments, see them persist when other staff opens the same doc. Reply **"approve A15"**.

---

## A16 — Time tracking visible to all directors ⬜

| # | Sub-task | Status |
|---|---|---|
| A16.1 | Dossier header always shows: received here · time at station · SLA pill | ⬜ |
| A16.2 | "Voir parcours complet" panel shows received/signed/handed timestamps for every stage | ⬜ |
| A16.3 | Any director can open any dossier (read-only outside their stage) | ⬜ |

**TEST GATE A16:** as DirComp, open a dossier that's still at DirInv → can read but not act. Reply **"approve A16"**.

---

## A17 — Email notifications + 72h reminders ⬜

| # | Sub-task | Status |
|---|---|---|
| A17.1 | React-Email templates: doc rejected · stage advanced · signed-off · 72h reminder · convention closed | ⬜ |
| A17.2 | Resend client wired | ⬜ |
| A17.3 | Vercel Cron job hourly: scans for `WorkflowEvent received` > 72h with no `signedoff` or `handedoff`; sends reminder to the current officer + CC all directors + DG | ⬜ |
| A17.4 | Threshold configurable for testing (set to 5 minutes to verify) | ⬜ |

**TEST GATE A17:** drop a dossier at Compliance, wait 5 minutes (test threshold), receive the email. Reply **"approve A17"**.

---

## A18 — Financial summary section ⬜

| # | Sub-task | Status |
|---|---|---|
| A18.1 | When dossier reaches DG, call `extractFinancialSummary(conventionId)` (Claude reads feasibility study + financial docs) | ⬜ |
| A18.2 | Returns `{totalInvestment, equity, debt, jobsPlanned, jobsCostPerETP, TRI, NPV, paybackYears, exports, royaltyAnnual}` | ⬜ |
| A18.3 | Stored in `FinancialSummary` | ⬜ |
| A18.4 | Displayed in the DG view (Screen VII fin-grid section) | ⬜ |

**TEST GATE A18:** when a dossier hits DG, open it, see financial tiles populated by AI extraction. Reply **"approve A18"**.

---

## A19 — GM Dashboard ⬜

| # | Sub-task | Status |
|---|---|---|
| A19.1 | `/staff/dashboard` route (DG-only, also visible to admin) | ⬜ |
| A19.2 | 4 hero KPIs (conventions count, total investment, jobs created, in-process) — from real DB | ⬜ |
| A19.3 | Workflow funnel from current-stage counts | ⬜ |
| A19.4 | Sector breakdown bar chart (Art. 3 enum aggregation) | ⬜ |
| A19.5 | Phase donut (installation / exploitation / closed / suspended) | ⬜ |
| A19.6 | Economic-impact row: jobs realised/planned, people cost, fiscal incentives + ROI estimate | ⬜ |
| A19.7 | Compliance grid (annual reports submitted/late/missing, fines, royalties due vs collected, sanctions, recourses) | ⬜ |
| A19.8 | SLA performance meter (% on-time, average days, longest stuck dossier) | ⬜ |
| A19.9 | Art. 7/8 criteria fulfillment bars | ⬜ |
| A19.10 | Conventions register table — sortable, filterable, click-through to dossier | ⬜ |
| A19.11 | Action items list with urgency | ⬜ |

**TEST GATE A19:** open `/staff/dashboard` as DG, every panel reflects the conventions you've created/imported. Reply **"approve A19"**.

---

## A20 — Create / Import existing convention ⬜

| # | Sub-task | Status |
|---|---|---|
| A20.1 | `/staff/conventions/new` route built per mockup Screen X | ⬜ |
| A20.2 | Section 1 — Investor (raison sociale, NIU, RCCM, contact email, etc.) | ⬜ |
| A20.3 | Section 2 — Convention (n° agrément, date signature, régime, type, secteur, ZDP, objet) | ⬜ |
| A20.4 | Section 3 — Financial data (montant, apport propre, financement, emplois prévus, coût/ETP, exports, intrants nationaux, incitations) | ⬜ |
| A20.5 | Section 4 — Current state (phase, fin prévue, emplois créés, investissement réalisé, dernier rapport, conformité) | ⬜ |
| A20.6 | Section 5 — Document upload (signed convention PDF + acte d'agrément + past annual reports) | ⬜ |
| A20.7 | Submit Server Action: creates `User` (investor) with email + `admin` password, creates `Investor`, creates `Convention` flagged `imported=true` `currentStage=CLOSED` `isExisting=true` | ⬜ |
| A20.8 | Welcome email to investor with portal URL + credentials | ⬜ |
| A20.9 | Imported convention appears in GM Dashboard register + dashboard KPIs update | ⬜ |

**TEST GATE A20:** as admin (or DG), import a fictitious convention; investor receives email; convention appears in dashboard. Reply **"approve A20"**.

---

## A21 — Polish + bilingual + QA ⬜

| # | Sub-task | Status |
|---|---|---|
| A21.1 | FR/EN string dictionary covering all visible UI | ⬜ |
| A21.2 | Language toggle in header persists per session | ⬜ |
| A21.3 | Empty states + error states for every list/form | ⬜ |
| A21.4 | Mobile responsive review (forms + viewer) | ⬜ |
| A21.5 | Performance: Lighthouse ≥ 90 on key pages | ⬜ |
| A21.6 | Cross-browser check (Chrome, Firefox, Safari, Edge) | ⬜ |
| A21.7 | Audit trail entries verified (every action logged) | ⬜ |

**TEST GATE A21:** complete walkthrough of the full site, you sign off on UX. Reply **"approve A21"**.

---

## A22 — Onboarding (final activity) ⬜

| # | Sub-task | Status |
|---|---|---|
| A22.1 | Switch from `admin`/`admin` to real auth: password set at first login from welcome email | ⬜ |
| A22.2 | Password reset flow (email-based) | ⬜ |
| A22.3 | Custom domain wired (cmapi.com or chosen domain) | ⬜ |
| A22.4 | Create real staff accounts (DG, 3 directors, secretary, admin) | ⬜ |
| A22.5 | Quick-start guide per role (1-pager PDF) | ⬜ |
| A22.6 | DG training session (30 min walkthrough) | ⬜ |
| A22.7 | Internal launch communication | ⬜ |

**TEST GATE A22:** the system is live, real users have accounts, the GM has been trained. Reply **"approve A22 — production live"**.

---

## Working ledger (I keep this current)

| Activity | Status | Approved by user on |
|---|---|---|
| A0 — Foundations & first deploy | ⬜ | — |
| A1 — Auth shell (admin/admin) | ⬜ | — |
| A2 — Admin user management | ⬜ | — |
| A3 — Data model | ⬜ | — |
| A4 — Investor portal: landing, sign-up, new vs existing | ⬜ | — |
| A5 — Investor: new dossier + document upload | ⬜ | — |
| A6 — Investor: progress tracker | ⬜ | — |
| A7 — Investor: existing-investor experience | ⬜ | — |
| A8 — Staff portal: login + role-aware landing | ⬜ | — |
| A9 — Workflow Stage 1: Secretary | ⬜ | — |
| A10 — AI OCR + insights pane (Secretary) | ⬜ | — |
| A11 — Workflow Stage 2: Dir Investments + AI compliance | ⬜ | — |
| A12 — Workflow Stage 3: Dir Compliance | ⬜ | — |
| A13 — Workflow Stage 4: Dir External Regulations | ⬜ | — |
| A14 — Workflow Stage 5: DG signature + close | ⬜ | — |
| A15 — Document viewer + comment thread | ⬜ | — |
| A16 — Time tracking visible to all directors | ⬜ | — |
| A17 — Email notifications + 72h reminders | ⬜ | — |
| A18 — Financial summary section | ⬜ | — |
| A19 — GM Dashboard | ⬜ | — |
| A20 — Create / Import existing convention | ⬜ | — |
| A21 — Polish + bilingual + QA | ⬜ | — |
| A22 — Onboarding & real launch | ⬜ | — |

**22 activities · approx 140 leaf sub-tasks · sequential, with a gate after each.**

---

## Estimated effort & cost

| | Effort (dev-days) | Calendar (one builder) | Calendar (two builders in parallel where possible) |
|---|---|---|---|
| A0 – A4 (foundations + investor base) | 9 | ~2 weeks | ~1 week |
| A5 – A8 (upload + staff shells) | 6 | ~1.5 weeks | ~3 days |
| A9 – A14 (full 5-stage workflow + AI) | 15 | ~3 weeks | ~1.5 weeks |
| A15 – A18 (viewer, comments, time, email, financial AI) | 8 | ~1.5 weeks | ~4 days |
| A19 – A20 (dashboard + import) | 6 | ~1 week | ~3 days |
| A21 – A22 (polish + onboarding) | 6 | ~1 week | ~3 days |
| **Total** | **50** | **~10 weeks** | **~5 weeks** |

**Cost (monthly while building + early ops):**

| Item | Monthly |
|---|---|
| Vercel (Hobby tier) | $0 |
| Neon Postgres (Free) | $0 |
| Vercel Blob (Free 1 GB) | $0 |
| Resend (Free 3 000/mo) | $0 |
| Anthropic Claude Sonnet | ~$15–40 (low volume, will scale with usage) |
| Domain (when ready) | ~$15/yr |

**Reply "approve A0" to start, or tell me what to change in this plan first.**
