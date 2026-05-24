# API Cameroun — Execution Plan **v2**
## Document-centric workflow aligned with the official Organigramme (02 juillet 2020)

> **STATUS:** Project re-baselined on **2026-05-24** after the user provided the official API
> Organigramme (Résolution du Conseil d'Administration, 5ᵉ session extraordinaire, 02 juillet 2020 —
> 48 articles) and a new workflow narrative built around the **Service du Courrier (Art. 15-18)** as
> the entry point and the **Directeur Général (Art. 1)** as the central dispatcher.
>
> The previous plan (`EXECUTION_PLAN.md`, activities A0-A22) is archived as the v1 reference.
> Activities A0 to A10 have been completed and partially survive — see §3 below.
>
> **Companion documents** (open in browser):
> - `Organigramme_API.html` — tree diagram + per-article roles & responsibilities
> - `Workflow_API.html` — 5-phase document workflow with rules

---

## Working rules (unchanged from v1)

- **Sequential execution.** One activity at a time. Each ends with a **TEST GATE**. Nothing moves
  forward until the user replies **"approve Bₙ"**.
- **Build-mode credentials.** Every account = `admin` / `admin`. Real password setup is the very
  last activity.
- **Pixel-faithful design.** Inter + Source Serif 4, Cameroon green (`#006b3a`) + gold (`#c1973f`),
  editorial / government-grade tone, no dark glassy gradients.

## Status legend

| Mark | Meaning |
|---|---|
| ⬜ | Not started |
| 🟡 | In progress |
| ✅ | Done & approved |
| ♻ | Done in v1, partially reusable in v2 |
| 🛑 | Done in v1, **deprecated** in v2 |

---

## Stack (locked — no change from v1)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 + TypeScript | App Router, Server Actions |
| UI | Tailwind v3 + design tokens | Inter + Source Serif 4 |
| Database | PostgreSQL via Neon (Frankfurt) | Serverless |
| ORM | Prisma 5.22 | |
| Auth | Auth.js v5 (Credentials) | `admin`/`admin` during build |
| File storage | Vercel Blob | 5 GB free tier |
| AI | Anthropic Claude Sonnet 4.5 | OCR · résumé · suggestion d'assignation |
| Email | Resend | 3 000/month free tier |
| Hosting | Vercel free tier | Auto-deploy from GitHub `main` |

---

# 0. Décisions cadrantes (validées 2026-05-24)

| # | Question | Décision | Implication plan |
|---|---|---|---|
| R1 | Avis du Ministre des Finances (Art. 30) — dans le scope ? | **OUI · dans le scope** | Nouvelle activité **B14.5** — Transmission externe pour avis (avec attente, réception via Courrier Arrivée, ré-injection dans le workflow) |
| R2 | Déploiement v1 existant — remplacer ou parallèle ? | **REMPLACER** | `apiworkflow-alpha.vercel.app` sera ré-écrasé. Le tag `v1-final` (B3) permet le rollback si nécessaire |
| R3 | Antennes — combien ? | **4 antennes au lancement · ajoutables ensuite** | B23 seed 4 antennes (paramétrables ; régions à confirmer par le client) |
| R4 | Vérification email sur /submit ? | **Ignorer pour le moment** | B4 reste totalement ouvert (sans vérification email). Anti-spam = honeypot + rate limit uniquement |
| R5 | Coût IA (~$0.01-0.03 / doc) ? | **OK** | Pas de quota artificiel. Tokens trackés et surfaceés (B8.6) |
| R6 | Durée légale d'archivage ? | **Ignorer pour le moment** | Bureau des Archives stockage indéfini en MVP |
| R7 | Bilingue FR + EN — au lancement ou post-MVP ? | **AU LANCEMENT** | i18n infrastructure ajoutée en **B3** dès la fondation. Chaque activité produit FR + EN. B26 devient revue finale bilingue |
| R8 | Formulaires obligations post-signature (v1 A7) — porter ou abandonner ? | **Ignorer pour le moment** | Hors scope MVP. Pourrait revenir comme sous-module Service des Agréments après lancement |

---

# 1. What changed

## 1.1 — Old paradigm (v1)
- **Investor-centric.** The only documents handled were investment-incentive dossiers from
  investors, governed by Ordonnance 2025/002.
- **5-stage linear workflow.** SECRETARY → DIR_INVESTMENTS → DIR_COMPLIANCE → DIR_EXTERNAL → DG.
- **Online-only entry.** Investors uploaded 6 mandatory documents via the portal.
- **Récépissé semantics tied to the 10-day SLA** of the Investment Code.

## 1.2 — New paradigm (v2)
- **Document-centric.** Every document that arrives at the API — whatever its nature, whoever
  the émetteur — goes through the same uniform circuit.
- **Service du Courrier (Art. 15-18) is the single entry point.** Online and physical documents
  both pass through it; physical documents are scanned and attached.
- **The DG (Art. 1) is the central dispatcher,** assisted by Claude AI which OCRs the document,
  summarises it and suggests the right unit in the organigramme.
