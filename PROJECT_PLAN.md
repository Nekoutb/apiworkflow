# API Cameroun — Investment Incentives Portal
## Project Plan v2 — DECISIONS LOCKED, ready for Phase 0 build

> **Status:** Foundation decisions locked. Cleared to start Phase 0.
> **Date:** 2026-05-13.
> **Audience:** API DG, Chef du Guichet Unique, IT lead, project sponsor.
> **Reading time:** ~15 min.

---

## 🔒 Decisions locked (v2)

The four foundation decisions in §9 and the open assumptions in §10 are resolved as follows. These are the choices most likely to produce a system that *works well in the hands of real users* — speed, reliability, and maintainability optimised over political symbolism (we can migrate later for sovereignty without re-architecting).

| Decision | Locked choice | Reasoning |
|---|---|---|
| **Hosting** | **AWS eu-west-3 (Paris)** for MVP through Phase 2. Migration path to sovereign cloud (CAMTEL/ANTIC) documented and scheduled for Phase 3 *if* regulatory requirements demand it. | Lowest latency from Cameroon among hyperscalers, 99.99 % SLA, full set of managed services (RDS Postgres, S3, SES, Secrets Manager), no operational burden on API IT during build. Sovereign cloud maturity in 2026 doesn't yet match AWS for the managed services we need; we keep the option open for Phase 3. |
| **Identity for staff** | **Standalone account + mandatory 2FA (TOTP)**, with OIDC adapter built in from day one so plugging into an API Active Directory later is a configuration change, not a refactor. | Doesn't depend on the API's directory being ready, secure today, future-proof. |
| **Identity for investors** | **Email + password + 2FA (TOTP)**, plus optional Google / Microsoft OAuth for convenience. | Lowest friction for foreign investors, no national-ID dependency, 2FA mandatory for legal-stakes account. |
| **Domain naming** | **`api.cm` subdomains** (assumed available — to verify at Phase 0 kickoff): `investir.api.cm` for the external portal, `workflow.api.cm` for the internal portal, `public.api.cm` for the public agrément register (Phase 3). Fallback if `api.cm` is unavailable: `apicameroun.cm`. | Matches the agency's brand, separates external from internal surface, gives each surface its own WAF policy. |
| **Disaster recovery** | **Daily encrypted snapshots + weekly off-site copy** for MVP and Phase 2. Quarterly restore tests. **Hot standby in a second AWS region (Frankfurt)** added in Phase 3 with RPO ≤ 15 min / RTO ≤ 1 hr. | Pragmatic for MVP volumes, full DR before high-stakes scale. |
| **Workshop with stakeholders** | **Deferred — not required to start Phase 0.** Scope will be validated during Phase 1 UAT with real API staff on real test dossiers. The plan's assumptions (§10) are based on the ordinance text. The workshop happens as part of Phase 1 acceptance, not as a Phase 0 prerequisite. | Avoids blocking the build on calendar-coordination; the ordinance text is authoritative enough to start. Any divergence surfaces in UAT and adjusts the build by one sprint. |
| **Data sovereignty** | All personal data of Cameroonian citizens stored in EU region (Paris); data classified as "highly sensitive" (audit trails, signed conventions) additionally backed up to an off-site location within the EU. Documented compliance with Loi 2010/012. | Best privacy posture available today; migration to CAMTEL in Phase 3 if needed. |
| **Domain for the *demo* (this repo)** | Stays at `lavender-ram-492325.hostingersite.com/demo/` until the real `api.cm` domain is acquired. The demo is for stakeholder review, not for production traffic. | No further work on the demo URL itself — energy goes into the real build. |

**What this unlocks:** I can begin Phase 0 technical scaffolding (Next.js 15 + TypeScript + PostgreSQL + Prisma + Auth.js skeleton, AWS Paris CI/CD pipeline, design system) **immediately**. No further blocking decisions remain on my side. The build proceeds on the assumptions in §10; any incorrect assumption costs ~1 sprint to correct during UAT.

---

---

## 1. The two problems we are solving

