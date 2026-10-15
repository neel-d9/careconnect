import { pool } from '../config/postgres.js';
export async function windowAnalytics() {
const { rows } = await pool.query(   `SELECT *
    FROM clinic_window_analytics
    ORDER BY rev_date DESC, global_revenue_rank, clinic_name`
 );
return rows;
}

export async function windowAnalyticsRank(clinicName) {
  const { rows } = await pool.query(
    `SELECT global_revenue_rank
     FROM clinic_window_analytics
     WHERE clinic_name = $1
     limit 1`,
    [clinicName]
  );
  return rows;
}

export async function summary()
{
  const {rows}=await pool.query('SELECT * FROM mv_clinic_monthly_discharges ORDER BY month_period DESC, clinic_name');
  return rows;
}
export async function refresh()
{
  await pool.query('SELECT refresh_clinic_monthly_mv()');
}
