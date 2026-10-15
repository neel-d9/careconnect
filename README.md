# CareConnect Database

## Repository Submission Details

- GitHub repository: https://github.com/MJT444/careconnect
- Final commit hash: `fa841f6e3386597405c5dfdcdbfca96ca72a17f7`

## Overview

This project implements CareConnect's healthcare database across PostgreSQL and MongoDB. PostgreSQL manages the relational hospital appointment and HSA (Health Savings Account) system, while MongoDB supports real-time nurse location queries and patient review analytics.

It demonstrates relational schema design, constraints, indexes, triggers, stored procedures, materialized views, window functions, geospatial aggregation, TTL data retention, and multi-faceted analytics.

---

## Project Structure

```text
api/
├── package.json
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/ (postgres.js, mongo.js)
│   ├── controllers/
│   ├── middleware/ (auth.js, errorHandler.js)
│   ├── routes/
│   ├── services/ (analytics, appointment, audit, auth, clinic, mongo, patient, reviewFacet)
│   └── utils/ (httpError.js)
└── tests/
    └── workflow_transaction.test.js

web/
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── App.jsx
    ├── components/ (Pagination, State, UI)
    ├── context/ (AuthContext)
    ├── layouts/ (AppLayout)
    ├── pages/ (Analytics, BookAppointment, Catalog, ClinicDashboard, ClinicPatients, Clinics, Login, NurseMap, PatientAppointments, PatientDashboard, Reviews, States, SwitchProfile, Wallet)
    ├── routes/ (ProtectedRoute)
    ├── services/ (api)
    └── styles/ (app.css)

sql/
├── 01_schema_ddl.sql
├── 02_indexes.sql
├── 03_triggers_and_audit.sql
├── 04_stored_procedures.sql
├── 05_materialized_views.sql
└── 06_window_analytics.sql

mongo/
├── 01_collections_and_indexes.js
├── 02_workflow3_geonear.js
└── 03_workflow4_facet.js

data_generation/
├── postgres_seeder.py
├── mongo_seeder.py
└── requirements.txt

docs/
├── api_endpoints.md
├── handover_note.md
├── mongo_schema_map.json
└── design/ (wireframes and user descriptions)

performance/
├── mongo_execution_stats.json
└── postgres_explain_analyzes.txt
```

---

## PostgreSQL

---

## 1. Database Schema — `01_schema_ddl.sql`

This file creates the core database schema.

### Appointment Status

A custom PostgreSQL ENUM is created for appointment states:

- `WAITING`
- `IN_CONSULTATION`
- `DISCHARGED`

### Tables

#### `patients`

Stores patient information and HSA balances.

Fields include:

- `id` — UUID primary key
- `name` — Patient name
- `hsa_balance` — Current HSA balance

A `CHECK` constraint ensures that the HSA balance cannot be negative.

#### `clinics`

Stores clinic information.

Fields include:

- `id` — UUID primary key
- `name` — Clinic name
- `latitude` — Clinic latitude
- `longitude` — Clinic longitude
- `is_accepting_patients` — Indicates whether the clinic is accepting patients

#### `appointments`

Stores appointment information.

Fields include:

- `id` — UUID primary key
- `patient_id` — Reference to the patient
- `clinic_id` — Reference to the clinic
- `copay_amount` — Appointment copay
- `status` — Current appointment status
- `created_at` — Appointment creation timestamp

#### `wallet_audit_logs`

Stores a history of changes to patient HSA balances.

Fields include:

- `id`
- `patient_id`
- `amount_changed`
- `action_type`
- `balance_after`
- `timestamp`

Foreign keys maintain referential integrity between related tables.

---

## 2. Indexes — `02_indexes.sql`

This file creates indexes for performance optimization and business-rule enforcement.

### Active Appointment Constraint

A partial unique index prevents a patient from having multiple active appointments.

Active statuses are:

- `WAITING`
- `IN_CONSULTATION`

```sql
CREATE UNIQUE INDEX idx_active_consult
ON appointments (patient_id)
WHERE status IN ('WAITING', 'IN_CONSULTATION');
```