- **The full 33-unit organigramme tree** is the addressing space. Documents can be routed to any
  Direction, Sous-direction, Service, Bureau or Cellule.
- **Vertical + horizontal handoffs** authorised at any level. Hierarchy is enforced for visibility
  (top-down only).
- **Accusé de réception systématique** for every document, regardless of émetteur or voie.
- **Response goes back through the Courrier (Bureau Départ).** Closure or maintain-open is the
  DG's decision.

---

# 2. Recap — activities completed in v1 (A0-A10)

13 activities were shipped and approved before the re-baseline. They are summarised here with
their v2 verdict.

| # | Activity | v1 Status | v2 Verdict | Notes |
|---|---|---|---|---|
| A0 | Foundations & first deploy | ✅ | ♻ **KEEP** | Stack, design tokens, landing page — all reused as-is |
| A1 | Auth shell (admin/admin) | ✅ | ♻ **KEEP** | Auth.js v5, JWT, edge-safe middleware — unchanged |
| A2 | Admin user management (`/admin/users`) | ✅ | ♻ **KEEP page, REWORK enum** | Page layout reused, `StaffRole` enum expanded to ~37 values (B1) |
| A3 | Data model (convention-centric) | ✅ | ♻ **PARTIAL KEEP** | Reuse: User, Document, Comment, AiAnalysis, Notification, AuditTrail. Replace: Convention + 5-stage models (B2) |
| A4 | Investor portal: landing, sign-up, sign-in | ✅ | ♻ **PARTIAL KEEP** | Landing kept · sign-up generalised to any émetteur · investor tab kept in /login |
| A4-polish | Card visuals + post-signature obligations | ✅ | 🛑 **DEPRECATED in main workflow** | Reusable visual patterns. Post-signature obligations (Art. 32-48) become a separate module under Service des Agréments (Art. 33) |
| A5 | Investor: new dossier + 6-piece upload | ✅ | ♻ **PARTIAL KEEP** | Upload mechanism + Blob integration reused. "6 mandatory pieces" constraint removed — replaced by free-form document submission (B4) |
| A5-fix | Récépissé starts the 10-day clock | ✅ | 🛑 **DEPRECATED** | Receipt is now systematic and uniform for all documents; no specific 10-day SLA in the main workflow |
| A6 | Investor progress tracker | ✅ | 🛑 **DEPRECATED** | 5-stage stepper replaced by document-tracking page following organigramme assignments (B12, B23) |
| A7 | Existing-investor experience (5 obligation forms) | ✅ | 🛑 **DEPRECATED in main workflow** | Annual report, equipment list, royalty, extension, attestation forms become a Service-des-Agréments sub-module (post-MVP) |
| A8 | Staff portal: login + role-aware landing | ✅ | ♻ **KEEP layout, EXPAND** | `/staff/inbox`, `/staff/recent`, `/staff/all` patterns reused. Role-aware logic expanded for ~37 roles (B7) |
| A9 | Secretary verification workflow | ✅ | ♻ **REUSE LAYOUT, REWRITE ACTIONS** | 3-zone workspace layout kept (sidebar + center + action rail). Récépissé moves to Courrier; signoff/handoff redesigned (B12) |
| A10 | AI OCR + insights pane | ✅ | ♻ **KEEP** | `src/lib/claude.ts` wrapper + `AiPane` reused. Repositioned at the DG dispatch step (B9) |

### Reusable assets (no rebuild needed)

- **Design system** — `tailwind.config.ts` palette, `globals.css` component classes, gov-bar, header style
- **`src/lib/db.ts`** — Prisma singleton
- **`src/lib/auth.ts` + `src/lib/auth.config.ts`** — split-config Auth.js (Edge-safe)
- **`src/lib/email.ts`** — Resend wrapper with graceful fallback
- **`src/lib/claude.ts`** — Anthropic wrapper with stub fallback
- **`src/lib/blob-storage.ts`** — Vercel Blob wrapper with stub fallback
- **`src/lib/fcfa.ts`** — BigInt-safe FCFA formatting
- **`src/components/LogoutButton.tsx`**
- **`/admin/users` and `/admin/data`** — admin pages (need new staff role list)
- **`/login` + `/post-login`** — auth pages (login flow unchanged; post-login routing updated in B7)
- **`/staff` layout (gov-bar + dark sidebar + corbeille counts)** — sidebar nav rebuilt around new roles

### To be removed / archived

- Convention-centric Prisma models: `Convention`, `WorkflowEvent` (5-stage variant),
  `FinancialSummary`, `EquipmentList`, `RoyaltyPayment`, `ExtensionRequest`, `AttestationRequest`,
  `AnnualReport`, `PostSignatureSubmission`
- 5-stage `ConventionStage` enum + `WorkflowAction` enum (rebuilt around new vocabulary)
- `StaffRole` enum (rebuilt: 6 values → ~37)
- Pages: `/investor/conventions/[id]/*` (all sub-routes — tracker, edit, obligations,
  annual-report, equipment-list, royalty, extension, attestation, print)
