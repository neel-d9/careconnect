-- ============================================================
-- 1. Automatically create a wallet audit record whenever
--    a patient's HSA balance changes.
-- ============================================================

CREATE OR REPLACE FUNCTION log_hsa_balance_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.hsa_balance = OLD.hsa_balance THEN
        RETURN NEW;
    END IF;

    INSERT INTO wallet_audit_logs (
        patient_id,
        amount_changed,
        action_type,
        balance_after
    )
    VALUES (
        NEW.id,
        ABS(NEW.hsa_balance - OLD.hsa_balance),
        CASE
            WHEN NEW.hsa_balance < OLD.hsa_balance THEN 'DEBIT'
            ELSE 'CREDIT'
        END,
        NEW.hsa_balance
    );

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_audit_hsa_balance
AFTER UPDATE OF hsa_balance ON patients
FOR EACH ROW
WHEN (OLD.hsa_balance IS DISTINCT FROM NEW.hsa_balance)
EXECUTE FUNCTION log_hsa_balance_change();


-- ============================================================
-- 2. Protect wallet_audit_logs from UPDATE and DELETE.
--    The audit history is append-only.
-- ============================================================

CREATE OR REPLACE FUNCTION protect_wallet_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'wallet_audit_logs is append-only';
END;
$$;


CREATE TRIGGER trg_protect_wallet_audit_rows
BEFORE UPDATE OR DELETE ON wallet_audit_logs
FOR EACH ROW
EXECUTE FUNCTION protect_wallet_audit();


-- ============================================================
-- 3. Prevent TRUNCATE of the audit table.
-- ============================================================

CREATE TRIGGER trg_protect_wallet_audit_truncate
BEFORE TRUNCATE ON wallet_audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION protect_wallet_audit();