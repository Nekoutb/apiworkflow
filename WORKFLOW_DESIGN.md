# API Cameroon — Internal Workflow for Investment Approvals
**Design document v1 — based on Ordonnance n° 2025/002 du 18 juillet 2025**

> Audience: API leadership, IT delivery team, legal/process owners.
> Scope: an internal, web-based workflow that lets the **Guichet Unique** and **Comité d'audit et de recours** process investor files end-to-end — from intake through the convention, installation and exploitation phases, controls, sanctions and appeals — within the statutory deadlines.

---

## 1. Executive summary

The new investment ordinance moves Cameroon's investment-incentives regime onto a **statutory 10-business-day instruction SLA** at the Guichet Unique, requires **mandatory joint opinions of tax and customs administrations** on most decisions, and creates an **independent Comité d'audit et de recours** for post-award control and appeals. None of this can be operated reliably on paper. The workflow described here translates the ordinance into a state machine, a role-and-permission matrix, and a screen inventory that fits a single internal web application, with a thin investor-facing portal for filing dossiers and tracking status.

Headline design choices:

1. **Single dossier object**, multiple lifecycles (application → installation → exploitation → audit → sanctions/recourse), with every transition signed and time-stamped.
2. **Statutory SLA clock visible on every screen**, with automatic escalation when a deadline is at risk.
3. **Mandatory opinions are first-class objects** (Avis), not free-text comments — a missing tax opinion blocks the convention signature, by design.
4. **Bilingual FR/EN** as a foundational requirement (Art. 52 — publication in French and English).
5. **Audit trail by default** — append-only, exportable, sufficient to satisfy the Comité, Cour des Comptes, and donor reviews.
6. **Transitional mode** (Art. 50) — the same workflow runs in a degraded shape during the period the Guichet Unique and Comité are being stood up, so the system can go live before all institutional pieces are in place.

---

## 2. Sources and scope

