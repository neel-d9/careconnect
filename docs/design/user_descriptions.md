# User Personas & Screen Descriptions — CareConnect

**Deliverable:** Assignment 2 — Front End Design  
**Directory:** `docs/design/`  

---

## 1. Primary Users

### 1.1 Patient (Healthcare Consumer)
- **Role:** An individual seeking on-demand medical consultations using their employer-provided or personal Health Savings Account (HSA).
- **Core Needs & Goals:**
  - View current HSA wallet balance and recent appointment history.
  - Browse clinics, compare consultation copay rates, and inspect patient reviews.
  - Book a consultation safely with atomic wallet deduction and immediate confirmation.
  - Track current consultation status (`WAITING`, `IN_CONSULTATION`, `DISCHARGED`).
  - View a transparent, read-only audit ledger of all HSA debits and deposits with running balances.

### 1.2 Clinic Administrator / Attending Physician
- **Role:** Medical staff managing daily clinic operations, triage queues, and operational metrics.
- **Core Needs & Goals:**
  - Monitor live clinic KPIs: waiting patients, patients currently in consultation, discharges today, and daily copay revenue.
  - Triage and progress appointments step-by-step through their lifecycle (`WAITING` -> `IN_CONSULTATION` -> `DISCHARGED`), freeing up patients from the active consultation restriction.
  - Track moving revenue averages and refresh the monthly materialized view.
  - Monitor active mobile dispatch nurses on a live geospatial map within a 5 km radius.
  - Analyze patient satisfaction metrics (star ratings, sentiment tags) and browse the flexible medical catalog.

---

## 2. Wireframe Screen Mapping

All wireframes are placed in `docs/design/` and correspond to the following screens:

| Wireframe | Screen / Route | Target User | Key Actions & Workflows |
|---|---|---|---|
| `00_role_switcher.png` | `/switch-profile` | Both | One-click role and actor switcher for grading evaluation |
| `00_profile_switcher_dropdown.png` | Global Header | Both | Quick profile dropdown previewing name, role, and current balance |
| `P1_patient_dashboard.png` | `/patient/dashboard` | Patient | Quick overview, active consultation banner, recent wallet history |
| `P2_patient_appointments.png` | `/patient/appointments` | Patient | Paginated appointment queue with status filters |
| `P3_book_appointment.png` | `/patient/book` | Patient | **Workflow 1**: Atomic booking via stored procedure with live math and failure feedback |
| `P4_clinics_reviews.png` | `/patient/clinics` | Patient | Split-screen clinic directory with review analytics |
| `P5_patient_wallet.png` | `/patient/wallet` | Patient | Read-only HSA audit ledger with date filters and running balance |
| `C1_clinic_dashboard.png` | `/clinic/dashboard` | Clinic | Operational KPI cards, 7-day discharge bar chart, and active queue |
| `C2_clinic_patients.png` | `/clinic/patients` | Clinic | Patient queue with triage actions (`WAITING` -> `IN_CONSULTATION` -> `DISCHARGED`) |
| `C3_nurse_map.png` | `/clinic/nurse-map` | Clinic | **Workflow 3**: Geospatial map with 5 km radius and nearest active nurses |
| `C4_clinic_analytics.png` | `/clinic/analytics` | Clinic | **Workflow 2**: 7-day moving average chart, dense rank table, and MV refresh |
| `C5a_clinic_reviews.png` | `/clinic/reviews` | Clinic | **Workflow 4**: Rating breakdown bars and sentiment tag frequencies |
| `C5b_medical_catalog.png` | `/clinic/reviews` | Clinic | Unstructured medical catalog with specialist roster and formulary |
| `M1_browse_mobile.png` | Mobile Layout | Patient | Responsive mobile browse view with card-based records and status filters |
| `M2_book_mobile.png` | `/patient/book` | Patient | Responsive mobile booking flow with live wallet audit feedback below form |
| `S_ui_states.png` | `/states` | Both | Showcase of loading skeletons, empty states, and error handling |

---

## 3. Design System & Visual Guidelines

- **Typography:** Modern sans-serif (`Inter`, system fallbacks) for high readability across dashboards and tabular data.
- **Color Palette:**
  - Primary / Headers: Deep Slate (`#0F172A`)
  - Accent / Actions: Teal (`#0D9488`)
  - Status Indicators: Amber (`#F59E0B`) for Waiting, Sky Blue (`#0284C7`) for In Consultation, Emerald (`#10B981`) for Discharged / Credits
  - Financial Debits & Alerts: Crimson (`#E11D48`)
  - Backgrounds: Clean neutral slate (`#F8FAFC`, `#FFFFFF`)
- **Reusable Components:**
  - KPI Stat Cards with top color accents
  - Responsive Wireframe Tables with status badges
  - Multi-state Booking Feedback Panels (Success, Insufficient Balance, Conflict)
  - Reusable Pagination Controls