- Pages: `/staff/conventions/[id]` (kept as scaffold; logic replaced)
- Server actions: `lib/actions/convention.ts`, `lib/actions/obligations.ts`,
  `lib/actions/staff-workflow.ts`, `lib/actions/ai-analysis.ts` (logic rewritten for new model)
- Seed data: all current sample conventions removed; seed rewritten for the document workflow

---

# 3. New activity plan (B-track)

29 activities, organised in 7 phases. Each ends with a TEST GATE. The plan follows the
narrative of `Workflow_API.html`.

## Phase 0 — Re-baseline & cleanup

### B0 — Re-baseline document (this file) ✅
Adopted on 2026-05-24. No code change.

### B1 — Schema redesign (document-centric) ⬜
**Goal:** rebuild Prisma schema around a generic `Document` object that flows through the
organigramme tree, independent of investor / agrément context.

| # | Sub-task | Status |
|---|---|---|
| B1.1 | Define new models: `Document`, `DocumentVersion`, `Submission`, `Assignment`, `Handoff`, `Comment`, `Attachment` | ⬜ |
| B1.2 | New `Notification` (keep), `AuditTrailEntry` (keep), `AiAnalysis` (keep) | ⬜ |
| B1.3 | New enums: `DocumentStatus`, `DocumentNature`, `HandoffType` (vertical-down / horizontal / return-up) | ⬜ |
| B1.4 | Keep `User`, `Account`, `Session`, `VerificationToken` (Auth.js) | ⬜ |
| B1.5 | Drop deprecated models (Convention, WorkflowEvent variant, EquipmentList, etc.) | ⬜ |
| B1.6 | `prisma db push --force-reset` to Neon | ⬜ |

**TEST GATE B1:** Prisma client compiles, Neon shows new tables, `/admin/data` counters display zeros for new models.

### B2 — StaffRole enum expansion (37 roles) ⬜
**Goal:** model every distinct unit in the organigramme so handoffs can target any of them.

| # | Sub-task | Status |
|---|---|---|
| B2.1 | Replace `StaffRole` enum with full list: DG, DGA, ATTACHE, AUDITEUR_INTERNE, CHEF_SOUSDIR_COMM, CHEF_SERVICE_COMM, CHEF_SERVICE_RP, CHEF_CELL_TRAD, CHEF_SOUSDIR_AG, CHEF_SERVICE_SAF, CHEF_SERVICE_RH, CHEF_SERVICE_INFO, CHEF_SERVICE_MATERIEL, CHEF_SERVICE_JUR, CHEF_SERVICE_COURRIER, CHEF_BUREAU_ARRIVEE, CHEF_BUREAU_DEPART, CHEF_BUREAU_ARCHIVES, DIR_PROMOTION, CHEF_SOUSDIR_LOCALE, CHEF_SERVICE_PRIMAIRE, CHEF_SERVICE_SECONDAIRE, CHEF_SERVICE_TERTIAIRE, CHEF_SOUSDIR_ETRANGER, CHEF_SERVICE_EUROPE, CHEF_SERVICE_AMERIQUE, CHEF_SERVICE_MOAP, CHEF_SERVICE_AFRIQUE, DIR_FACILITATION, CHEF_SOUSDIR_FACILITATION, CHEF_SERVICE_ACCUEIL, CHEF_SERVICE_AGREMENTS, CHEF_SOUSDIR_COOPERATION, CHEF_SERVICE_BILATERALE, CHEF_SERVICE_MULTILATERALE, CHEF_DIV_SUIVI, CHEF_CELL_SUIVI_EVAL, CHEF_CELL_STRATEGIE, CHEF_ANTENNE, ADMIN | ⬜ |
| B2.2 | `src/lib/roles.ts` — FR labels, ranks (Art. 46), unit-to-parent mapping (organigramme tree) | ⬜ |
| B2.3 | `/admin/users` — replace select with hierarchical grouped picker | ⬜ |
| B2.4 | Seed update — 1 user per role with realistic French names | ⬜ |

**TEST GATE B2:** /admin/users shows all 37 roles grouped by unit; one seeded user per role visible in the table.

### B3 — Migration, rollback tag & i18n infrastructure ⬜
**Goal:** lock the v1 → v2 transition + set up bilingual FR/EN infrastructure from day 1
(per R7 decision).

| # | Sub-task | Status |
|---|---|---|
| B3.1 | Rename `EXECUTION_PLAN.md` → `EXECUTION_PLAN_v1.md` (preserve history) | ⬜ |
| B3.2 | Write `MIGRATION_v1_to_v2.md` — what's deleted, what's kept | ⬜ |
| B3.3 | Tag last v1 commit (`git tag v1-final`) on `main` for rollback | ⬜ |
| B3.4 | Install `next-intl` (Next.js 15 standard for App Router i18n) | ⬜ |
| B3.5 | Create `src/i18n/fr.json` + `src/i18n/en.json` skeleton | ⬜ |
| B3.6 | Middleware-based locale detection (`/fr/...`, `/en/...`) + cookie persistence | ⬜ |
| B3.7 | Language toggle component in header (already styled in v1 gov-bar) | ⬜ |
| B3.8 | Convention: every subsequent activity ships FR + EN strings | ⬜ |

