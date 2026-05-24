# API Cameroun — Work Breakdown Structure
## Lowest-level task list, Phase 0 → Phase 3 → Go-Live

> **Companion to:** [PROJECT_PLAN.md](PROJECT_PLAN.md). This file is the operational checklist. Mark items ✓ as they complete; the running totals at the top of each phase track progress.
>
> **Sizing convention:** each leaf task ≈ 1–3 developer-days. A "week" = 5 dev-days × 1 lead dev. Two devs ≠ 2× speed when work is sequential.
>
> **Status legend:** ✅ done · 🟡 in progress · ⬜ not started · 🟦 deferred (per user direction)

---

## Summary

| Phase | Weeks | Tasks | ✅ Done | 🟡 In progress | ⬜ Open | 🟦 Deferred |
|---|---|---|---|---|---|---|
| 0 — Foundations | 4 | 12 | 12 | 0 | 0 | 0 |
| 1 — MVP | 12 | 60 | 24 | 0 | 29 | 7 |
| 2 — Full lifecycle | 10 | 47 | 0 | 0 | 47 | 0 |
| 3 — Maturity & go-live | 8 | 41 | 0 | 0 | 41 | 0 |
| **Total** | **34** | **160** | **36 (22 %)** | **0** | **117** | **7** |

---

## Phase 0 — Foundations (4 weeks · ✅ complete)

### W0.1 Stack & repo (3 days)
- ✅ Choose stack: Next.js 15 + TypeScript + PostgreSQL + Prisma + Auth.js v5 + Tailwind + shadcn/ui
- ✅ Initialise repo, `.gitignore`, `README.md`
- ✅ GitHub Actions CI workflow (`app-ci.yml`) — typecheck + build on every push

### W0.2 Design system (2 days)
- ✅ `tailwind.config.ts` — Cameroon-flag palette (`cmgreen`, `cmred`, `cmyellow`) + neutrals
- ✅ `globals.css` — design tokens, base layer, component classes (`btn-primary`, `card`, `pill`)
- ✅ `Logo` component with inline SVG + PNG fallback

### W0.3 Data model & schema (4 days)
- ✅ Prisma schema: `User`, `Account`, `Session`, `VerificationToken`, `InvestorProfile`, `Dossier`, `Document`, `Opinion`, `EquipmentList`, `AnnualReport`, `AuditCase`, `Sanction`, `Recourse`, `HistoryEntry`, `Notification`, `AuditTrailEntry`, `ZdpLocality`, `BusinessHoliday` (20+ tables)
- ✅ Enums: `UserType`, `StaffRole`, `UserStatus`, `KycStatus`, `Regime`, `ProjectType`, `Sector`, `Category`, `DossierState`, `DocumentKind`, `VerificationState`, `AdminBody`, `OpinionPhase`, `OpinionPosition`, `SanctionKind`
- ✅ `prisma/seed.ts` — 6 staff + 3 investors + 6 ZDPs + 7 2026 holidays
- ✅ Prisma client singleton in `lib/db.ts`

### W0.4 Auth scaffold (3 days)
- ✅ Auth.js v5 config (`lib/auth.ts`) — Credentials provider + JWT sessions + Prisma adapter
- ✅ Auth handler at `/api/auth/[...nextauth]/route.ts`
- ✅ NextAuth module augmentation for `userType` + `staffRole` on `Session` and `JWT`

---

## Phase 1 — MVP (12 weeks · 2/12 weeks done, ~24/60 tasks · in progress)

### W1 Authentication (✅ complete · 5 days)
- ✅ Sign-up Server Action with Zod validation + bcrypt hash (`signupAction`)
- ✅ Sign-up page `/signup` with client form + auto-login after creation
- ✅ Login Server Action wrapping `signIn()` (`loginAction`)
- ✅ Login page `/login` with split brand/form layout
- ✅ Logout Server Action + `LogoutButton` component
- ✅ `middleware.ts` — gates `/investor` and `/staff` by user type, redirects unauth to `/login?next=`
- ✅ Post-login dispatcher `/dispatch` routing by user type
- ✅ Investor + staff dashboards greet user by name from session

