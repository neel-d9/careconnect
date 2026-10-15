
-- 1. Prevent a patient from having more than one active
--    appointment at a time.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_consult
ON appointments (patient_id)
WHERE status IN ('WAITING', 'IN_CONSULTATION');


-- ============================================================
-- 2. Appointment lookup by patient.
--    Useful for patient appointment history.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id
ON appointments (patient_id);


-- ============================================================
-- 3. Appointment lookup and analytics by clinic/date.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_created
ON appointments (clinic_id, created_at)
INCLUDE (copay_amount);


-- ============================================================
-- 4. Discharged appointments used by the monthly
--    discharge/revenue materialized view.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_appointments_discharged
ON appointments (clinic_id, created_at)
INCLUDE (copay_amount)
WHERE status = 'DISCHARGED';


-- ============================================================
-- 5. Wallet audit history lookup by patient and timestamp.
--    Supports patient wallet/history queries efficiently.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_wallet_audit_patient_timestamp
ON wallet_audit_logs (patient_id, timestamp);