The application has **one job**: turn the paper-based incentive-approval process under Ordonnance n° 2025/002 into a single online system that simultaneously serves investors and the API.

1. **Investor-facing problem.** A potential investor (Cameroonian or foreign) can today only deposit an incentive-request dossier physically. We need them to be able to file the dossier online (the 6 mandatory pieces under Art. 6), be told what stage their file is at, and see decisions and messages from the API — without phoning.
2. **Agency-facing problem.** The API today has no operational tool to route a dossier across the 6 administrative stages required by the ordinance (Réception → Instruction → Avis fiscal → Avis douanier → Synthèse Chef GU → Signature DG), keep the 10-business-day statutory clock, and prove to the Comité d'audit and the Cour des Comptes how each decision was made. We need a workflow engine the staff actually use, with role-based screens, a full audit trail, and SLA enforcement.

If the application solves these two cleanly, every other feature (annual reports, controls, sanctions, recourse, ZES/PPP interop) is an extension of the same skeleton.

---

## 2. Users and what they need

### 2.1 Investor (external)
A natural or legal person filing for incentives. The portal must give them:
- A secure account (email + password, plus optional KYC/AML check per Art. 49).
- A guided wizard to create a request: declare sector, project type (new / extension), amount, ZDP locality, Art. 7 or Art. 8 eligibility criteria, and the 6 mandatory documents.
- Document upload per piece, each tracked individually (accepted / pending / rejected with reason).
- A clear status dashboard: which of the 6 stages the file is at, who currently has it, statutory SLA countdown, expected next step.
- Messaging from the API (decisions, requests for additional documents).
- Downloads: récépissé de dépôt, signed convention, acte d'agrément once issued.
- Annual reporting (Art. 32) after agreement.
- Annual royalty payment (Art. 48, 0.1 % capped at 5 M FCFA).
- FR / EN toggle throughout.

### 2.2 API staff (internal) — by role
Each role sees only what concerns them. Six roles map to the six workflow stages (full role/permission matrix is in `WORKFLOW_DESIGN.md`):

| Stage | Role | Responsibility |
|---|---|---|
| 1 | Réceptionniste (Guichet Unique) | Receive the dossier, verify the 6 scanned pieces, issue the récépissé de dépôt |
| 2 | Instructeur (Service Technique) | Technical review, eligibility check, draft technical opinion |
| 3 | Représentant fiscal (DGI) | Issue mandatory tax opinion (avis obligatoire — Art. 30.5) |
| 4 | Représentant douanier (DGD) | Issue mandatory customs opinion (avis obligatoire) |
| 5 | Chef du Guichet Unique | Synthesise, arbitrate if any avis is unfavourable, transmit to DG |
| 6 | Directeur Général | Sign the investment convention and issue the acte d'agrément |

Other roles outside the 6 sequential stages:
- **Comité d'audit et de recours** (Art. 39) — independent body, audits past decisions and handles investor recourses.
- **Unité technique du Comité** — investigators carrying out controls.
- **Auditor / read-only** — read-everything access for oversight (Cour des Comptes, donors).
- **System admin** — manages reference data (sectors, ZDPs, holidays, fees, users).

### 2.3 Hard rule across all users
**Separation of duties is enforced.** No officer can sign their own avis and also countersign the convention. Every state transition is signed and timestamped. The audit trail is append-only and SHA-256-chained.

---

## 3. Interface structure

Two surfaces. They share a database and identity, but they are deployed as **two separate web applications** behind two distinct URLs. This lets us put strict rate limiting and a WAF in front of the investor-facing one without burdening internal users, and lets us take the public portal down for maintenance independently.

### 3.1 Investor portal (external)
URL: `https://investir.api.cm` (working title)