### W2 2FA + OAuth (🟦 deferred — re-enable at the end per user direction)
- 🟦 TOTP secret generation + QR display screen
- 🟦 TOTP challenge during login (post-password step)
- 🟦 TOTP enable/disable in account settings
- 🟦 Optional Google OAuth provider
- 🟦 Optional Microsoft OAuth provider
- 🟦 Email verification flow (magic-link)
- 🟦 Password reset flow

### W3 Investor portal — new request + docs (✅ complete · 5 days)
- ✅ `createDossierAction` Server Action — Zod-validated, derives category from amount
- ✅ `/investor/new` wizard page (sector, type, amount, ZDP, installation duration, objet)
- ✅ Storage abstraction `lib/storage.ts` — `LocalDiskStorage` (default) + `VercelBlobStorage` stub
- ✅ `uploadDocAction` Server Action — 10 MB cap, PDF/JPG/PNG/WebP, SHA-256, ownership check
- ✅ `/investor/dossier/[id]` detail page — status banner, synthesis, doc checklist (6 pieces), history
- ✅ `submitDossierAction` — DRAFT → SUBMITTED + notify Reception staff
- ✅ Investor dashboard lists own dossiers with state badge + doc progress
- ✅ Unread-notification count on bell badge

### W4 Investor polish + supporting screens (⬜ 5 days)
- ⬜ Multi-step wizard refactor (currently single page) — step 1: project, step 2: docs, step 3: review
- ⬜ Document preview in browser (PDF.js viewer for staff + investor)
- ⬜ "Cancel draft" action (delete a DRAFT dossier)
- ⬜ Vertical status-tracker visual on dossier page (current stage highlighted)
- ⬜ Investor messages inbox `/investor/messages`
- ⬜ Account settings page `/investor/account` (change password, language, email prefs)

### W5 Reception staff — verification + récépissé (⬜ 5 days)
- ⬜ Staff dossier detail page `/staff/dossier/[id]`
- ⬜ Document-verification UI — per-piece accept/reject with mandatory reason on reject
- ⬜ Rejection notification back to investor (in-app + email)
- ⬜ Réception action panel — "Délivrer le récépissé" button blocked until all 6 docs accepted
- ⬜ State transition SUBMITTED → DOCS_VERIFICATION → RECEIPT_ISSUED with récépissé number generation
- ⬜ Récépissé PDF generation (React-PDF, FR + EN) with QR code for verification
- ⬜ 10-business-day SLA engine: business-day calendar reading `BusinessHoliday`, amber/red/breach thresholds
- ⬜ SLA pill on every dossier card (green/amber/red)

### W6 Instruction (technical review) (⬜ 5 days)
- ⬜ Instruction action panel for `INSTRUCTION` role
- ⬜ Draft convention editor — pre-fills the 12 mandatory clauses of Art. 31 from dossier data
- ⬜ `createOpinionAction` Server Action — emits an `Opinion` row + history entry
- ⬜ Avis-request notification system (notify next-stage role automatically)
- ⬜ Return-for-completion flow (state → RETURNED, investor gets actionable notification)

### W7 Tax + Customs Avis (⬜ 5 days)
- ⬜ DGI representative inbox view + avis form (favorable / réserve / défavorable + reasoning)
- ⬜ DGD representative inbox view + avis form
- ⬜ State-machine enforcement: cannot transition to CUSTOMS_OPINION_DONE without DGI avis present
- ⬜ Avis history component on dossier page — chronological, with signer + timestamp
- ⬜ Audit-trail writes for every avis emission (with SHA-256 chain)

### W8 Chef GU synthèse + défavorable branching (⬜ 5 days)
- ⬜ Synthèse screen for `CHEF_GU` role — all 3 avis displayed side-by-side
- ⬜ Synthèse comment textarea + "Valider" / "Retourner" actions
- ⬜ Défavorable detection — if any of (DGI, DGD) avis is `UNFAVORABLE`, dossier branches to Chef GU mandatory arbitration
- ⬜ Arbitration UI: Chef GU sees the unfavourable reason and can (a) reject the dossier with reasoned decision, (b) escalate to Comité d'audit (Phase 2), or (c) override with documented justification (rare)