**TEST GATE B3:** docs in place, tag visible on GitHub, `/en/` and `/fr/` both serve a translated landing page.

---

## Phase 1 — Entry layer (Service du Courrier · Art. 15-18)

### B4 — Public document submission portal ⬜
**Goal:** anyone (investor, partner administration, NGO, citizen) can submit a document online
without prior registration. Replaces the investor-only `/signup`.

| # | Sub-task | Status |
|---|---|---|
| B4.1 | `/submit` page — no login required | ⬜ |
| B4.2 | Form fields: nom & qualité émetteur, email de contact, objet, document(s) PDF | ⬜ |
| B4.3 | Optional: téléphone, organisation, adresse postale | ⬜ |
| B4.4 | Server action: create `Submission` + `Document`, generate n° courrier, store PDF in Blob | ⬜ |
| B4.5 | Confirmation page with n° courrier + tracking link | ⬜ |
| B4.6 | Send accusé de réception email | ⬜ |
| B4.7 | Honeypot + rate limiting to prevent spam | ⬜ |

**TEST GATE B4:** open /submit in incognito, upload a PDF, see confirmation with n° courrier, receive accusé email.

### B5 — Bureau Courrier « Arrivée » dashboard ⬜
**Goal:** for documents arriving physically, the Bureau Arrivée scans them and injects them
into the workflow. For online submissions, this dashboard validates and forwards.

| # | Sub-task | Status |
|---|---|---|
| B5.1 | `/staff/courrier/arrivee` — list of new documents (online + physical pending registration) | ⬜ |
| B5.2 | "Enregistrer un courrier physique" button — opens form with metadata + scan upload | ⬜ |
| B5.3 | Per-doc action: assign n° courrier, validate metadata, push to DG queue | ⬜ |
| B5.4 | Send / re-send accusé to émetteur | ⬜ |
| B5.5 | Tableau de bord de circulation (Art. 16) — registry view with timestamps | ⬜ |

**TEST GATE B5:** as `arrivee@api.cm`, scan a physical doc, register it, see it forwarded to DG. Émetteur receives accusé.

### B6 — Bureau Courrier « Départ » & Archives ⬜
**Goal:** outgoing channel for DG responses + archival.

| # | Sub-task | Status |
|---|---|---|
| B6.1 | `/staff/courrier/depart` — list of DG-approved responses awaiting expedition | ⬜ |
| B6.2 | Action: expedite by email (sign + send) and/or print for physical dispatch | ⬜ |
| B6.3 | `/staff/courrier/archives` — long-term storage view, search by n° / date / émetteur | ⬜ |
| B6.4 | Auto-archive document after DG marks "clos" | ⬜ |

**TEST GATE B6:** complete a full Courrier → DG → Courrier round-trip; archived document searchable by n° courrier.

---

## Phase 2 — DG dispatcher (with AI)

### B7 — DG dashboard (`/dg`) ⬜
**Goal:** the DG's single workspace. Inbox of incoming documents, AI summaries on cards.

| # | Sub-task | Status |
|---|---|---|
| B7.1 | `/dg/inbox` — cards for each document awaiting analysis | ⬜ |
| B7.2 | Each card: n° courrier, source, AI résumé (3-5 phrases), AI suggestion d'assignation | ⬜ |
| B7.3 | Sidebar nav: Inbox · En cours · Terminés · Archives | ⬜ |
| B7.4 | Counters live | ⬜ |
| B7.5 | Update `/post-login` to route role=DG to `/dg/inbox` | ⬜ |

**TEST GATE B7:** as `dg@api.cm`, log in, land on /dg/inbox showing the documents queued by Courrier.

### B8 — AI dispatcher engine ⬜
**Goal:** as soon as a document hits the DG queue, Claude runs OCR + résumé + classification +
suggestion. Cached so re-opens are free.

| # | Sub-task | Status |
|---|---|---|
| B8.1 | Server action `analyseIncomingDocument(docId)` — runs Claude with organigramme context | ⬜ |
| B8.2 | Claude prompt embedding the full role catalogue (37 units + responsibilities) | ⬜ |
| B8.3 | Output schema: `{ resume, themeDetected, suggestedUnit, confidence, reasoning }` | ⬜ |
| B8.4 | Trigger on Courrier handoff (server-side, async) | ⬜ |
| B8.5 | Stub fallback returns plausible structured output | ⬜ |
| B8.6 | Token tracking surfaced on the card (cost transparency) | ⬜ |

**TEST GATE B8:** new submission triggers an `AiAnalysis` row within ~10 s; DG sees résumé + suggestion on card.