```
┌────────────────────────────────────────────────────────────┐
│  Public landing page    │  About the law │  Sector pages   │ ← marketing
├────────────────────────────────────────────────────────────┤
│  Sign up / Sign in / Password reset                        │ ← auth
├────────────────────────────────────────────────────────────┤
│  My dashboard                                              │
│  ├ My requests                                             │
│  ├ Document uploads (the 6 mandatory pieces)               │
│  ├ Status tracker                                          │
│  ├ Messages                                                │
│  ├ Annual reports                                          │
│  ├ Royalty payment                                         │
│  └ Account & profile                                       │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Internal portal (staff)
URL: `https://workflow.api.cm` (working title)

```
┌────────────────────────────────────────────────────────────┐
│  Sign in (SSO if API has Active Directory, else email+TOTP)│
├────────────────────────────────────────────────────────────┤
│  Dashboard (role-aware)                                    │
│  ├ My inbox (dossiers awaiting *my* action)                │
│  ├ All dossiers (search, filter, export)                   │
│  ├ Stage views (Réception, Instruction, Avis…)             │
│  ├ Dossier detail                                          │
│  │   ├ Investor info                                       │
│  │   ├ Documents (with verification status)                │
│  │   ├ Opinions (Avis)                                     │
│  │   ├ Equipment list                                      │
│  │   ├ Decisions & history                                 │
│  │   └ Action panel (role-specific)                        │
│  ├ Comité d'audit sessions                                 │
│  ├ Sanctions register                                      │
│  ├ Recourses register                                      │
│  ├ Reports & analytics                                     │
│  ├ Audit trail explorer                                    │
│  └ Reference data (sectors, ZDPs, holidays, users)         │
└────────────────────────────────────────────────────────────┘
```

### 3.3 The shared workflow engine
Both portals talk to the same workflow engine. The engine owns:
- The state machine (the 6-stage lifecycle + sub-flows for installation, exploitation, audit, sanctions, recourse).
- The SLA clock (business-day-aware, configurable holidays, escalations at 60 % / 80 % / breach).
- The Avis (opinion) objects — a "défavorable" avis from DGI or DGD short-circuits the linear advance and routes to Chef GU for arbitration.
- The audit trail (every transition, every read on sensitive data, append-only).

---

## 4. Workflow stages — the canonical sequential path

The standard happy path for a régime commun dossier:

```
Investor          Réception      Instruction      DGI          DGD         Chef GU      DG
   │                  │              │             │            │             │          │
   ├─[1] file dossier─►                                                                  │
   │                  ├─[2] verify scans, accept/reject each piece (Art. 6)              │
   │                  ├─[3] issue récépissé de dépôt ── starts 10-business-day clock ──► │
   │                  │              │                                                   │
   │                                 ├─[4] technical review, draft convention            │
   │                                 ├─request avis ─►                                   │
   │                                 │              ├─[5] avis fiscal ────────────►      │
   │                                 │              │             ├─[6] avis douanier ─► │
   │                                 │              │             │                     ├─
   │                                 │              │             │             ├─[7] synthèse
   │                                 │              │             │             │     ├──►
   │                                 │              │             │             │       ├─[8] sign convention
   ◄─────[9] receive convention, acte d'agrément, status updates────────────────────────┘
```

Branches:
- **Document rejected at Réception** → bounces back to investor for re-upload of that specific piece. Récépissé blocked until all 6 are accepted.
- **Avis défavorable** (DGI or DGD) → routes to Chef GU for arbitration; Chef GU can either reject the dossier with reasoned decision or escalate to Comité.
- **Return for completion** at any stage → returns to investor with reasons; clock can pause on documented justification.
- **DG declines to sign** → reasoned rejection, recourse window opens.

After signature (post-agrément):
- Investor uploads the equipment list (Art. 33, 10 business days post-signing). Customs validates.
- Annual reporting begins (Art. 32, due each FY within 3 months, hard 31 March).
- Audit & control may open cases (Art. 36–39). Sanctions and recourse have their own sub-flows.

All of this is documented in detail in `WORKFLOW_DESIGN.md` already in this repo.

---

## 5. Recommended technical stack

### 5.1 Primary recommendation

