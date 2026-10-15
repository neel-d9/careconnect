import { pool } from '../config/postgres.js';

export async function listClinics({page=1,limit=20,search='',accepting}) {
  const offset=(page-1)*limit; 
  const values=[]; 
  const conditions=[];
  if(search?.trim())
  {
    values.push(`%${search.trim()}%`);
    conditions.push(`name ILIKE $${values.length}`);
  }
  if(accepting !== undefined && accepting !== '')
  {
    values.push(accepting==='true');
    conditions.push(`is_accepting_patients = $${values.length}`);
  }

  const where=conditions.length?`WHERE ${conditions.join(' AND ')}`:'';
  const count=await pool.query(`SELECT COUNT(*)::int AS total FROM clinics ${where}`,values);

  values.push(limit,offset);

  const data=await pool.query(`
    SELECT 
      c.id,
      c.name,
      c.latitude,
      c.longitude,
      c.is_accepting_patients,
      COALESCE((
        SELECT ROUND(AVG(a.copay_amount), 2) 
        FROM appointments a 
        WHERE a.clinic_id = c.id
      ), 35.00)::numeric AS avg_copay
    FROM clinics c 
    ${where} 
    ORDER BY c.name 
    LIMIT $${values.length-1} OFFSET $${values.length}
  `,values);
  return {
    data:data.rows,
    total:count.rows[0].total
  };
}

export async function getClinic(id)
{
  const {rows}=await pool.query(`
    SELECT 
      c.id,
      c.name,
      c.latitude,
      c.longitude,
      c.is_accepting_patients,
      COALESCE((
        SELECT ROUND(AVG(a.copay_amount), 2) 
        FROM appointments a 
        WHERE a.clinic_id = c.id
      ), 35.00)::numeric AS avg_copay
    FROM clinics c 
    WHERE c.id = $1
  `,[id]);
  return rows[0]||null;
}

export async function countClinics()
{
  const {rows}=await pool.query('SELECT COUNT(*)::int AS total FROM clinics');
  return rows[0].total;
}

export async function getDashboard(id)
{
  const clinic=await getClinic(id); if(!clinic) return null;
  const counts=await pool.query(`SELECT status,COUNT(*)::int AS count FROM appointments WHERE clinic_id=$1 GROUP BY status`,[id]);
  
  const todayStats=await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'DISCHARGED')::int AS discharged_today,
      COALESCE(SUM(copay_amount) FILTER (WHERE status = 'DISCHARGED'), 0)::numeric AS revenue_today
    FROM appointments 
    WHERE clinic_id = $1 AND created_at >= CURRENT_DATE
  `, [id]);

  const weeklyStats=await pool.query(`
    SELECT 
      to_char(d.day, 'Dy') AS day,
      COUNT(a.id)::int AS count
    FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) AS d(day)
    LEFT JOIN appointments a 
      ON a.clinic_id = $1 
     AND a.status = 'DISCHARGED' 
     AND date_trunc('day', a.created_at) = d.day
    GROUP BY d.day
    ORDER BY d.day ASC
  `, [id]);

  const recent=await pool.query(`
    SELECT a.id,a.patient_id,p.name AS patient_name,a.copay_amount,a.status,a.created_at 
    FROM appointments a 
    JOIN patients p ON p.id=a.patient_id 
    WHERE a.clinic_id=$1 
    ORDER BY 
      CASE a.status 
        WHEN 'WAITING' THEN 1 
        WHEN 'IN_CONSULTATION' THEN 2 
        ELSE 3 
      END, 
      a.created_at DESC 
    LIMIT 10
  `,[id]);

  return {
    clinic,
    counts:counts.rows,
    today:todayStats.rows[0],
    weeklyDischarges:weeklyStats.rows,
    recentAppointments:recent.rows
  };
}
