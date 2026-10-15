import { pool } from '../config/postgres.js';

export async function listPatients({page=1,limit=20,search=''}) 
{
  const offset=(page-1)*limit;
  const q=search.trim();
  const args=q ? [`%${q}%`,limit,offset] : [limit,offset];
  const where=q ? 'WHERE name ILIKE $1' : '';
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM patients ${where}`, q ? [args[0]] : []);
  const data = await pool.query(`SELECT id,name,hsa_balance FROM patients ${where} ORDER BY name LIMIT $${q?2:1} OFFSET $${q?3:2}`, args);
  return {
    data:data.rows,
    total:count.rows[0].total
  };
}

export async function getPatient(id) 
{
  const {rows}=await pool.query('SELECT id,name,hsa_balance FROM patients WHERE id=$1',[id]);
  return rows[0] || null;
}

export async function getDashboard(id) 
{
  const patient=await getPatient(id);
  if(!patient) return null;
  const appointments=await pool.query(`SELECT a.id,a.patient_id,a.clinic_id,c.name AS clinic_name,a.copay_amount,a.status,a.created_at FROM appointments a JOIN clinics c ON c.id=a.clinic_id WHERE a.patient_id=$1 ORDER BY a.created_at DESC LIMIT 8`,[id]);
  const audit=await pool.query(`
    SELECT 
      w.id,
      w.amount_changed,
      w.action_type,
      w.balance_after,
      w.timestamp,
      COALESCE(c.name, fallback_c.name, (SELECT name FROM clinics ORDER BY id LIMIT 1)) AS clinic_name
    FROM wallet_audit_logs w
    LEFT JOIN LATERAL (
      SELECT a.clinic_id
      FROM appointments a
      WHERE a.patient_id = w.patient_id
        AND ABS(EXTRACT(EPOCH FROM (a.created_at - w.timestamp))) < 300
      ORDER BY ABS(EXTRACT(EPOCH FROM (a.created_at - w.timestamp))) ASC
      LIMIT 1
    ) apt ON true
    LEFT JOIN LATERAL (
      SELECT a2.clinic_id
      FROM appointments a2
      WHERE a2.patient_id = w.patient_id
      ORDER BY ABS(EXTRACT(EPOCH FROM (a2.created_at - w.timestamp))) ASC
      LIMIT 1
    ) fallback_apt ON apt.clinic_id IS NULL
    LEFT JOIN clinics c ON c.id = apt.clinic_id
    LEFT JOIN clinics fallback_c ON fallback_c.id = fallback_apt.clinic_id
    WHERE w.patient_id = $1 AND w.action_type = 'DEBIT'
    ORDER BY w.timestamp DESC
    LIMIT 8
  `,[id]);
  return {
    patient,
    recentAppointments:appointments.rows,
    recentAudit:audit.rows
  };
}
