import { pool } from '../config/postgres.js';
import { httpError } from '../utils/httpError.js';

export async function listAppointments({page=1,limit=20,patientId,clinicId,status})
{
  const offset=(page-1)*limit; 
  const values=[]; 
  const c=[];
  if(patientId)
  {
      values.push(patientId);
      c.push(`a.patient_id=$${values.length}`);
  }
  if(clinicId)
  {
    values.push(clinicId);
    c.push(`a.clinic_id=$${values.length}`);
  }
  if(status)
  {
    values.push(status);
    c.push(`a.status=$${values.length}`);
  }
  const where=c.length?`WHERE ${c.join(' AND ')}`:'';
  const count=await pool.query(`SELECT COUNT(*)::int total FROM appointments a ${where}`,values);
  const orderBy = (clinicId && !patientId)
    ? `ORDER BY CASE a.status WHEN 'WAITING' THEN 1 WHEN 'IN_CONSULTATION' THEN 2 ELSE 3 END, a.created_at DESC`
    : `ORDER BY a.created_at DESC`;
  values.push(limit, offset);
  const data = await pool.query(`SELECT a.id,a.patient_id,p.name patient_name,a.clinic_id,c.name clinic_name,a.copay_amount,a.status,a.created_at FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN clinics c ON c.id=a.clinic_id ${where} ${orderBy} LIMIT $${values.length-1} OFFSET $${values.length}`,values);
  return {
    data:data.rows,
    total:count.rows[0].total
  };
}

export async function listClinicAppointments({page=1,limit=20,patientId,clinicId,status})
{
  const offset=(page-1)*limit; 
  const values=[]; 
  const c=[];
  if(patientId)
  {
      values.push(patientId);
      c.push(`a.patient_id=$${values.length}`);
  }
  if(clinicId)
  {
    values.push(clinicId);
    c.push(`a.clinic_id=$${values.length}`);
  }
  if(status)
  {
    values.push(status);
    c.push(`a.status=$${values.length}`);
  }
  const where=c.length?`WHERE ${c.join(' AND ')}`:'';
  const count=await pool.query(`SELECT COUNT(*)::int total FROM appointments a ${where}`,values);
  const orderBy = `ORDER BY CASE a.status WHEN 'WAITING' THEN 1 WHEN 'IN_CONSULTATION' THEN 2 ELSE 3 END, a.created_at DESC`;
  values.push(limit,offset);
  const data = await pool.query(`SELECT a.id,a.patient_id,p.name patient_name,a.clinic_id,c.name clinic_name,a.copay_amount,a.status,a.created_at FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN clinics c ON c.id=a.clinic_id ${where} ${orderBy} LIMIT $${values.length-1} OFFSET $${values.length}`,values);
  return {
    data:data.rows,
    total:count.rows[0].total
  };
}

export async function getAppointment(id)
{
  const {rows}=await pool.query(`SELECT a.id,a.patient_id,p.name patient_name,a.clinic_id,c.name clinic_name,a.copay_amount,a.status,a.created_at FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN clinics c ON c.id=a.clinic_id WHERE a.id=$1`,[id]);
  return rows[0]||null;
}

export async function bookAppointment({patientId,clinicId,copayAmount})
{
  const beforeQ = await pool.query('SELECT hsa_balance FROM patients WHERE id=$1',[patientId]);

  if(!beforeQ.rows[0]) throw httpError(404,'PATIENT_NOT_FOUND','Patient was not found.');
  
  const before=Number(beforeQ.rows[0].hsa_balance); 
  const started=new Date();
  try { 

    await pool.query('CALL sp_book_appointment($1,$2,$3)',[patientId,clinicId,copayAmount]);
  } catch(err){
    const msg=String(err.message||'');
    if(/insufficient|hsa|balance/i.test(msg)) throw httpError(409,'INSUFFICIENT_HSA','The patient does not have enough HSA balance for this copay.');
    if(/active|unique|duplicate|consult/i.test(msg)) throw httpError(409,'ACTIVE_APPOINTMENT_CONFLICT','The patient already has an active appointment.');
    if(/clinic/i.test(msg)) throw httpError(404,'CLINIC_NOT_FOUND','Clinic was not found or cannot accept the appointment.');
    throw err;
  }
  const afterQ = await pool.query('SELECT hsa_balance FROM patients WHERE id=$1',[patientId]);
  const appointmentQ = await pool.query(`SELECT a.id,a.patient_id,a.clinic_id,a.copay_amount,a.status,a.created_at FROM appointments a WHERE a.patient_id=$1 AND a.clinic_id=$2 AND a.created_at >= $3 ORDER BY a.created_at DESC LIMIT 1`,[patientId,clinicId,started]);
  const auditQ=await pool.query(`SELECT id,amount_changed,action_type,balance_after,timestamp FROM wallet_audit_logs WHERE patient_id=$1 AND timestamp >= $2 ORDER BY timestamp DESC LIMIT 1`,[patientId,started]);
  
  return {
    appointment:appointmentQ.rows[0]||null,
    balance:{before,after:Number(afterQ.rows[0].hsa_balance)},
    audit:auditQ.rows[0]||null};
}



export async function updateStatus(id,status){
  const allowed=['WAITING','IN_CONSULTATION','DISCHARGED'];
  if(!allowed.includes(status)) throw httpError(400,'INVALID_STATUS','Invalid appointment status.');
  try { 
    const {rows}=await pool.query('UPDATE appointments SET status=$1 WHERE id=$2 RETURNING id,patient_id,clinic_id,copay_amount,status,created_at',[status,id]); 
    if(!rows[0]) throw httpError(404,'APPOINTMENT_NOT_FOUND','Appointment was not found.'); 
    return rows[0]; 
  }
  catch(err)
    { 
      if(err.code==='23505') throw httpError(409,'ACTIVE_APPOINTMENT_CONFLICT','The patient cannot have more than one active appointment.'); 
      throw err; 
    }
}