### W9 DG signature + acte d'agrément (⬜ 5 days)
- ⬜ DG signature-queue screen
- ⬜ Convention preview (HTML render of the 12 clauses)
- ⬜ "Signer" / "Refuser" Server Actions
- ⬜ **Acte d'agrément PDF generation** (React-PDF, bilingual FR/EN, includes QR for public-register verification) — generated then printed for wet signature per user decision; PDF stored, hash recorded in audit trail
- ⬜ PDF upload of wet-signed acte (closes the workflow loop)
- ⬜ Investor notification with acte download link

### W10 Email & in-app notifications (⬜ 5 days)
- ⬜ Email service abstraction `lib/email.ts` — Resend adapter (dev) + AWS SES adapter (prod)
- ⬜ React-Email templates: doc accepted, doc rejected, récépissé issued, avis pending, avis issued, convention signed, deadline approaching
- ⬜ In-app notification panel (slide-in from header bell)
- ⬜ "Mark all as read" bulk action
- ⬜ Notification preferences page (email-only, in-app-only, both)

### W11 Bilingual FR/EN polish (⬜ 5 days)
- ⬜ Complete `lib/i18n.ts` dictionary for all 80+ UI strings
- ⬜ Language switcher in header (persists to user profile)
- ⬜ Date/number formatting per locale (Intl.DateTimeFormat with `fr-CM` / `en-CM`)
- ⬜ Email templates in both languages
- ⬜ PDF templates in both languages (per Art. 52 obligation)
- ⬜ Accessibility audit (axe-core in CI)

### W12 UAT + production deploy (⬜ 5 days)
- ⬜ Provision AWS environment (RDS Postgres + ECS Fargate + S3 + SES + Secrets Manager) per locked plan
- ⬜ Production deploy pipeline (GitHub Action → AWS)
- ⬜ Smoke tests on prod (auth, create dossier, upload, all 6 stages)
- ⬜ UAT scripts (1 per role) — real API staff click through with seed data
- ⬜ Bug-fix sprint based on UAT findings (estimated 2–3 days)
- ⬜ Go-live in **transitional mode** under Art. 50 (existing manual processes still allowed in parallel)
- ⬜ Training session 1 — Réception staff (in-person, 90 min, recorded)

---

## Phase 2 — Full lifecycle (10 weeks · ⬜ not started)

### W13–14 Equipment list (Art. 33) (10 days)
- ⬜ Investor uploads equipment list within 10 business days of signing (with reminders)
- ⬜ Equipment-list data model (line items: qty, HS code, description, unit value FCFA)
- ⬜ Customs (`CUSTOMS` role) avis on the list — accept/reject per line or whole list
- ⬜ HS-code lookup widget (Cameroon customs nomenclature) — scaffold for CAMCIS integration
- ⬜ Quarantine rules — auto-flag raw materials / industrial inputs / vehicles (Art. 33.4 — not eligible)
- ⬜ Locally-available similars check (Art. 33.5)
- ⬜ Joint validation by IPA + Customs, with both signatures captured

### W15–16 Installation phase tracking (10 days)
- ⬜ Installation-phase clock per dossier (5-year cap from Art. 10, configurable per convention)
- ⬜ Quarterly investor progress updates form (jobs created so far, % construction, % equipment installed)
- ⬜ Attestation de réalisation request flow (investor → IPA)
- ⬜ Joint appreciation visit scheduling (calendar for IPA + tax + customs + sector admin)
- ⬜ Visit report entry form (mobile-friendly for on-site capture)
- ⬜ Attestation PDF generation (Art. 34.1)
- ⬜ Autorisation provisoire d'exploitation flow (partial operation before installation phase ends, Art. 34.2)

### W17 Annual reporting (Art. 32) (5 days)
- ⬜ Annual report form: jobs, revenue, exports, value-added, taxes paid (per criteria of Art. 7/8)
- ⬜ Multi-recipient routing: IPA + Comité d'audit + tax + customs (Art. 32.1)
- ⬜ Hard deadline 31 March; late-fine accrual 1 M FCFA/month (Art. 32.3)
- ⬜ Compliance evaluation by IPA — vs declared eligibility criteria
- ⬜ Annual-report archive page per dossier