### Clinic Appointment Index

The `idx_appointments_clinic_created` index supports queries involving:

- Clinic
- Appointment creation time
- Copay amount

### Discharged Appointment Index

The `idx_appointments_discharged` partial index specifically optimizes queries involving discharged appointments.

This is useful for monthly discharge and revenue aggregation.

---

## 3. Triggers & Audit Logging — `03_triggers_and_audit.sql`

This file implements automatic auditing of HSA balance changes.

### Trigger Function

The function `log_hsa_balance_change()` automatically records changes whenever a patient's HSA balance is updated.

The audit entry records:

- Patient ID
- Amount changed
- Transaction type
- Balance after the transaction
- Timestamp

### Transaction Types

- If the balance increases: `CREDIT`
- If the balance decreases: `DEBIT`

### Trigger

The trigger `trg_audit_hsa_balance` runs after an HSA balance update.

This provides an automatic audit trail without requiring application-level logging.

---

## 4. Stored Procedure — `04_stored_procedures.sql`

This file contains the appointment-booking procedure: `sp_book_appointment()`.

The procedure handles both HSA copay deduction and appointment creation.

### Booking Workflow

1. Lock the patient's row using `FOR UPDATE`.
2. Verify that the patient exists.
3. Verify that the clinic exists.
4. Check whether the copay is valid.
5. Check whether the patient has sufficient HSA funds.
6. Deduct the copay from the patient's HSA balance.
7. Create the appointment with status `WAITING`.

### Concurrency Control

The patient's row is locked using:

```sql
SELECT ...
FROM patients
WHERE id = p_patient_id
FOR UPDATE;
```

This helps prevent concurrent transactions from spending the same HSA balance.

The HSA update also automatically creates an audit record through the trigger defined in `03_triggers_and_audit.sql`.

---

## 5. Materialized View — `05_materialized_views.sql`

This file creates the materialized view `mv_clinic_monthly_discharges`.

The view stores monthly discharge and copay-revenue statistics for each clinic.

### Metrics

The materialized view calculates:

- Clinic ID
- Clinic name
- Month
- Total discharged appointments
- Total copay revenue

Example:

| Clinic   | Month   | Total Discharges | Copay Revenue |
|----------|---------|-------------------|----------------|
| Clinic A | 2026-08 | 120               | 24000          |
| Clinic B | 2026-08 | 95                | 19500          |

### Concurrent Refresh

A unique index is created on `(clinic_id, month_period)`.