### B9 — DG dispatch UI ⬜
**Goal:** the click-through experience for the DG to confirm or modify the assignment and add
instructions.

| # | Sub-task | Status |
|---|---|---|
| B9.1 | `/dg/document/[id]` — three-pane layout: document viewer · AI panel · assignment form | ⬜ |
| B9.2 | "Confirmer la suggestion IA" green button (1 click → assign) | ⬜ |
| B9.3 | "Modifier l'assignation" → searchable picker grouped by Direction / Sous-dir / Service | ⬜ |
| B9.4 | Textarea: instructions complémentaires | ⬜ |
| B9.5 | Server action `assignDocument(docId, unitRole, instructions)` — creates `Assignment` row, writes audit, notifies destinataire | ⬜ |
| B9.6 | After assignment, doc leaves DG inbox, lands in destinataire's corbeille | ⬜ |

**TEST GATE B9:** dispatch 3 documents (confirm AI suggestion · modify · with instructions). Each lands in correct corbeille within 1 s. DG inbox count decreases. Notification fires to destinataire.

---

## Phase 3 — Universal treatment workspace

### B10 — Document treatment page (used by all units) ⬜
**Goal:** one page that adapts to any role — Director, Sous-directeur, Chef de Service, agent.

| # | Sub-task | Status |
|---|---|---|
| B10.1 | `/staff/document/[id]` — three-zone layout (sidebar nav / center document + history / right action rail) | ⬜ |
| B10.2 | Center: document viewer (PDF.js or `<iframe>`) + résumé IA + DG instructions | ⬜ |
| B10.3 | Below document: chronologie complète (Submission, accusé, dispatch, handoffs, comments) | ⬜ |
| B10.4 | Bottom: zone commentaire + zone upload pièces complémentaires | ⬜ |
| B10.5 | Right rail: actions adapted to current role (B11-B15) | ⬜ |

**TEST GATE B10:** as any staff role, open a document assigned to me, see the full context.

### B11 — Vertical handoff (descending) ⬜
**Goal:** a Director can hand off down to a Sous-direction or Service; a Sous-directeur can hand
off to a Service or Bureau; etc. Constrained by the organigramme tree.

| # | Sub-task | Status |
|---|---|---|
| B11.1 | Action rail picker: "Transmettre à un subordonné" → list of direct children of my unit | ⬜ |
| B11.2 | Optional motif/instructions textarea | ⬜ |
| B11.3 | Server action `handoffDown(docId, childRole, motif)` — writes `Handoff(type=VERTICAL_DOWN)`, notifies | ⬜ |
| B11.4 | History line: "M. X a transmis à Mme Y · [motif]" | ⬜ |

**TEST GATE B11:** chain handoff Director → Sous-dir → Service → agent. Each step notified, history complete.

### B12 — Horizontal handoff (cross-direction) ⬜
**Goal:** between Directors only. The DG is notified.

| # | Sub-task | Status |
|---|---|---|
| B12.1 | Action rail: "Transmettre à un autre Directeur" (visible only for role=DIRECTEUR or ADMIN) | ⬜ |
| B12.2 | Picker shows only sibling Directors | ⬜ |
| B12.3 | Motif obligatoire (≥ 20 chars) | ⬜ |
| B12.4 | Server action `handoffHorizontal(docId, otherDirectorRole, motif)` — `Handoff(type=HORIZONTAL)`, notify destinataire + DG | ⬜ |
| B12.5 | Both directors track the document (visibility) | ⬜ |

**TEST GATE B12:** as DIR_PROMOTION, hand off horizontally to DIR_FACILITATION with motif. DG notified, both can see the doc.

### B13 — Return upward (to supervisor) ⬜
**Goal:** an agent who has finished his part returns the document to his immediate supervisor.

| # | Sub-task | Status |
|---|---|---|
| B13.1 | Action: "Remonter à mon supérieur" — auto-detects parent role | ⬜ |
| B13.2 | Mandatory recommendation textarea | ⬜ |
| B13.3 | Server action `returnUp(docId, recommendation)` — `Handoff(type=RETURN_UP)` | ⬜ |
| B13.4 | Director who originally received from DG eventually sends back to DG (B17) | ⬜ |

**TEST GATE B13:** complete chain → agent returns to SD → SD returns to Dir → Dir prepares return to DG.

### B14 — Comments & attachments per step ⬜
**Goal:** every actor can leave traces.

| # | Sub-task | Status |
|---|---|---|
| B14.1 | Server action `addComment(docId, body)` | ⬜ |
| B14.2 | Server action `addAttachment(docId, file)` — Vercel Blob | ⬜ |
| B14.3 | Comments + attachments visible in chronologie | ⬜ |
| B14.4 | Threading optional (parent_id) | ⬜ |

**TEST GATE B14:** add 3 comments + 2 attachments along the chain; all visible to next destinataire.