### W18 Annual royalty (Art. 48) (5 days)
- ⬜ Royalty calculation: 0.1 % × declared investment, capped at 5 M FCFA (floor 100k FCFA)
- ⬜ Royalty payment portal for investor
- ⬜ Mobile-money integration (Orange Money + MTN MoMo) — primary
- ⬜ Bank card / virement secondary
- ⬜ Receipt generation (PDF) + automatic invoice to investor
- ⬜ Royalty reminder cron (60 days before due)

### W19–20 Audit & control (Art. 36–39) (10 days)
- ⬜ Comité d'audit case workbench `/staff/audit/[id]`
- ⬜ Unité technique investigator workspace: evidence collection, document requests, on-site visit reports
- ⬜ Audit case auto-open on annual-report receipt + manual open by Comité/DG
- ⬜ Findings report editor with templates (CONFORM / NON_CONFORM)
- ⬜ A-posteriori review of GU agréments — Comité can revise / annul (Art. 39.2)

### W21 Sanctions (Art. 41–42) (5 days)
- ⬜ Procès-verbal (PV) editor + PDF generation
- ⬜ 10-day investor response timer (Art. 41.2) with notification escalation
- ⬜ 10-day administration position-notification timer (Art. 41.2)
- ⬜ Mise en demeure issuance — 15-day clock (Art. 42)
- ⬜ Fine schedule application: 10 / 15 / 25 M FCFA by category (Art. 41.3)
- ⬜ Suspension management (max 6 months, Art. 41.3)
- ⬜ Withdrawal flow + automatic notification to tax + customs for recovery (Art. 37.3)

### W22 Recourse (Art. 40) (5 days)
- ⬜ Recours filing form on investor portal
- ⬜ 30-day amicable-procedure clock (Art. 40.2)
- ⬜ Comité session management (agenda, packets, attendance)
- ⬜ Resolution outcomes (resolved / unresolved / closed)
- ⬜ Escalation marker to jurisdictions / arbitration (out-of-system after this)

### W23 External integrations (5 days)
- ⬜ RCCM adapter for NIU verification at investor sign-up + dossier creation
- ⬜ DGI Mediator API adapter — read fiscal regularity status
- ⬜ CAMCIS adapter for equipment-list customs validation
- ⬜ GUCE adapter for external trade operations
- ⬜ Retry/backoff/circuit-breaker for each integration
- ⬜ Integration health dashboard for admins

### W24 Phase 2 UAT + release (5 days)
- ⬜ End-to-end test scripts for the full post-agrément lifecycle
- ⬜ UAT with all 10 staff role types + real investors
- ⬜ Bug-fix sprint
- ⬜ Phase 2 production release
- ⬜ Training session 2 — Comité d'audit + Unité technique

---

## Phase 3 — Maturity, hardening & go-live (8 weeks · ⬜ not started)

### W25–26 Public agrément register (10 days)
- ⬜ Public read-only listing page `/public/registre` of signed conventions
- ⬜ Search by sector, region, year, name (case-insensitive)
- ⬜ Statistics dashboard for public (Y-o-Y, sector mix, regional mix)
- ⬜ Open-data export (CSV + JSON) for civil society / journalists / researchers
- ⬜ Verification page (paste agrément number → see public details + QR validity)
- ⬜ SEO + sitemap

### W27 Comité d'audit session console (5 days)
- ⬜ Session agenda builder
- ⬜ Document packet generation per session (PDF bundle for committee members)
- ⬜ PV editor with rich text + voting record
- ⬜ Decisions register (searchable)
- ⬜ Session calendar with reminders

### W28 Advanced analytics (5 days)
- ⬜ Dashboards (sector mix, regional mix, SLA performance, conversion funnel)
- ⬜ Fine receipts reporting + breakdown by category
- ⬜ Royalty receipts reporting + projections
- ⬜ Year-over-year trends with target overlay
- ⬜ One-click export to PDF / Excel for the DG's board reports

### W29 Mobile optimisation (5 days)
- ⬜ Responsive QA on every page (Chrome DevTools + real devices)
- ⬜ Touch-friendly form inputs (file pickers, date pickers)
- ⬜ Mobile-specific navigation (bottom nav for investor app)
- ⬜ PWA manifest + install prompt
- ⬜ Offline draft mode via Service Worker (drafts saved locally, sync on reconnect)