| Layer | Choice | Why |
|---|---|---|
| **Frontend + API (single app)** | **Next.js 15 (App Router) + TypeScript** | Server-rendered for accessibility and print, React for rich interactions, TypeScript catches errors early, one language (TS) end-to-end |
| **UI components** | Tailwind CSS + shadcn/ui | Accessible, customisable, modern look without writing CSS from scratch |
| **Database** | **PostgreSQL 16** | Open-source, mature, rock-solid for relational legal data |
| **ORM** | Prisma | Type-safe, schema-first, well-documented |
| **Auth** | Auth.js (NextAuth v5) + Argon2id passwords; OIDC-ready for future SSO into API's directory | Standard, flexible, integrates with any identity provider |
| **File storage** | S3-compatible (MinIO on-prem, or Cloudflare R2 / Wasabi off-prem) | Cheap, durable, simple API |
| **PDF generation** | React-PDF (server-side) | Conventions, attestations, mise en demeure, in FR and EN |
| **Email** | Resend or AWS SES | Cheap, reliable transactional email |
| **SMS (optional)** | Africa's Talking | Best local SMS aggregator in francophone Africa |
| **Search** | PostgreSQL full-text (start), Meilisearch if volume justifies | Avoid premature complexity |
| **Background jobs** | Inngest or BullMQ + Redis | SLA timers, scheduled annual-report reminders, PDF generation |
| **Observability** | Sentry + OpenTelemetry to a self-hosted Grafana | Errors, performance, audit-trail diagnostics |
| **Hosting** | Sovereign cloud (CAMTEL / ANTIC) preferred; AWS Paris (eu-west-3) or Frankfurt as fallback; on-prem at API if mandated | Data residency, latency, political acceptability |
| **CI/CD** | GitHub Actions (already in place) → SSH or container deploy | Same pattern we already use for the demo |

### 5.2 Why this stack over alternatives
- **vs. Django/Python:** Django would be slightly easier to find francophone-Africa talent for, but Next.js gives us a more polished investor experience and a single language across the codebase. If the API's IT team is Python-heavy, we should re-evaluate.
- **vs. Laravel/PHP:** Strong francophone community, but the security and modernity-of-DX gap with Next.js + TypeScript is large in 2026.
- **vs. .NET / Java:** Overkill, more expensive operationally, longer build times. Reserve for if API mandates a Microsoft-only shop.
- **vs. low-code (Airtable, Bubble, etc.):** Not suitable. Legal stakes, audit-trail requirements, sovereignty, and integration needs all rule out low-code.

### 5.3 What's non-negotiable
- TLS 1.3 everywhere, HSTS, secure cookies, CSRF protection.
- All sensitive operations behind 2FA for staff.
- Database encryption at rest.
- Audit trail signed and chained.
- Backups: daily encrypted, monthly off-site, tested restore quarterly.
- 10-year retention on dossiers, conventions, audits (legal requirement).

---

## 6. Application architecture (high-level)

```
┌────────────────────────────────────────────────────────────────┐
│                    Investor portal (Next.js)                   │
│                   https://investir.api.cm                      │
└──────────────────┬─────────────────────────────────────────────┘
                   │ HTTPS, session cookie
                   ▼
┌────────────────────────────────────────────────────────────────┐
│             Shared API layer (Next.js route handlers)          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Auth · Workflow engine · SLA timers · Audit trail     │    │
│  │  Document service · Notification service · PDF service │    │
│  └────────────────────────────────────────────────────────┘    │
└──────┬─────────────────────────────────┬───────────────────────┘
       │                                 │
       ▼                                 ▼
┌──────────────────┐         ┌──────────────────────┐
│   PostgreSQL     │         │   S3-compatible       │
│ (transactional)  │         │ (documents & PDFs)    │
└──────────────────┘         └──────────────────────┘
                   ▲
                   │ HTTPS, SSO/2FA
┌────────────────────────────────────────────────────────────────┐
│                    Internal portal (Next.js)                   │
│                   https://workflow.api.cm                      │
└────────────────────────────────────────────────────────────────┘

         External integrations (Phase 2+):
         ├─ RCCM (verify NIU and legal existence)
         ├─ CAMCIS / SYDONIA (customs equipment-list checks)
         ├─ DGI Mediator API (push fiscal profile, pull tax history)
         ├─ GUCE (Guichet Unique du Commerce Extérieur)
         └─ ANTIC PKI (qualified electronic signatures for DG / PV)
```