| | |
|---|---|
| Primary text | Ordonnance n° 2025/002 du 18 juillet 2025 fixant les incitations à l'investissement en République du Cameroun |
| Related laws (referenced) | Loi 2013/011 (zones économiques); Loi 2023/008 (PPP); Loi 2018/011 (transparence finances publiques); Loi 2018/012 (régime financier de l'État); Loi de finances 2024/013; abrogated: Loi 2008/009 and Loi 2013/004 (modified 2017/015) |
| In scope | Régime commun (convention d'investissement) for new and extension projects; ZDP overlay; transitional regime under Art. 47 |
| Out of scope of *this* workflow (but must interoperate) | ZES procedures (separate texts); PPP contracts (Loi 2023/008); upstream oil / mining / gas / commerce-distribution (excluded from the ordinance by Art. 3.2) |
| Internal users | API DG, Guichet Unique officers, tax representative, customs representative, technical-administration representatives, Comité d'audit members, Comité secretariat, Unité technique investigators |
| External users | Investors (applicants), their representatives, technical administrations consulted on dossiers |

---

## 3. Approval regimes — inventory and decision points

Each regime is a distinct lifecycle in the system, but they share entities and reusable steps.

### 3.1 Régime commun — Convention d'investissement (main flow)

**Eligibility gate** (Art. 6 common + Arts. 7 or 8 specific). The system enforces the gate at intake — the investor cannot finalize submission until the dossier carries:
- An activity authorization in one of the Art. 3 sectors
- Plan de compétences locales, transfert de technologies, plan de recrutement Camerounais, plan de sous-traitance locale
- Proof of financing (capacity certificate / loan contract / intent letter / fundraising proof / other)
- For new projects: declaration of which 2-of-5 Art. 7 criteria the project meets, with numeric targets
- For extensions: declaration of the 20% production increase + 1 of 3 Art. 8 conditions

**Category routing** is automatic, based on declared investment amount:
- Cat A: < 1 B FCFA — incentives per Art. 11.1
- Cat B: 1–5 B FCFA — Art. 11.2
- Cat C: > 5 B FCFA — Art. 11.3
The system applies the +5-point uplift if the dossier declares implantation in a ZDP (Art. 12).

### 3.2 Régime des zones économiques (Arts. 14–15)
External procedure. The workflow does **not** instruct these dossiers but **must register** the resulting agréments to apply Arts. 14–15 uplifts and to feed the API's overall investment register. Build an "import / register" path, not a full instruction path.

### 3.3 Régime des PPP (Arts. 16–18; Loi 2023/008)
Same as above. Register externally signed PPP contracts; carry their fiscal incentives in the dossier object so that customs validation, monitoring and annual reporting work the same way.

### 3.4 Régime ZDP overlay (Art. 12)
Not a separate dossier — a checkbox + locality field on the régime commun dossier. The list of ZDPs is loaded from the regulatory text that fixes them (Art. 5 closing paragraph). The system stores the ZDP list as configurable reference data.

### 3.5 Régime transitoire (Art. 47)
Distinct dossier type: "Migration de régime antérieur". Requires a **prior audit** by competent administrations before admission. The system models the audit as a prerequisite step, not as part of the standard 10-business-day clock.

---

## 4. Statutory deadlines — the SLA engine

The workflow keeps every clock the ordinance defines, displays them on every screen, and triggers automatic notifications and escalations.

| # | Trigger | Clock | Owner | Article |
|---|---|---|---|---|
| 1 | Récépissé de dépôt issued | **10 business days** to complete instruction and sign convention | Guichet Unique | 30.3 |
| 2 | Convention signed | **10 business days** for investor to produce equipment list | Investor | 33.3 |
| 3 | Start of fiscal year | **3 months** to file annual report (hard 31 March) | Investor | 32.1 |
| 4 | Annual report late or missing | **1 M FCFA / month** fine accrues | System computes; API issues | 32.3 |
| 5 | Agreement date | **5 years** installation phase ceiling | Investor | 10 |
| 6 | End of installation | **5 years** exploitation phase ceiling (7 in ZES) | Investor | 11, 15 |
| 7 | Force majeure / economic difficulty | **Max 2 years** extension grantable, non-renewable | API DG on Avis | 36.3 |
| 8 | Saisine of Comité d'audit | **30 days** amicable procedure | Comité | 40.2 |
| 9 | Procès-verbal of alleged breach | **10 days** investor response | Investor | 41.2 |
| 10 | Investor response | **10 days** admin final-position notification | Tax/Customs | 41.2 |
| 11 | Mise en demeure | **15 days** before sanctions apply | Investor | 42.1 |
| 12 | Sanction = suspension | **6 months max** | API | 41.3 |

**SLA mechanics in the system:**
- Each clock is an object with start, target, business-day vs calendar-day flag, and current state (green / amber / red).
- "Business day" calendar is configurable — public holidays in Cameroon, weekly closures.
- Amber threshold = 60% elapsed. Red = 80%. Breach = 100%.
- Escalation: at amber → notify owning officer. At red → notify owner + supervisor. At breach → notify DG + log on dashboard.
- Pauses: where the ordinance permits (force majeure under Art. 36, prior-audit requirement under Art. 47), the clock can be paused with a documented justification carrying the relevant Avis.

---

## 5. Roles and permission matrix

| Role | Read | Comment | Create | Submit Avis | Sign | Override SLA |
|---|---|---|---|---|---|---|
| Investor (external) | own dossier | own dossier | own dossier | — | own response | — |
| Réceptionniste GU | all dossiers | yes | récépissé | — | récépissé | — |
| Instructeur GU | assigned | yes | drafts | — | — | — |
| Chef GU | all dossiers | yes | drafts | — | proposes to DG | request only |
| Représentant fiscal in GU | all dossiers | yes | — | avis obligatoire | own avis | — |
| Représentant douanier in GU | all dossiers | yes | — | avis obligatoire | own avis | — |
| Représentant administration technique | by sector | yes | — | avis technique | own avis | — |
| Directeur Général API | all | yes | — | — | convention, attestations, extensions | yes |
| Secrétariat Comité | Comité dossiers | yes | sessions, PV | — | PV | — |
| Membre Comité | Comité dossiers | yes | — | délibération | délibération | — |
| Unité technique investigator | assigned audits | yes | rapports | — | rapport | — |
| Auditor / read-only | all | — | — | — | — | — |
| Admin (system) | all | — | reference data | — | — | — |

Two principles:
- **No officer can sign their own Avis line and also countersign the convention.** Separation of duties is hard-enforced.
- **Read access is broad; write access is narrow.** Cameroon's transparency law (Loi 2018/011) and the Comité's a-posteriori control (Art. 39) require broad readability for oversight.

---

## 6. Process maps (state machines)

The system maintains five interlocking lifecycles per dossier. Each is a finite state machine with explicit transitions, owners, and outputs.

### 6.1 Lifecycle A — Application & Convention (Arts. 6–8, 30–31)

```
[DRAFT (investor)]
    │ investor submits
    ▼
[SUBMITTED]
    │ GU réceptionniste verifies completeness
    ├─ incomplete ──▶ [RETURNED_FOR_COMPLETION] ──▶ back to DRAFT
    ▼ complete
[RECEIPT_ISSUED]  ◀── starts 10-business-day clock (Art. 30.3)
    │ assignment to instructeur
    ▼
[UNDER_INSTRUCTION]
    │ instructeur drafts evaluation + draft convention
    ├─ request additional info ──▶ [PENDING_INVESTOR_INFO] (clock pauses if explicitly granted)
    │
    │ in parallel: request Avis from tax, customs, technical admins
    ▼
[PENDING_OPINIONS]
    │ tax avis received ──┐
    │ customs avis received ─┤── all mandatory avis present ──▶
    │ technical avis received┘
    ▼
[CONVENTION_DRAFTED]
    │ Chef GU reviews and proposes to DG
    ▼
[PENDING_DG_SIGNATURE]
    │ DG signs / declines
    ├─ declines ──▶ [REJECTED] (notify investor, reasoned decision, recourse window opens)
    ▼ signs
[CONVENTION_SIGNED]  ◀── triggers Lifecycle B
```

**Decision rules baked into transitions:**
- Move to `CONVENTION_DRAFTED` is blocked unless both `Avis fiscal` and `Avis douanier` are present (Art. 30.5).
- DG signature emits the **acte d'agrément** with a unique reference number (year + sequence) and applies the correct category fiscal-customs profile (A / B / C, with ZDP uplift if applicable).
- Rejection requires a written reason citing which Art. 6 / 7 / 8 criterion failed.
- Once signed, the convention is immutable except by a documented amendment process (separate sub-flow, not by editing).

### 6.2 Lifecycle B — Installation phase (Arts. 10, 33, 34)

```
[CONVENTION_SIGNED]
    │ system starts 10-bd clock for equipment list (Art. 33.3)
    ▼
[EQUIPMENT_LIST_PENDING]
    │ investor uploads list
    ▼
[EQUIPMENT_LIST_UNDER_REVIEW]
    │ joint review API + customs avis obligatoire (Art. 33.1)
    ├─ rejected ──▶ [LIST_RETURNED] (with reasons; clock resumes)
    ▼ validated
[EQUIPMENT_LIST_VALIDATED] ──▶ customs profile activated for actual imports
    │
    │ throughout installation: import declarations are checked against the validated list
    │ (integration with customs system — see §10)
    │
    │ investor can request:
    ├─ Autorisation provisoire d'exploitation (Art. 34.2) ──▶ partial transition to Lifecycle C
    ├─ Attestation de réalisation (Art. 34.1) ──▶ full transition to Lifecycle C
    ▼
[VISIT_REQUESTED]
    │ joint appreciation visit scheduled (API + tax + customs + others)
    ▼
[VISIT_REPORT_DRAFTED]
    ▼
[ATTESTATION_ISSUED] or [PROV_AUTHORIZATION_ISSUED]
    ▼
(Lifecycle C begins / partial)
```

**Five-year cap** (Art. 10) is enforced as a hard SLA: at month 54, an alert fires; at month 60, the installation regime is automatically closed and exploitation regime is activated by default, unless an Art. 36 extension is recorded.

### 6.3 Lifecycle C — Exploitation phase (Art. 11, 32)

```
[EXPLOITATION_ACTIVE]
    │ system emits an annual obligation each fiscal year
    ▼
[ANNUAL_REPORT_DUE]  ◀── clock: 3 months from FY start, hard 31 March (Art. 32)
    │
    ├─ filed on time ──▶ [ANNUAL_REPORT_RECEIVED] ──▶ triggers a routine control (Lifecycle D)
    └─ not filed by 31 March
            ▼
        [ANNUAL_REPORT_LATE] ──▶ fine accrues at 1 M FCFA / month
            │ when filed
            ▼
        [ANNUAL_REPORT_RECEIVED_LATE] (fine recorded as receivable)
```

The 5-year exploitation cap (7 years for ZES, Art. 15) is enforced the same way as the installation cap.

### 6.4 Lifecycle D — Control & audit (Arts. 36–39)

Two triggers create an audit case: (a) annual report received (routine evaluation), (b) ad-hoc instruction by Comité d'audit or DG.

```
[AUDIT_CASE_OPENED]
    │ Unité technique assigned
    ▼
[INVESTIGATION_ACTIVE]
    │ pieces gathered: conformity, commitments, justificatifs, financing, jobs
    ▼
[FINDINGS_DRAFTED]
    ├─ conform ──▶ [CASE_CLOSED_CONFORM]
    └─ non-conform ──▶ [FINDINGS_NEGATIVE] ──▶ Lifecycle E
```

The Comité's standing power to revise GU agréments (Art. 39.2) is modelled as a separate "REVISION" case: a Comité-initiated audit that can result in a revised agrément or denunciation.

### 6.5 Lifecycle E — Sanctions and recourse (Arts. 40–43)

```
[FINDINGS_NEGATIVE]
    │ procès-verbal issued
    ▼
[PV_ISSUED]  ◀── investor 10-day response clock (Art. 41.2)
    │
    │ investor responds or doesn't
    ▼
[PV_RESPONSE_RECEIVED]  ◀── admin 10-day final-position clock (Art. 41.2)
    │
    │ tax/customs notify final position; one of:
    ├─ [ABANDONED]
    ├─ [FINE_PROPOSED] ──▶ sanction track
    ├─ [SUSPENSION_PROPOSED] (max 6 months)
    └─ [WITHDRAWAL_PROPOSED]
            │
            ▼
    [MISE_EN_DEMEURE_ISSUED]  ◀── 15-day clock (Art. 42)
            │
            │ if no satisfaction
            ▼
    [SANCTION_APPLIED]
        ├─ fine: 10 / 15 / 25 M FCFA per Art. 41.3
        ├─ suspension recorded
        └─ withdrawal triggers tax/customs recovery proceedings
```

**Recourse path (parallel, investor-initiated, Art. 40):**
```
investor disputes a decision
    ▼
[RECOURS_FILED]  ◀── saisine du Comité d'audit
    │ 30-day amicable procedure clock starts (Art. 40.2)
    ▼
[AMIABLE_PROCEDURE]
    ├─ resolved ──▶ [RECOURS_CLOSED_AMIABLE]
    └─ not resolved by D+30 ──▶ [RECOURS_ESCALATED] (jurisdictions / arbitration)
```

ZES and PPP holders are routed away from this recourse path per Art. 40.1 — the system marks their dossiers so the recourse intake form refuses to open a Comité case for them.

---

## 7. Data model (entities and key fields)

Minimal viable model — keys, references, and the few fields that matter for the workflow logic.

**Investor** — `id`, `raison_sociale`, `niu`, `legal_form`, `country_of_origin`, `is_resident`, `representative_contact`, `aml_kyc_status` (Art. 49), `created_at`.

**Project (Dossier)** — `id`, `dossier_no` (year+sequence), `investor_id`, `regime` (commun | ZES | PPP | ZDP_overlay | transitional), `type` (new | extension | migration), `sector` (Art. 3 enum), `is_zdp` (bool), `zdp_locality_id` (nullable), `category` (A | B | C; derived from `investment_amount_fcfa`), `investment_amount_fcfa`, `installation_phase_months`, `state` (state-machine enum), `current_owner_user_id`, `submitted_at`, `recepisse_at`, `convention_signed_at`, `installation_end_target`, `exploitation_end_target`.

**EligibilityClaim** — `project_id`, `criterion_code` (e.g. `art7_jobs`, `art7_local_inputs`, `art8_production_20pct`), `declared_value`, `documentation_ref`. The instructor verifies; the auditor revisits in Lifecycle D.

**Document** — `id`, `project_id`, `kind` (recruitment_plan | financing_proof | activity_authorization | etc.), `mime`, `storage_uri`, `uploaded_by`, `uploaded_at`, `sha256`.

**Avis** — `id`, `project_id`, `phase` (convention | equipment_list | extension_request | etc.), `admin_code` (tax | customs | technical_<sector>), `position` (favorable | favorable_with_reserve | unfavorable), `reasoning_text`, `signer_user_id`, `signed_at`. **Constraint:** for a `convention` phase, the project cannot transition to `CONVENTION_SIGNED` unless at least one `Avis` of admin_code=`tax` and one of `customs` exist with a positive position.

**Convention** — `id`, `project_id`, `agrement_no`, `signed_at`, `dg_user_id`, `clauses_json` (the 12 clauses of Art. 31 — raison sociale, NIU, objet, durée installation, durée exploitation, avantages consentis, engagements, liste équipements, contrôle, sanctions, etc.), `pdf_uri`.

**EquipmentList** — `id`, `project_id`, `phase` (installation | exploitation), `items` (qty, HS code, description, unit value), `validated_at`, `validated_by_user_id`, `customs_avis_id`.

**AnnualReport** — `id`, `project_id`, `fiscal_year`, `submitted_at`, `is_late`, `late_months`, `fine_accrued_fcfa`, `content_json`, `attached_docs`.

**AuditCase** — `id`, `project_id`, `trigger` (annual_report | comite_initiative | dg_request), `investigator_user_ids[]`, `started_at`, `findings_json`, `outcome` (conform | non_conform), `report_uri`.

**Sanction** — `id`, `project_id`, `audit_case_id`, `kind` (abandon | fine | suspension | withdrawal), `amount_fcfa` (nullable), `start_date`, `end_date` (nullable for fine/withdrawal), `pv_uri`, `mise_en_demeure_at`, `applied_at`.

**Recours** — `id`, `project_id`, `filed_by_user_id`, `filed_at`, `subject_decision_id`, `comite_session_id`, `state`, `outcome`.

**SLAClock** — `id`, `subject_type`, `subject_id`, `kind`, `started_at`, `target_at`, `paused_intervals[]`, `state` (green | amber | red | breached | satisfied).

**AuditTrailEntry** — `id`, `actor_user_id`, `entity_type`, `entity_id`, `action`, `before_snapshot`, `after_snapshot`, `timestamp`, `ip`, `user_agent`. Append-only; SHA-256-chained for tamper evidence.

**ReferenceData** — sectors (Art. 3), ZDP localities, business-day calendar (holidays), customs HS codes, currency fixing, fee schedules, fine schedule.

---

## 8. Screen inventory (web application)

Two surfaces: an internal back-office for API/GU/Comité users, and an external investor portal. Both authenticated; SSO with the existing API directory if available, otherwise email-password + TOTP.

### 8.1 Investor portal (external)

| Screen | Purpose |
|---|---|
| Login + account | Onboarding, KYC capture (Art. 49 AML) |
| Dashboard | List of my dossiers with state + next action |
| New dossier wizard | Sector, project type, amount, criteria declaration, ZDP toggle, document uploads. Saves as DRAFT; submits when complete. |
| Dossier detail | Full status, SLA clock, history, downloads (récépissé, convention PDF, attestations) |
| Equipment list submission | After convention is signed; uploads structured list |
| Annual report | Yearly form opens on FY start; remembers prior submissions |
| Pay redevance | 0.1% annual royalty (Art. 48); shows due amount, payment instructions |
| Notifications | Inbox; mirrors emails; recourse responses appear here |
| Recourse | File a recourse against a decision; visible only if eligible (not ZES / PPP) |

### 8.2 Back-office (internal)

| Screen | Purpose |
|---|---|
| Global dashboard | Open dossiers by state, SLA-at-risk list, monthly volumes, late annual reports, pending Avis, active sanctions |
| Réception (GU) | Inbox of newly submitted dossiers; one-click récépissé issuance with completeness checklist |
| Instruction | Assigned dossiers, draft convention editor based on Art. 31 clauses template, integrated Avis requests, comments |
| My Avis queue (tax / customs / technique) | Dossiers awaiting my opinion; structured form (position + reasoning + supporting cite) |
| DG signature queue | Dossiers ready to sign, with full record visible, audit trail |
| Equipment list review | Joint review pane for API + customs |
| Visit scheduler | Joint appreciation visits for attestations / autorisations provisoires |
| Annual reports console | All filings, fines accrued, follow-ups |
| Audit & control workbench | Open audit cases, evidence collection, rapport editor |
| Sanctions console | Open procedures, deadlines, mise-en-demeure issuance, payment tracking |
| Comité d'audit sessions | Agenda, dossier packets, PV (procès-verbal) editor, decisions register |
| Recours register | Active recourses, 30-day timers, resolution outcomes |
| Reference data admin | Sectors, ZDP, holidays, HS codes, fee schedules, users, roles |
| Audit trail explorer | Search any entity's history; export for Cour des Comptes / donors |
| Reports | Statutory and management reports (counts, durations, sectoral mix, regional mix, fine receipts, redevance receipts) |

### 8.3 Cross-cutting UX rules

- **Every dossier screen carries an SLA pill** (green / amber / red) showing remaining business days.
- **Bilingual** — every label has FR and EN; investors and officers can switch languages per session; legal documents are issued in both languages where the ordinance requires it (Art. 52).
- **Mobile-first for investors**, desktop-first for officers. Officer screens are dense by design; investor screens are guided.
- **No silent edits** — every change captures a reason field above a configurable size; every save creates an audit-trail entry.
- **Signatures** — DG signature is an explicit two-factor confirmation; the signed PDF is the legal artifact and is hashed + timestamped.

---

## 9. Notifications and escalation

- Channels: email, in-app, optional SMS for critical events (deadlines, signatures, sanctions).
- Templates: stored in the system, editable by Comms; bilingual; carry the dossier number and a deep link.
- Trigger families:
  - SLA amber/red/breach
  - State transitions visible to investor (récépissé, signature, attestations, sanctions)
  - Avis requested / Avis received
  - Annual report due / late
  - Mise en demeure issued / response received
  - Recourse filed / amicable expired
  - Convention coming up on installation-phase ceiling (month 54)

---

## 10. Technical architecture (recommendation)

**Constraints to design for:**
- Cameroonian connectivity is uneven outside Yaoundé/Douala — design for low-bandwidth, offline-tolerant data entry where possible.
- Bilingual everywhere.
- Public sector typically prefers on-prem or sovereign cloud (data residency).
- Long-lived dossiers (10+ years) — durable storage, schema evolution friendly.
- Mandatory paper artifacts (signed conventions, PVs) — robust PDF generation and storage.

**Suggested stack:**

| Layer | Recommendation | Why |
|---|---|---|
| Web app | Server-rendered (e.g. Django, Laravel, or .NET) with progressive enhancement | Forms-heavy, low JS payloads, easy printing |
| DB | PostgreSQL with row-level audit + jsonb for variable structures | Schema rigour for legal data, flexibility for clauses_json |
| Object storage | S3-compatible (MinIO if on-prem) | Documents, generated PDFs |
| Search | Postgres full-text first; ElasticSearch only if volume justifies | Avoid premature complexity |
| PDF generation | wkhtmltopdf or WeasyPrint with FR/EN templates | Conventions, attestations, PV, mise en demeure |
| Identity | OIDC; fallback email+TOTP | API directory if available; investors via portal |
| Hosting | Sovereign cloud (e.g. CAMTEL, ANTIC) or on-prem with offsite DR | Data residency, political acceptability |
| Backup | Daily encrypted snapshots, monthly off-site | 10-year retention requirement on dossiers |
| Observability | Standard logging + metrics; alert on SLA breach rate | Operations |
| Email/SMS | Local SMTP relay; SMS via local aggregator | Reliability over fanciness |

**Two services, not one:** the **investor portal** and the **back-office** share the database and identity, but are deployed as separate web apps. This lets you put a stricter WAF and rate-limiter in front of the portal without burdening internal users, and lets you take the portal down for maintenance without disrupting officers.

---

## 11. Integrations (to plan for, but not necessarily build day 1)

| Integration | Why | Phase |
|---|---|---|
| Customs (CAMCIS / SYDONIA) | Validate import declarations against the validated equipment list (Art. 33) | Phase 2 |
| Tax (DGI) | Push the convention's fiscal profile so DGI applies the right exonerations automatically; pull eligibility data from prior filings | Phase 2 |
| RCCM (Centre de Formalités de Création d'Entreprises) | Verify NIU and legal existence at intake | Phase 1 |
| GUCE (Guichet Unique des Opérations du Commerce Extérieur) | Customs operations | Phase 2 |
| ANTIC PKI | Qualified electronic signatures for DG / Comité PV | Phase 2 |
| Cour des Comptes / Inspection d'État | Export audit trail on demand | Phase 1 |
| Public open-data publication | A redacted public register of agréments | Phase 3 |

All integrations are designed as adapters behind a clear interface, so phase-1 ships without them but does not preclude them.

---

## 12. Implementation roadmap

**Phase 0 — Foundations (4–6 weeks)**
- Stakeholder validation of this design with API DG, Comité chair, tax and customs liaisons.
- Confirm the regulatory text fixing dossier composition (Art. 30.2) — that text drives the intake form.
- Confirm the ZDP list (Art. 5 final paragraph) — fixed by réglement.
- Decide hosting (sovereign cloud vs on-prem), identity (API directory vs standalone), and FR/EN translation pipeline.

**Phase 1 — Core workflow (10–12 weeks)**
- Investor portal: account, new dossier wizard, dashboard, document upload.
- Back-office: réception, instruction, Avis, DG signature, convention PDF generation.
- SLA engine with the 10-business-day instruction clock.
- Audit trail.
- Reference data console.
- Notifications: email + in-app.
- Go-live in transitional mode (Art. 50) — even before Comité d'audit is constituted.

**Phase 2 — Lifecycle extension (8–10 weeks)**
- Equipment list flow with customs Avis.
- Installation-phase tracking and attestations / autorisations provisoires.
- Annual reporting + fines.
- Audit case workbench for the Unité technique.
- Sanctions and mise-en-demeure procedure.
- Recourse register with 30-day amicable clock.
- Integrations with RCCM, customs, tax (read-only first).

**Phase 3 — Maturity (6–8 weeks)**
- Public register (read-only) of agréments.
- Comité d'audit session console.
- Advanced analytics for management.
- ANTIC PKI signatures.
- Mobile-friendly investor portal hardening.

**Cumulative duration:** 28–36 weeks from kickoff for a complete v1.

---

## 13. Open questions for API leadership

Before finalising the build, the following answers will shape several decisions:

1. **Dossier composition** — Art. 30.2 says the dossier composition is fixed by a specific text from the API. Does that text exist already, or do we draft it together?
2. **ZDP list** — Where is the réglement fixing the ZDPs? Is the list final or to-be-published?
3. **Volume** — Roughly how many dossiers per year does the API expect under this regime? (Drives capacity assumptions, not core design.)
4. **Existing IT** — Does the API have an existing applicant database, document store, or signature platform that this system should integrate with or replace?
5. **Identity** — Is there an API SSO / Active Directory we should plug into? Are external investors required to authenticate via a national identity scheme?
6. **Customs / tax interoperability** — Is there a political signal to integrate with CAMCIS and the DGI Mediator API, or should we treat them as out-of-system for phase 1?
7. **Languages** — Do you want FR-only at launch with EN added in phase 2, or bilingual from day one?
8. **Hosting** — Sovereign cloud, on-prem at API, or international cloud? This is largely a procurement / political question.
9. **Comité d'audit** — Is the Comité d'audit et de recours already constituted? If not, when is it expected to be operational? (Determines how long the system runs in transitional mode under Art. 50.)
10. **Migration** — Are there active dossiers under the abrogated Loi 2013/004 / 2017/015 that need to be migrated into this system, or is this a green-field deployment starting from the ordinance's effective date?

A two-hour workshop with API leadership and the tax/customs liaisons would resolve most of the above and unlock the Phase-1 build plan.

---

*End of v1 design. Revisions will be marked with a changelog at the top of the next version.*