### W30 Security hardening (5 days)
- ⬜ Penetration test by external firm
- ⬜ SAST scan (CodeQL in CI)
- ⬜ DAST scan (OWASP ZAP) against staging
- ⬜ Dependency audit (Snyk / npm audit / Renovate weekly)
- ⬜ Rate-limit middleware on every public endpoint (Upstash Ratelimit)
- ⬜ WAF rules (AWS WAF) — OWASP top-10 baseline
- ⬜ Security incident response runbook (who-does-what)

### W31 DR + backup (5 days)
- ⬜ Hot standby in second AWS region (eu-central-1 Frankfurt)
- ⬜ Automated failover testing (cross-region replica promotion)
- ⬜ Daily encrypted RDS snapshots + weekly off-site copy
- ⬜ Restore drill (quarterly) — documented procedure executed end-to-end
- ⬜ Runbook documentation in `/docs/runbooks/`

### W32 Training materials (5 days)
- ⬜ User guide per role (10 roles × ~12-page PDF)
- ⬜ Video walkthroughs (10 videos × 5 min)
- ⬜ Quick-start cards (1-pagers, printed and laminated for desks)
- ⬜ FAQ page integrated into the app
- ⬜ In-app help tooltips on complex screens
- ⬜ Bilingual versions (FR + EN) of everything above

### W33 Production go-live + hypercare (5 days)
- ⬜ Final UAT — full system, all roles, 50+ test dossiers
- ⬜ Load testing — peak load simulation (1000 concurrent investors, 100 concurrent staff)
- ⬜ Go-live communication: DG announcement, press release, stakeholder emails
- ⬜ Transitional mode lifted (Art. 50) — system becomes the official channel
- ⬜ Hypercare: first 4 weeks of post-launch dedicated support, daily standups, hotfix lane
- ⬜ Project retrospective + closure document

---

## Cross-phase work (not bound to a specific week)

These run continuously throughout the build:
- 🟢 **Code review** — every PR reviewed before merge
- 🟢 **Testing** — unit (Vitest) + integration (Playwright) tests written alongside features; target 70 % coverage
- 🟢 **Documentation** — keep `WORKFLOW_DESIGN.md` and `PROJECT_PLAN.md` current; comment Server Actions
- 🟢 **Stakeholder demos** — every 2 weeks, share progress with DG + Chef GU; gather feedback
- 🟢 **Bug triage** — daily during UAT phases (W12, W24, W33)

---

## Critical-path dependencies

Items that block the most downstream work, in order of severity:

1. **W5 Reception verification** — gates *all* staff workflow. Until this lands, the simulated demo is the only way to see the post-submission stages.
2. **W10 Notifications** — gates the user experience polish; without it, users won't know when their action is needed.
3. **W12 Production deploy** — gates UAT with real staff and any go-live timeline.
4. **W18 Royalty payment** — gates revenue collection; finance team can't operate without it.
5. **W30 Security hardening** — gates go-live (Art. 50 lifting). No reasonable agency will go live without a clean pen-test.

---

## Effort vs calendar

| | Effort (dev-days) | Calendar (5d/wk × 1 lead dev) | Calendar (5d/wk × 2 devs) |
|---|---|---|---|
| Phase 0 | 12 | 2.4 weeks | 1.2 weeks |
| Phase 1 (incl. W2 deferred) | 60 | 12 weeks | 6 weeks |
| Phase 1 (excl. W2 deferred) | 53 | 10.6 weeks | 5.3 weeks |
| Phase 2 | 60 | 12 weeks | 6 weeks |
| Phase 3 | 45 | 9 weeks | 4.5 weeks |
| **Total (excl. deferred)** | **170 dev-days** | **34 weeks** | **17 weeks** |

Calendar assumes no holidays, no major scope changes, no integration delays. Add 20 % buffer (≈7 weeks for a 1-dev plan, ≈3 weeks for a 2-dev plan) for realistic estimation.

---

*Last updated: 2026-05-17 · v1*