---

## 7. Phased execution plan

Three phases. Each phase ends with a working, deployed product on a real URL — never "all-or-nothing".

### Phase 0 — Foundations · 4 weeks
**Output:** signed-off scope, working dev/staging environments, design system.

- Stakeholder workshops (DG, Chef GU, DGI/DGD liaisons, Comité chair, IT) — 3 sessions.
- Confirm the Art. 30.2 implementing text (the official dossier composition list).
- Confirm the ZDP list (réglement under Art. 5).
- Confirm the official 6-stage map of who-does-what.
- Decide hosting (sovereign vs. cloud), identity provider, FR / EN translation workflow.
- Procurement: domain (`api.cm` or whatever the official one is), TLS cert, email/SMS providers.
- Set up GitHub, dev/staging/production environments, CI/CD.
- Design system: colour palette (Cameroon flag + neutrals), typography, components inventory.
- Repository scaffold: Next.js, Prisma, Tailwind, auth, audit trail, base layouts.

**Decision gate at end of Phase 0:** "Do we like the design system and the stack? Yes → proceed to Phase 1."

### Phase 1 — MVP: investor portal + 6-stage workflow · 12 weeks
**Output:** a real investor can file a real dossier, the 6 staff roles can move it through to a signed convention. Deployed on production.

Week-by-week (compressed):
- W1–2: Auth (investor + staff), user model, role/permission matrix, audit trail core.
- W3–4: Investor portal — sign-up, dashboard, new request wizard, document upload (the 6 mandatory pieces).
- W5–6: Staff portal — réception, document verification flow, récépissé issuance, SLA engine.
- W7–8: Instruction screen, Avis (opinion) flow, mandatory tax + customs gating (Art. 30.5).
- W9–10: Chef GU synthèse, défavorable branching, DG signature flow, acte d'agrément PDF.
- W11: Notifications (email + in-app), bilingual FR / EN, status tracking for investors.
- W12: End-to-end UAT with real API staff on real test dossiers; bug fixing; production deploy in transitional mode (Art. 50).

**Decision gate:** "Is the MVP usable in production for new dossiers under the régime commun? Yes → proceed to Phase 2."

### Phase 2 — Full lifecycle: post-agrément · 10 weeks
**Output:** equipment-list validation, annual reporting, audit & control, sanctions, recourse — i.e. everything the ordinance requires after the convention is signed.

- W1–2: Equipment-list flow (Art. 33), customs Avis on lists, customs integration scaffold.
- W3–4: Installation-phase tracking, attestation de réalisation, autorisation provisoire d'exploitation (Art. 34).
- W5–6: Annual reporting (Art. 32) with late-fine calculation; royalty payment portal (Art. 48).
- W7–8: Comité d'audit case workbench, Unité technique investigations.
- W9: Sanctions flow (mise en demeure, 10-day responses, fine schedule); recourse register with 30-day amicable clock.
- W10: Integration scaffolds (RCCM, DGI read-only); UAT; production release.

**Decision gate:** "Does the system handle the full post-agrément lifecycle? Yes → Phase 3."

### Phase 3 — Maturity & hardening · 8 weeks
**Output:** the system is fully production-grade and ready for high-stakes scrutiny.

- Public agrément register (read-only transparency portal).
- Comité d'audit session console (agenda, packets, PV editor, decisions register).
- Advanced analytics (sector mix, regional mix, SLA performance, fine receipts).
- ANTIC PKI qualified signatures for DG and Comité PVs.
- Mobile optimisation pass.
- Penetration test + remediation.
- DR/backup tested, runbooks written.
- Training materials (user guides per role, video walkthroughs).
- Production go-live (full mode, transitional mode lifted under Art. 50).