### B14.5 — Transmission externe pour avis (Ministre des Finances et autres) ⬜
**Goal:** per R1, the workflow must support sending a document to an external administration
(typically Ministre des Finances for agréments per Art. 30) and receiving back its avis,
then re-injecting it into the internal treatment chain.

| # | Sub-task | Status |
|---|---|---|
| B14.5.1 | New Prisma model `ExternalTransmission`: { documentId, recipient, purpose, sentAt, sentByUserId, expectedReturnAt, receivedAt, opinionPdf, opinionSummary } | ⬜ |
| B14.5.2 | New enum `ExternalRecipient`: MINISTRE_FINANCES, MINISTRE_INDUSTRIE, DGI, DGD, MINISTRE_AUTRE, ADMINISTRATION_AUTRE | ⬜ |
| B14.5.3 | Action rail option (visible at Direction / Sous-direction level): "Solliciter un avis externe" | ⬜ |
| B14.5.4 | Form: recipient picker, purpose textarea, optional expected return date, cover letter | ⬜ |
| B14.5.5 | Server action `requestExternalOpinion(docId, recipient, purpose)` — status → AWAITING_EXTERNAL_AVIS, doc transmis via Bureau Départ | ⬜ |
| B14.5.6 | Bureau Départ sees the outbound, expedites (email + physical letter), registers in chrono | ⬜ |
| B14.5.7 | When the external avis arrives (via Bureau Arrivée), the operator can attach it to the existing `ExternalTransmission` (lookup by reference) | ⬜ |
| B14.5.8 | On avis reception: status returns to IN_TREATMENT, AI generates a short summary of the avis, destinataire notified | ⬜ |
| B14.5.9 | UI: a dedicated tab "Avis externes" on the document workspace listing all pending and received avis | ⬜ |

**TEST GATE B14.5:** as Director Facilitation, request an avis from Ministre des Finances; as Bureau Départ, expedite; simulate inbound avis via Bureau Arrivée; verify it attaches to the original document and treatment resumes.

### B15 — Visibility rules engine ⬜
**Goal:** top-down hierarchical visibility enforced at the data layer.

| # | Sub-task | Status |
|---|---|---|
| B15.1 | `src/lib/visibility.ts` — function `canViewDocument(role, doc)` based on organigramme tree | ⬜ |
| B15.2 | Subordinate roles see everything the document has done | ⬜ |
| B15.3 | Superior cannot see assignments of sibling branches not in their tree | ⬜ |
| B15.4 | DG sees everything | ⬜ |
| B15.5 | Apply in Prisma queries (Where clauses) | ⬜ |
| B15.6 | Permission middleware on document detail page | ⬜ |

**TEST GATE B15:** log in as different roles, verify visibility — a Chef de Service Comptabilité cannot see documents currently with Service des Agréments.

---

## Phase 4 — Closure cycle

### B16 — Return to DG (treatment complete) ⬜
**Goal:** when a Director judges treatment is complete, they consolidate and send back to DG.

| # | Sub-task | Status |
|---|---|---|
| B16.1 | Director sees "Renvoyer au DG" button when chain has returned up to them | ⬜ |
| B16.2 | Form: recommandation finale (rich text) + summary of attachments added | ⬜ |
| B16.3 | Server action `returnToDg(docId, recommendation)` — `Handoff(type=RETURN_TO_DG)`, status → AWAITING_DG_DECISION | ⬜ |
| B16.4 | Document appears in DG inbox with new tag "À décider" | ⬜ |

**TEST GATE B16:** complete treatment, return to DG, DG sees the doc with consolidated recommendation.

### B17 — DG decision UI ⬜
**Goal:** the DG takes the final action.

| # | Sub-task | Status |
|---|---|---|
| B17.1 | `/dg/document/[id]/decide` — full chronologie, all attachments, recommendation | ⬜ |
| B17.2 | Decision options: SIGN, REQUEST_PRECISION, REJECT, TRANSMIT_EXTERNAL | ⬜ |
| B17.3 | Per-decision form fields (reply text, attachments, external recipient if TRANSMIT) | ⬜ |
| B17.4 | Server action `dgDecide(docId, decisionType, payload)` — status → DECIDED | ⬜ |

**TEST GATE B17:** DG signs a decision; chronologie shows the action; status flips to DECIDED.

### B18 — Response via Bureau Départ ⬜
**Goal:** the DG's response leaves the API only through the Courrier.

| # | Sub-task | Status |
|---|---|---|
| B18.1 | On DG decision, response queued to Bureau Départ (`/staff/courrier/depart`) | ⬜ |
| B18.2 | Bureau Départ "Expédier" action → email to émetteur (+ optional physical print) | ⬜ |
| B18.3 | Register entry in Départ chrono | ⬜ |
| B18.4 | Status → RESPONSE_SENT, émetteur notified | ⬜ |

**TEST GATE B18:** as DG, sign; as Courrier Départ, expedite; émetteur receives email; status = RESPONSE_SENT.

### B19 — Closure or maintain open ⬜
**Goal:** DG flag the dossier for archival or for further follow-up.

