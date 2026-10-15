import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/postgres.js';

describe('Workflow 1: Appointment Booking & HSA Wallet Transaction Tests', () => {
  let testPatientId;
  let testClinicId;
  let createdAppointmentId;
  const testCopay = 25.00;

  before(async () => {
    // Pick an existing patient and clinic from database
    const patientRes = await pool.query(
      `SELECT id, name, hsa_balance FROM patients WHERE hsa_balance >= 100.00 LIMIT 1`
    );
    assert.ok(patientRes.rows.length > 0, 'Should find at least one test patient with sufficient balance');
    testPatientId = patientRes.rows[0].id;

    const clinicRes = await pool.query(
      `SELECT id, name FROM clinics WHERE is_accepting_patients = TRUE LIMIT 1`
    );
    assert.ok(clinicRes.rows.length > 0, 'Should find at least one clinic accepting patients');
    testClinicId = clinicRes.rows[0].id;

    // Clean up any lingering active appointments for this patient so tests are reproducible
    await pool.query(
      `UPDATE appointments SET status = 'DISCHARGED' WHERE patient_id = $1 AND status IN ('WAITING', 'IN_CONSULTATION')`,
      [testPatientId]
    );
  });

  after(async () => {
    // Cleanup any test appointment and restore patient balance if needed
    if (createdAppointmentId) {
      await pool.query(`DELETE FROM appointments WHERE id = $1`, [createdAppointmentId]);
    }
    await pool.end();
  });

  it('1. Successfully books appointment, deducts copay, and fires audit trigger', async () => {
    // Get balance before
    const balBeforeRes = await pool.query(`SELECT hsa_balance FROM patients WHERE id = $1`, [testPatientId]);
    const balanceBefore = Number(balBeforeRes.rows[0].hsa_balance);

    // Call stored procedure with 3 arguments: (patient_id, clinic_id, copay_amount)
    await pool.query(
      `CALL sp_book_appointment($1, $2, $3)`,
      [testPatientId, testClinicId, testCopay]
    );

    // Fetch the newly created appointment
    const aptRes = await pool.query(
      `SELECT id, status, copay_amount FROM appointments WHERE patient_id = $1 AND clinic_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [testPatientId, testClinicId]
    );
    assert.equal(aptRes.rows.length, 1);
    createdAppointmentId = aptRes.rows[0].id;
    assert.equal(aptRes.rows[0].status, 'WAITING');
    assert.equal(Number(aptRes.rows[0].copay_amount), testCopay);

    // Verify balance after deduction
    const balAfterRes = await pool.query(`SELECT hsa_balance FROM patients WHERE id = $1`, [testPatientId]);
    const balanceAfter = Number(balAfterRes.rows[0].hsa_balance);
    assert.equal(balanceAfter.toFixed(2), (balanceBefore - testCopay).toFixed(2));

    // Verify that the trigger logged to wallet_audit_logs
    const auditRes = await pool.query(
      `SELECT * FROM wallet_audit_logs WHERE patient_id = $1 ORDER BY timestamp DESC LIMIT 1`,
      [testPatientId]
    );
    assert.equal(auditRes.rows.length, 1);
    assert.equal(auditRes.rows[0].action_type, 'DEBIT');
    assert.equal(Number(auditRes.rows[0].amount_changed), testCopay);
    assert.equal(Number(auditRes.rows[0].balance_after).toFixed(2), balanceAfter.toFixed(2));
  });

  it('2. Fails and rolls back when HSA balance is insufficient', async () => {
    const hugeCopay = 999999.00;

    // Balance before
    const balBeforeRes = await pool.query(`SELECT hsa_balance FROM patients WHERE id = $1`, [testPatientId]);
    const balanceBefore = Number(balBeforeRes.rows[0].hsa_balance);

    let errorCaught = false;
    try {
      await pool.query(
        `CALL sp_book_appointment($1, $2, $3)`,
        [testPatientId, testClinicId, hugeCopay]
      );
    } catch (err) {
      errorCaught = true;
      assert.match(err.message, /insufficient|balance|check/i);
    }
    assert.equal(errorCaught, true, 'Should reject booking when copay exceeds balance');

    // Verify balance was NOT touched
    const balAfterRes = await pool.query(`SELECT hsa_balance FROM patients WHERE id = $1`, [testPatientId]);
    const balanceAfter = Number(balAfterRes.rows[0].hsa_balance);
    assert.equal(balanceAfter, balanceBefore);
  });

  it('3. Partial unique index idx_active_consult blocks concurrent active appointments', async () => {
    // Current test appointment is in WAITING status. Attempting to insert another active appointment must fail.
    let indexErrorCaught = false;
    try {
      await pool.query(
        `INSERT INTO appointments (patient_id, clinic_id, copay_amount, status)
         VALUES ($1, $2, $3, 'WAITING')`,
        [testPatientId, testClinicId, 10.00]
      );
    } catch (err) {
      indexErrorCaught = true;
      assert.equal(err.code, '23505', 'PostgreSQL unique violation code 23505 expected');
    }
    assert.equal(indexErrorCaught, true, 'Partial unique index should block second active appointment');
  });

  it('4. Status transition to DISCHARGED frees the patient to book again', async () => {
    // Move to IN_CONSULTATION then DISCHARGED
    await pool.query(`UPDATE appointments SET status = 'IN_CONSULTATION' WHERE id = $1`, [createdAppointmentId]);
    await pool.query(`UPDATE appointments SET status = 'DISCHARGED' WHERE id = $1`, [createdAppointmentId]);

    const checkRes = await pool.query(`SELECT status FROM appointments WHERE id = $1`, [createdAppointmentId]);
    assert.equal(checkRes.rows[0].status, 'DISCHARGED');

    // Patient can now book another appointment without idx_active_consult conflict
    const nextBookRes = await pool.query(
      `INSERT INTO appointments (patient_id, clinic_id, copay_amount, status)
       VALUES ($1, $2, $3, 'WAITING') RETURNING id`,
      [testPatientId, testClinicId, 10.00]
    );
    assert.ok(nextBookRes.rows[0].id, 'New appointment successfully created after discharge');

    // Cleanup second appointment
    await pool.query(`DELETE FROM appointments WHERE id = $1`, [nextBookRes.rows[0].id]);
  });
});