**Total elapsed time:** ~34 weeks from kickoff (about 8 months).

---

## 8. Team

For a v1 production build at this scope, a workable team is:

| Role | Allocation | Why |
|---|---|---|
| Tech lead / architect | 100 % | Owns stack decisions, code review, deployment, security |
| Full-stack developer × 2 | 100 % each | One investor-portal-leaning, one workflow-engine-leaning |
| UI/UX designer | 50 % | Design system, screens, accessibility, FR / EN review |
| Product owner / business analyst | 50 % (IPA side) | Translates legal text into specifications, signs off |
| DevOps / infrastructure | 25 % | CI/CD, hosting, monitoring, backups |
| Legal advisor | Ad-hoc | Confirms each major decision matches the ordinance |

If the API has internal IT capacity, the build can be co-developed; otherwise the external team builds and trains.

---

## 9. Hosting and security — what needs deciding

| Decision | Options | Default if you don't choose |
|---|---|---|
| Where the data lives | (a) Sovereign cloud (CAMTEL/ANTIC) ; (b) AWS Paris/Frankfurt ; (c) on-prem at API | (a) — politically safest |
| Identity for staff | (a) API Active Directory via OIDC ; (b) standalone email + 2FA | (a) if available, else (b) |
| Identity for investors | (a) standalone email + 2FA ; (b) national identity scheme if one exists | (a) |
| Domain names | (a) sub-domain of `api.cm` ; (b) dedicated `investir.cm` / similar | (a) |
| Disaster recovery | (a) hot standby in second region ; (b) daily snapshots only | (b) for MVP, (a) by Phase 3 |
| Data retention | 10 years on dossiers and conventions (legal requirement) | Non-negotiable |

---

## 10. Open assumptions for you to confirm or correct

These are things I've assumed in this plan. If any are wrong, the plan adjusts.

1. The 6 sequential stages match the official internal organisation of the Guichet Unique. (Source: Arts. 29–30 of the ordinance.)
2. The dossier composition for a new project is the 6 documents listed in Art. 6.2 + Art. 7 declarations. The exact implementing text (Art. 30.2) doesn't yet exist or hasn't been shared with me — I'll use Art. 6 as the source until the implementing text says otherwise.
3. The ZES (économic zones), PPP, and excluded sectors (Art. 3.2 — pétrolier amont, minier, gazier, commerce/distribution) are out of scope for v1.
4. The Comité d'audit et de recours and the Unité technique are within scope for Phase 3 (mature build), not MVP.
5. Annual royalty payment (Art. 48) goes through a payment provider; choice of provider (Orange Money, MTN MoMo, Visa/Mastercard via local PSP) is a Phase-2 decision.
6. There is no existing IT system at the API to migrate dossiers from — this is a green-field build. If there is, scope expands to include migration.
7. Domain `cmapi.com` is *not* the final official domain — the agency will publish on a `.cm` government-track domain. The current Hostinger setup is for demonstration purposes only.

---

## 11. What I need from you to greenlight the build

To move from this plan into a real build, three things:

1. **Validation of the plan** — your sign-off (or your correction) of sections 2 (users), 4 (workflow), 5 (stack), 7 (phases), and 10 (assumptions).
2. **The four foundation decisions** — hosting, identity, domain, and DR strategy from section 9. I can recommend, but you choose.
3. **A workshop window** — one half-day with the DG, Chef du Guichet Unique, DGI and DGD liaisons, IT, and the legal advisor, to confirm the workflow map and dossier composition. After that workshop, we lock scope and start Phase 0.

---

## 12. What stays unchanged from current work

To be clear about reuse: the **demo currently deployed** (and its design language, the workflow logic, the bilingual scaffold, the document-verification flow, the défavorable branching, the acte d'agrément layout) becomes the **basis of the design system and reference behaviour** for the real build. It is not throwaway. Nothing already done is wasted — the demo informs the build directly.

---

*End of plan v1. Revisions will be marked at the top of v2 when we update.*