| # | Sub-task | Status |
|---|---|---|
| B19.1 | After response sent, DG sees "Clôturer le dossier" / "Maintenir ouvert" choice | ⬜ |
| B19.2 | Closure: status → CLOSED, transfer to Bureau des Archives (Art. 18) | ⬜ |
| B19.3 | Maintain: status → AWAITING_FOLLOW_UP, surfaces if émetteur replies | ⬜ |

**TEST GATE B19:** close 1 dossier (appears in /staff/courrier/archives); maintain another (stays in /staff/courrier/arrivee follow-up list).

---

## Phase 5 — Cross-cutting

### B20 — Notifications (in-app + email) ⬜

| # | Sub-task | Status |
|---|---|---|
| B20.1 | Notification bell in every staff header (count of unread) | ⬜ |
| B20.2 | `/staff/notifications` page — full list | ⬜ |
| B20.3 | Email notifications via Resend at each handoff | ⬜ |
| B20.4 | User can mute email per category | ⬜ |

**TEST GATE B20:** trigger 5 handoffs, see 5 bell notifications + 5 emails (Resend logs).

### B21 — Audit trail per document ⬜
**Goal:** complete chain-of-custody view (already partially built — extend).

| # | Sub-task | Status |
|---|---|---|
| B21.1 | Every action writes `AuditTrailEntry` with hash chain | ⬜ |
| B21.2 | `/staff/document/[id]/audit` view (visible to ADMIN + AUDITEUR_INTERNE only) | ⬜ |

**TEST GATE B21:** as AUDITEUR_INTERNE, see complete audit log of a closed document.

### B22 — Public tracking page ⬜
**Goal:** anyone can look up their document's status with the n° courrier.

| # | Sub-task | Status |
|---|---|---|
| B22.1 | `/track?ref=COURRIER-NUMBER` (or `/courrier/[ref]`) — public page | ⬜ |
| B22.2 | Shows: date received, current stage (high-level label), expected response date if applicable | ⬜ |
| B22.3 | Does NOT reveal internal staff names or organigramme details | ⬜ |
| B22.4 | Optional: email entry to receive status updates | ⬜ |

**TEST GATE B22:** submit doc, get n° courrier, visit /track in incognito, see "Reçu le X, en traitement par la Direction de Y".

### B23 — Antennes régionales intake (Art. 41-44) ⬜
**Goal:** regional offices can also receive documents physically and inject them into the
workflow. Per R3, **4 antennes seeded at launch** (additional antennes addable later via
`/admin/antennes`).

| # | Sub-task | Status |
|---|---|---|
| B23.1 | New Prisma model `Antenne`: { id, region, ville, address, chefUserId, active } | ⬜ |
| B23.2 | `/admin/antennes` — admin can create/disable antennas | ⬜ |
| B23.3 | Seed 4 antennas — placeholders, regions to be confirmed by client (suggested: Centre, Littoral, Nord, Ouest) | ⬜ |
| B23.4 | `/staff/antenne/[id]` — Chef d'Antenne dashboard (scoped to their antenna) | ⬜ |
| B23.5 | Reception form (Art. 44 — Bureau Facilitation, Assistance et Suivi) | ⬜ |
| B23.6 | Scan upload + transmit to DG (Art. 41 explicit duty: "transmission à la Direction Générale") | ⬜ |
| B23.7 | Bureau Courrier sees the regional source (antenna name) on the document card | ⬜ |

**TEST GATE B23:** as Chef d'Antenne #2 (e.g. Littoral), register a regional submission; it lands in DG inbox tagged "Reçu via Antenne Littoral".

### B24 — Search & filtering ⬜

| # | Sub-task | Status |
|---|---|---|
| B24.1 | Global search bar in /staff header — n° courrier · émetteur · objet | ⬜ |
| B24.2 | Filters in each inbox: status, source, date range, assigned unit | ⬜ |
| B24.3 | Full-text search on OCR'd text (use Postgres `tsvector`) | ⬜ |

**TEST GATE B24:** find a specific document via 3 different search criteria.

### B25 — GM Dashboard with KPIs ⬜

| # | Sub-task | Status |
|---|---|---|
| B25.1 | `/dg/dashboard` (separate from inbox) — performance KPIs | ⬜ |
| B25.2 | Cards: documents reçus this month, time-to-dispatch median, time-to-decide median, dossiers ouverts par direction | ⬜ |
| B25.3 | Funnel viz: Courrier → DG → Direction → Treatment → Decision → Response | ⬜ |
| B25.4 | Late-treatment alerts | ⬜ |

**TEST GATE B25:** with seed data over 30 days, GM Dashboard shows realistic KPIs.

---

## Phase 6 — Finishing

### B26 — Bilingual QA review & finalisation ⬜
**Goal:** since FR + EN is built in from B3 onward (per R7), this activity is the final
consolidation pass — not the initial implementation.