This allows the materialized view to be refreshed concurrently using:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_clinic_monthly_discharges;
```

A helper function is also provided: `refresh_clinic_monthly_mv()`, which performs the concurrent refresh.

---

## 6. Window Analytics — `06_window_analytics.sql`

This file performs revenue analytics using PostgreSQL window functions.

### Daily Clinic Revenue

The query first calculates the total copay revenue generated by each clinic for each day.

`clinic_id` + `date` → daily revenue

### 7-Day Moving Average

A seven-day moving average is calculated using:

```sql
AVG(daily_copay_total) OVER (
    PARTITION BY clinic_id
    ORDER BY rev_date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
)
```

This helps analyze short-term revenue trends for each clinic.

### Total Clinic Revenue

The total revenue generated by each clinic is calculated using:

```sql
SUM(daily_copay_total) OVER (
    PARTITION BY clinic_id
)
```

### Global Revenue Ranking

Clinics are ranked according to their total revenue using:

```sql
DENSE_RANK() OVER (
    ORDER BY total_clinic_revenue DESC
)
```

### Final Output

The query produces:

- Clinic name
- Revenue date
- Daily copay revenue
- 7-day moving average
- Global revenue rank

---

## PostgreSQL Concepts Demonstrated

This project demonstrates the following PostgreSQL concepts:

- Relational database design
- DDL
- UUID primary keys
- Foreign keys
- CHECK constraints
- Custom ENUM types
- Partial indexes
- Unique indexes
- Covering indexes using `INCLUDE`
- Row-level locking with `FOR UPDATE`
- PL/pgSQL procedures
- Trigger functions
- Automatic audit logging
- Materialized views
- Concurrent materialized-view refresh
- Aggregate functions
- Common Table Expressions (CTEs)
- Window functions
- Moving averages
- `DENSE_RANK()`
- Transaction-safe HSA deductions
- Query performance optimization

---

## MongoDB Workflows

The MongoDB scripts use the `medical_db` database and implement Workflows 3 and 4 of the assignment.

### Collections

#### `NursePings`

Stores real-time geospatial location logs for mobile nurses. The collection is created by `mongo/01_collections_and_indexes.js` with:

- A `2dsphere` index on `location`, required by `$geoNear`
- A TTL index on `created_at` with `expireAfterSeconds: 7200`

Expected document shape:

```json
{
  "nurse_id": "<UUID/INT>",
  "location": { "type": "Point", "coordinates": [lng, lat] },
  "status": "ACTIVE | OFFLINE",
  "created_at": "ISODate"
}
```

#### `PatientReviews`

Stores patient-submitted reviews of clinics or appointments.

Expected document shape:

```json
{
  "patient_id": "<UUID>",
  "clinic_id": "<UUID>",
  "rating": "1-5",
  "tags": ["string", "..."],
  "created_at": "ISODate"
}
```

Neither collection has enforced validation. These field names are the contracts expected by the aggregation scripts; update the pipelines if the seeder scripts use different names.

### Workflow 3 — Nearest Mobile Nurse

`mongo/02_workflow3_geonear.js` finds the closest currently active nurse for coordinates supplied by the client application.

- Patient coordinates are not stored in PostgreSQL. The script uses the example `patientLng` and `patientLat` values at the top of the file.
- The search radius is capped at 5 km using `maxDistanceMeters = 5000`.
- The pipeline filters to `status: "ACTIVE"`, finds pings within the radius, keeps each nurse's most recent ping, sorts by distance, and returns the closest nurse.
- `$geoNear` requires the `NursePings.location` `2dsphere` index; without it, the stage cannot run.

Execute it with:

```bash
mongosh "mongodb://admin:password@localhost:27017/medical_db?authSource=admin" mongo/02_workflow3_geonear.js
```

### Workflow 4 — Multi-Faceted Review Analytics

`mongo/03_workflow4_facet.js` computes three statistics over `PatientReviews` in one aggregation using `$facet`:

1. `ratingDistribution` counts reviews for each star rating from 1 to 5.
2. `topTags` unwinds `tags`, counts tag occurrences, and returns the 10 most frequent tags.
3. `overallAverage` calculates the mean rating and total review count.

`$facet` scans the full input collection for each sub-pipeline by design. There is no equivalent index requirement to `$geoNear`; the explain proof should demonstrate correctness and reasonable execution time at 100k+ scale.

Execute it with:

```bash
mongosh "mongodb://admin:password@localhost:27017/medical_db?authSource=admin" mongo/03_workflow4_facet.js
```

### MongoDB Explain Plans

Detailed execution statistics are saved in `performance/mongo_execution_stats.json`.

#### Workflow 3

- Uses the `GEO_NEAR_2DSPHERE` stage backed by the `location_2dsphere` index.
- Applies an additional `FETCH` filter for active status.
- Sorts by distance and limits the result to one nurse.

#### Workflow 4

- Starts with a `COLLSCAN` because `$facet` must scan the full input to compute all analytics.
- Projects `rating` and `tags` before splitting into three parallel sub-pipelines.
- Uses grouping and sorting for `ratingDistribution`, unwinding followed by grouping, sorting, and limiting for `topTags`, and grouping for `overallAverage`.

---

## Combined Execution Order

Run the PostgreSQL files in this order because later files depend on objects created earlier:

```text
sql/01_schema_ddl.sql
        ↓
sql/02_indexes.sql
        ↓
sql/03_triggers_and_audit.sql
        ↓
sql/04_stored_procedures.sql
        ↓
sql/05_materialized_views.sql
        ↓
