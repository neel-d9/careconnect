# Handover Note — CareConnect (Project 4)

**Course:** CS6.302 Software System Development  
**Deliverable:** Assignment 2 — Front End Design & Full-Stack Integration  
**Scope:** Review and enhancement of inherited Assignment 1 database codebase  

---

## 1. What Worked

When we took over the repository, we followed the setup instructions in the inherited `README.md` to spin up PostgreSQL and MongoDB:

1. **Relational Schema Setup (`sql/01_schema_ddl.sql`)**:
   - The tables for `patients`, `clinics`, `appointments`, and `wallet_audit_logs` were cleanly defined with appropriate data types (UUIDs, `TIMESTAMPTZ`, `DECIMAL(10,2)`).
   - Check constraints like `CHECK (hsa_balance >= 0.00)` on the patient wallet and the custom `appointment_status` enum (`WAITING`, `IN_CONSULTATION`, `DISCHARGED`) worked as expected.
2. **Materialized View (`sql/05_materialized_views.sql`)**:
   - The materialized view `mv_clinic_monthly_discharges` aggregated total discharged appointments and copay revenue grouped by clinic and month.
   - The concurrent refresh function `refresh_clinic_monthly_mv()` worked properly once the unique index on `(clinic_id, month_period)` was established.
3. **Partial Unique Index (`sql/02_indexes.sql`)**:
   - The partial index `idx_active_consult` effectively prevented a patient from having two concurrent active appointments in `WAITING` or `IN_CONSULTATION` status.
4. **MongoDB Geospatial Index (`mongo/01_collections_and_indexes.js`)**:
   - The `2dsphere` index on `NursePings.location` was created properly, allowing geospatial `$geoNear` aggregation queries to execute without syntax errors.
5. **Data Generation Scripts**:
   - The Python seeders in `data_generation/` successfully populated sample patients, clinics, appointments, and nurse telemetry coordinates.

---

## 2. What Did Not Work / Missing Edge Cases

During our end-to-end integration with the Express API and React frontend, we uncovered several bugs and missing requirements in the inherited scripts:

1. **Stored Procedure Missing Clinic Acceptance Check (`sql/04_stored_procedures.sql`)**:
   - The procedure `sp_book_appointment` checked patient balance and clinic existence, but did not check `is_accepting_patients`. As a result, patients could book appointments at closed or inactive clinics.
2. **Audit Trigger Spurious Runs & Immutability Gaps (`sql/03_triggers_and_audit.sql`)**:
   - The trigger fired unconditionally on `AFTER UPDATE OF hsa_balance`, but lacked a `WHEN (OLD.hsa_balance IS DISTINCT FROM NEW.hsa_balance)` guard. Updating a patient's name or metadata while keeping balance constant still generated bogus audit log entries.
   - Furthermore, `wallet_audit_logs` lacked table-level immutability rules. A user or rogue script could perform an `UPDATE` or `DELETE` on the financial audit ledger without being blocked.
3. **Window Analytics Missing Calendar CTE (`sql/06_window_analytics.sql`)**:
   - The 7-day moving average calculation used `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` grouped only by appointment dates present in the table. If a clinic had no appointments on certain days, the moving average window jumped across calendar gaps rather than calculating a true 7-calendar-day average.
4. **Missing Performance Indexes on High-Frequency Lookups (`sql/02_indexes.sql`)**:
   - There was no index on `appointments(patient_id)` or `wallet_audit_logs(patient_id, timestamp)`. Loading a patient's dashboard or wallet history resulted in sequential table scans across all records.
5. **Geospatial Pipeline Returned Duplicate Nurse Records (`mongo/02_workflow3_geonear.js`)**:
   - Because nurses send periodic telemetry pings every few minutes, the original `$geoNear` query returned multiple pings from the exact same nurse if they were within 5 km, rather than returning the closest *distinct* active nurses.
6. **Missing TTL Expiration Index on MongoDB Telemetry**:
   - `NursePings` had no TTL index configured on `created_at`, meaning old GPS telemetry would accumulate indefinitely rather than expiring after 2 hours.
7. **Missing `MedicalCatalogs` Collection in Seeder**:
   - The prompt specifies an unstructured `MedicalCatalogs` collection for specialist rosters and medications. The inherited seeder only created `NursePings` and `PatientReviews`.

---

## 3. What We Changed and Why

To ensure the system works reliably with our web application, we made the following targeted improvements:

| File / Component | What We Changed | Technical Justification |
|---|---|---|
| `sql/01_schema_ddl.sql` | Added `ON DELETE RESTRICT` foreign key constraints across `appointments` and `wallet_audit_logs`. | Prevents accidental cascading deletes of active medical consultations or audit records if a parent entity is deleted. |
| `sql/02_indexes.sql` | Added secondary indexes on `appointments(patient_id)`, `appointments(clinic_id, status)`, and `wallet_audit_logs(patient_id, timestamp DESC)`. | Allows index scans for patient appointment history and paginated wallet ledgers, preventing full table scans on large datasets. |
| `sql/03_triggers_and_audit.sql` | Added `WHEN (OLD.hsa_balance IS DISTINCT FROM NEW.hsa_balance)` clause, and added a trigger `trg_protect_wallet_audit` that raises an exception on `UPDATE`, `DELETE`, or `TRUNCATE`. | Ensures audit entries are strictly generated when money actually changes hands, and guarantees that the financial audit ledger is append-only. |
| `sql/04_stored_procedures.sql` | Added `AND is_accepting_patients = TRUE` check inside `sp_book_appointment`. | Enforces clinic availability directly inside the database transaction so closed clinics cannot receive bookings. |
| `sql/06_window_analytics.sql` | Added a `generate_series` continuous calendar CTE and created a reusable view `clinic_window_analytics`. | Ensures moving average windows reflect true 7-day calendar periods even when clinics have zero appointments on specific dates. |
| `mongo/01_collections_and_indexes.js` | Added `{ expireAfterSeconds: 7200 }` TTL index on `NursePings.created_at`. | Satisfies the requirement that mobile nurse GPS telemetry expires automatically after 2 hours. |
| `mongo/02_workflow3_geonear.js` | Added `$sort` by `created_at: -1` and `$group` by `nurse_id` before distance sorting. | Deduplicates pings so that dispatch triage identifies the closest unique nurse rather than multiple pings from the same person. |
| `mongo/03_workflow4_facet.js` | Added an optional `clinic_id` match filter and rating validation (`1 <= rating <= 5`). | Allows the review analytics tab to calculate rating breakdowns and sentiment tags both globally and per-clinic. |
| `data_generation/mongo_seeder.py` | Added sample `MedicalCatalogs` documents containing specialist schedules and medication formularies. | Provides the flexible unstructured document required by Workflow 4 and the medical catalog screen. |

---

## 4. Suggestions for the Original Authors

1. **Use Calendar CTEs for Time-Series Window Analytics**:
   When using window frames like `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW`, always join against a continuous calendar generated via `generate_series()`. Otherwise, gaps in transaction dates distort the moving average.
2. **Deduplicate Real-Time Telemetry Pings**:
   When querying time-series location pings with `$geoNear`, remember that mobile devices emit pings repeatedly. Always group by entity ID (taking the latest ping timestamp) before displaying candidates to dispatchers.
3. **Index Foreign Keys Used in User Dashboards**:
   PostgreSQL does not automatically index foreign key columns. Any foreign key that will be queried in list or dashboard endpoints (`patient_id`, `clinic_id`) should have an explicit B-tree index.
4. **Protect Financial Ledgers at the Database Level**:
   Triggers that log audit records should always include a `WHEN` clause to ignore unrelated column updates, and the audit table itself should have `BEFORE UPDATE OR DELETE` triggers to enforce an immutable, append-only ledger.

---

## 5. Full-Stack Verification & Integration Status

All components from the inherited database assignments were connected to our Node.js/Express backend API (`api/`) and React frontend (`web/`):

1. **Database Workflows & Testing**:
   - **Workflow 1**: Atomic booking via stored procedure `sp_book_appointment()` correctly deducts HSA balance and fires audit triggers. Verified via automated integration tests (`api/tests/workflow_transaction.test.js`).
   - **Workflow 2**: Moving average copay analytics and monthly discharge counts are surfaced in the Clinic Analytics screen (`/clinic/analytics`) using the SQL window functions and materialized view refresh function.
   - **Workflow 3**: Real-time nurse dispatch telemetry (`/clinic/nurse-map`) executes the `$geoNear` aggregation pipeline over `NursePings` with live 5-second polling and skeleton loading states.
   - **Workflow 4**: Review sentiment and star breakdown analytics (`/clinic/reviews`) execute the MongoDB `$facet` aggregation pipeline with clinic-level filtering. The Medical Catalog (`/clinic/catalog`) serves unstructured specialist and formulary records.

2. **Frontend UI Compliance**:
   - The user interface implements the 16 wireframe screens in `docs/design/`, using custom CSS tokens matching the specified typography and color palette.
   - No mock data or hardcoded fallbacks are used; all views fetch directly from PostgreSQL and MongoDB.
   - Role switching works without manual credentials via JWT tokens generated for seeded patients and clinics.

