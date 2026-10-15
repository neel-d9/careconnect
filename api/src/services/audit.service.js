import { pool } from '../config/postgres.js';
export async function getAudit(patientId,{from,to,page=1,limit=20})
{
  const offset=(page-1)*limit; const vals=[patientId]; const c=['patient_id=$1'];

  if(from)
  {
    vals.push(from);c.push(`timestamp >= $${vals.length}`)
  }
  if(to)
  {
    vals.push(to);c.push(`timestamp < ($${vals.length}::date + INTERVAL '1 day')`)
  }
  const where=c.join(' AND ');
  const count=await pool.query(`SELECT COUNT(*)::int total FROM wallet_audit_logs w WHERE ${where}`,vals);
  vals.push(limit,offset);
  const data=await pool.query(`
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
    WHERE ${where} 
    ORDER BY w.timestamp DESC 
    LIMIT $${vals.length-1} OFFSET $${vals.length}
  `,vals);
  return {
    data:data.rows,
    total:count.rows[0].total
  };
}