sql/06_window_analytics.sql
```

Initialize MongoDB collections and indexes before running its workflows:

```bash
mongosh "mongodb://admin:password@localhost:27017/medical_db?authSource=admin" mongo/01_collections_and_indexes.js
```

---

## Requirements

- PostgreSQL with the `pgcrypto` extension
- MongoDB and `mongosh`
- MongoDB database: `medical_db`

If required, enable PostgreSQL UUID generation with:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

The MongoDB commands assume the local connection string shown above. Update the credentials or host as needed.

---

## Summary

CareConnect combines PostgreSQL's transactional relational model with MongoDB's geospatial and aggregation capabilities. PostgreSQL provides data integrity, concurrency protection, financial auditing, efficient reporting, and revenue analytics. MongoDB provides expiring nurse location data, nearest-active-nurse discovery, and review analytics through a single `$facet` pipeline.

---

# Assignment 2 — Full-Stack Web Application & API Layer

## 1. Overview
For Assignment 2, our team built a responsive web application (`web/`) backed by an Express.js API (`api/`) connecting to the PostgreSQL and MongoDB databases from Assignment 1.

- **Frontend**: React 18, Vite, React Router 6, Recharts, Leaflet, Lucide Icons, and Vanilla CSS design system (`web/src/styles/app.css`) following the wireframes in `docs/design/`.
- **Backend**: Node.js, Express.js, `pg` connection pool, MongoDB Node.js driver, JWT session tokens, and parameterized queries. All business rules, transactions, and analytics are executed directly in database procedures, views, and aggregation pipelines.
- **Visual Design**: Matches the wireframe specifications in `docs/design/`, including responsive mobile/laptop layouts, global navigation, zero-friction actor switching, and dedicated UI states.

---

## 2. Quickstart & Setup

### Prerequisites
- Node.js (v18+)
- Python 3.10+ (for seeders in `data_generation/`)
- PostgreSQL running on port 5432 (`careconnect` database)
- MongoDB running on port 27017 (`medical_db` database)

### Database Seeding
From the repository root:
```bash
cd data_generation
pip install -r requirements.txt

# Seed PostgreSQL (patients, clinics, appointments, audit logs)
python postgres_seeder.py

# Seed MongoDB (500k nurse pings with TTL, 20k reviews, medical catalogs)
python mongo_seeder.py
```

### Backend API (`api/`)
```bash
cd api
npm install
npm run dev
```
API runs at: `http://localhost:5000/api`

### Frontend Web (`web/`)
```bash
cd web
npm install
npm run dev
```
Frontend runs at: `http://localhost:5173`

### Running the Test Suite
As required by Step 4 of the assignment guidelines, automated tests cover the primary transaction workflow (stored procedure booking, balance math, insufficient balance rollback, and partial unique index conflicts):
```bash
cd api
npm test
```

---

## 3. Demo Authentication & Actor Switching
Per the assignment instructions, real user registration is not required. A 1-click **Profile Switcher** is accessible in the navbar dropdown and at `/switch-profile`:
- **Patient**: Seeded UUID with demo password `admin` (e.g. *Sarah Jenkins* with active HSA balance)
- **Clinic**: Seeded UUID with demo password `root` (e.g. *Aaronfurt Care Clinic*)

---

## 4. UI Compliance, Data Discrepancy Prevention & State Handling
- **Wireframe Alignment**: Fully matches the 16 wireframes in `docs/design/`, including responsive mobile/laptop layouts, global navigation, and the four updated wireframes (`C1_clinic_dashboard`, `C2_clinic_patients`, `P1_patient_dashboard`, and `C5b_medical_catalog`).
- **Zero Mock / Fallback Data**: Every screen binds directly to live records in PostgreSQL and MongoDB. No mock objects or hardcoded fallback states are rendered.
- **Skeleton Loading & State Handling**: Standardized skeleton loaders (`.skeleton-container`, `.skeleton-line`) are rendered during initial data fetches across screens (including `/states` and `/clinic/nurse-map`) rather than premature empty text.
- **Handover Note**: Inherited codebase review, edge cases, improvements, and database architectural suggestions are documented in [`docs/handover_note.md`](docs/handover_note.md).
- **API Documentation**: Detailed endpoint specifications are documented in [`docs/api_endpoints.md`](docs/api_endpoints.md).