| # | Sub-task | Status |
|---|---|---|
| B26.1 | Audit all UI strings — completeness FR + EN (no missing keys) | ⬜ |
| B26.2 | Review translations for tone, gov-grade French and English | ⬜ |
| B26.3 | Verify all email templates available in both languages | ⬜ |
| B26.4 | Language toggle works on every page incl. error states | ⬜ |
| B26.5 | Date / number / currency formatting locale-aware | ⬜ |
| B26.6 | Public submission portal (/submit) and tracking page (/track) bilingual | ⬜ |

**TEST GATE B26:** switch every page to English, full UI is translated; switch back to French, same.

### B27 — QA, accessibility, security review ⬜

| # | Sub-task | Status |
|---|---|---|
| B27.1 | Full-flow regression test (Courrier → DG → Direction → Treatment → Decision → Response) | ⬜ |
| B27.2 | Accessibility audit (keyboard navigation, screen reader, contrast) | ⬜ |
| B27.3 | Security review: visibility rules, RLS, XSS, file upload, rate limits | ⬜ |
| B27.4 | Penetration test on /submit (public endpoint) | ⬜ |

**TEST GATE B27:** documented audit report; all P1 issues fixed.

### B28 — Onboarding (final activity) ⬜
**Goal:** drop the admin/admin shortcut, implement real password setup for staff.

| # | Sub-task | Status |
|---|---|---|
| B28.1 | Welcome email on user creation → password-set link (1h validity) | ⬜ |
| B28.2 | `/set-password/[token]` page | ⬜ |
| B28.3 | Force password change on first login | ⬜ |
| B28.4 | Optional 2FA for DG and Directors (TOTP) | ⬜ |
| B28.5 | Disable admin/admin shortcut | ⬜ |
| B28.6 | Production-ready environment variable checklist | ⬜ |

**TEST GATE B28:** create new staff user via /admin/users; new user receives email with set-password link; logs in with their own password.

---

# 4. Estimated effort

| Phase | Activities | Est. days (1 dev) | Comment |
|---|---|---|---|
| 0 — Re-baseline | B0-B3 | 2-3 | Doc + schema + i18n infra (R7) |
| 1 — Entry (Courrier) | B4-B6 | 4-5 | Most reusable existing patterns |
| 2 — DG + AI | B7-B9 | 4-5 | Reuses Claude integration |
| 3 — Treatment | B10-B15 + **B14.5** | 7-9 | Largest piece; reuses A9 layout. +1 day for external advisory (R1) |
| 4 — Closure | B16-B19 | 3-4 | |
| 5 — Cross-cutting | B20-B25 | 5-7 | +0.5 day for 4-antennas seed (R3) |
| 6 — Finishing | B26-B28 | 3-4 | Lighter because bilingual built in (R7) |
| **TOTAL** | **30 activities** | **28-37 days** | ~6-8 weeks at sustained pace |

For comparison, v1 A0-A10 (13 activities) took ~10 days of work — so the cadence is consistent.

---

# 5. Risks & open questions — RESOLVED 2026-05-24

| # | Question | Decision |
|---|---|---|
| R1 | Avis Ministre des Finances dans le scope ? | ✅ **OUI** — voir B14.5 |
| R2 | Remplacer ou paralléliser v1 ? | ✅ **REMPLACER** |
| R3 | Combien d'antennes ? | ✅ **4 au lancement**, ajoutables ensuite |
| R4 | Vérification email sur /submit ? | ⏸ **Ignorer pour MVP** |
| R5 | Coût IA acceptable ? | ✅ **OK** |
| R6 | Durée légale d'archivage ? | ⏸ **Ignorer pour MVP** |
| R7 | Bilingue au lancement ? | ✅ **OUI** — i18n built-in dès B3 |
| R8 | Porter les formulaires post-signature v1 A7 ? | ⏸ **Ignorer pour MVP** (sous-module futur potentiel) |

**Nouveaux risques à surveiller :**

| # | Risque | Mitigation |
|---|---|---|
| N1 | Volume de chaînes à traduire (FR + EN) ralentit chaque activité | Convention : chaque PR contient les 2 langues, pas de "TODO traduction" reporté |
| N2 | Le client doit confirmer les 4 régions des antennes seedées | Demande au début de B23 ; placeholder neutre acceptable d'ici là |
| N3 | Format exact du retour d'avis du Ministère des Finances (email PDF, courrier physique, lettre type) | À clarifier au début de B14.5 ; design flexible par défaut |

---

# 6. Next concrete step

Awaiting user **"approve v2 plan, start B1"** to launch execution.

Once approved, the first activity is **B1 (schema redesign)** — it requires:
1. Confirming the new Prisma schema shape
2. A `prisma db push --force-reset` on Neon (destructive — wipes existing seed data)
3. Re-seeding with a minimal set of users + one sample document

Then B2 (37 staff roles) and B3 (i18n infra + migration script).

---

⚜ Document v2 · établi le 24 mai 2026 · décisions cadrantes validées · prêt pour exécution ⚜