---

## 5. Team Member Contribution & Workload Distribution Matrix (4 Members)

| Member | Assigned Wireframes (`docs/design/`) | Full-Stack Feature & Layer Ownership | Database Workflows / Responsibilities |
|---|---|---|---|
| **Anmol Sharma** | • `00_role_switcher.png`<br>• `00_profile_switcher_dropdown.png`<br>• `C1_clinic_dashboard.png`<br>• `C2_clinic_patients.png` | **App Shell, Actor Switcher, & Clinic Queue Triage**<br>• `web/src/layouts/AppLayout.jsx`<br>• `web/src/context/AuthContext.jsx`<br>• `web/src/pages/SwitchProfile.jsx`<br>• `web/src/pages/ClinicDashboard.jsx`<br>• `web/src/pages/ClinicPatients.jsx`<br>• `api/src/services/auth.service.js`<br>• `api/src/services/clinic.service.js` | • Demo profile retrieval & JWT switching<br>• Clinic appointment queue filtering (`WAITING`, `IN_CONSULTATION`, `DISCHARGED`)<br>• Status transition stepper (`PATCH /api/appointments/:id/status`) enforcing `idx_active_consult` |
| **Diptoneel De** | • `P1_patient_dashboard.png`<br>• `P3_book_appointment.png`<br>• `P5_patient_wallet.png` | **Patient Portal, Booking (Workflow 1), & HSA Wallet**<br>• `web/src/pages/PatientDashboard.jsx`<br>• `web/src/pages/BookAppointment.jsx`<br>• `web/src/pages/Wallet.jsx`<br>• `api/src/services/patient.service.js`<br>• `api/src/services/appointment.service.js`<br>• `api/src/services/audit.service.js` | • **Workflow 1**: PostgreSQL stored procedure `sp_book_appointment()` atomic transaction<br>• Real-time HSA deduction math & insufficient funds error trapping<br>• Financial audit trail (`wallet_audit_logs`) populated by database trigger |
| **Krishna Saboo** | • `C4_clinic_analytics.png`<br>• `P2_patient_appointments.png`<br>• `S_ui_states.png` | **Clinic Analytics (Workflow 2), UI States, & Patient Appointments**<br>• `web/src/pages/Analytics.jsx`<br>• `web/src/pages/PatientAppointments.jsx`<br>• `web/src/pages/States.jsx`<br>• `web/src/styles/app.css`<br>• `api/src/services/analytics.service.js`<br>• `api/src/middleware/errorHandler.js` | • **Workflow 2**: SQL window functions (`06_window_analytics.sql`) for 7-day moving average copay & `DENSE_RANK()`<br>• Materialized view `mv_clinic_monthly_discharges` and on-demand refresh (`refresh_clinic_monthly_mv()`)<br>• Loading skeleton, empty state, and API error retry cards |
| **Jyoti Pal** | • `C3_nurse_map.png`<br>• `P4_clinics_reviews.png`<br>• `C5a_clinic_reviews.png`<br>• `C5b_medical_catalog.png` | **Nurse Telemetry Map (Workflow 3), Reviews & Medical Catalog (Workflow 4)**<br>• `web/src/pages/NurseMap.jsx`<br>• `web/src/pages/Clinics.jsx`<br>• `web/src/pages/Reviews.jsx`<br>• `web/src/pages/Catalog.jsx`<br>• `api/src/services/mongo.service.js` | • **Workflow 3**: MongoDB `$geoNear` aggregation pipeline on `NursePings` with `2dsphere` index (5 km geofence)<br>• Interactive Leaflet map with simulated live GPS telemetry polling<br>• **Workflow 4**: MongoDB `$facet` multi-pipeline aggregation on `PatientReviews` (rating distribution, tags, average)<br>• Flexible medical catalog document explorer (`MedicalCatalogs`) |