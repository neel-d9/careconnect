import jwt from 'jsonwebtoken';
import { pool } from '../config/postgres.js';
import { httpError } from '../utils/httpError.js';
import { getMongoDb } from '../config/mongo.js';

export async function login({role, username, password}) 
{
  const expected = role === 'patient' ? 'admin' : role === 'clinic' ? 'root' : null;
  if (!expected || password !== expected) throw httpError(401,'INVALID_CREDENTIALS','Invalid role, ID, or password.');
  const table = role === 'patient' ? 'patients' : 'clinics';
  const { rows } = await pool.query(`SELECT id, name FROM ${table} WHERE id = $1`, [username]);
  if (!rows[0]) throw httpError(401,'INVALID_CREDENTIALS','Invalid role, ID, or password.');
  const user = { id: rows[0].id, name: rows[0].name, role };
  const token = jwt.sign({sub:user.id, role:user.role, name:user.name}, process.env.JWT_SECRET, {expiresIn:'8h'});
  return {user, token};
}

export async function getDemoProfiles() {
  const patientRes = await pool.query(`
    SELECT p.id, p.name, p.hsa_balance 
    FROM patients p 
    JOIN appointments a ON a.patient_id = p.id
    WHERE p.hsa_balance >= 100.00 
    GROUP BY p.id, p.name, p.hsa_balance 
    ORDER BY COUNT(a.id) DESC, p.name ASC 
    LIMIT 12
  `);
  const clinicRes = await pool.query(`
    SELECT 
      c.id, 
      c.name, 
      c.latitude, 
      c.longitude, 
      c.is_accepting_patients,
      COALESCE(ROUND(AVG(a.copay_amount), 2), 35.00)::numeric AS avg_copay
    FROM clinics c 
    JOIN appointments a ON a.clinic_id = c.id
    WHERE c.is_accepting_patients = TRUE 
    GROUP BY c.id, c.name, c.latitude, c.longitude, c.is_accepting_patients 
    ORDER BY COUNT(a.id) DESC, c.name ASC 
    LIMIT 12
  `);

  const clinicIds = clinicRes.rows.map(c => c.id);
  const ratingsMap = new Map();
  try {
    const mongoDb = getMongoDb();
    if (mongoDb) {
      const ratings = await mongoDb.collection('PatientReviews').aggregate([
        { $match: { clinic_id: { $in: clinicIds } } },
        {
          $group: {
            _id: '$clinic_id',
            rawRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 1,
            avgRating: { $round: ['$rawRating', 1] },
            totalReviews: 1,
          },
        },
      ]).toArray();
      ratings.forEach(r => ratingsMap.set(r._id, r));
    }
  } catch (err) {
    // Mongo rating aggregation fallback
  }

  const enrichedClinics = clinicRes.rows.map(c => {
    const r = ratingsMap.get(c.id);
    return {
      ...c,
      avg_copay: c.avg_copay != null ? Number(c.avg_copay) : null,
      avg_rating: r ? Number(r.avgRating) : null,
      total_reviews: r ? Number(r.totalReviews) : 0,
    };
  });

  return {
    patients: patientRes.rows,
    clinics: enrichedClinics
  };
}

export async function quickSwitch({ role, id }) {
  const table = role === 'patient' ? 'patients' : 'clinics';
  const query = role === 'patient' 
    ? 'SELECT id, name, hsa_balance FROM patients WHERE id = $1'
    : 'SELECT id, name FROM clinics WHERE id = $1';
  const { rows } = await pool.query(query, [id]);
  if (!rows[0]) throw httpError(404, 'USER_NOT_FOUND', 'Profile was not found.');
  const user = { 
    id: rows[0].id, 
    name: rows[0].name, 
    role, 
    hsa_balance: rows[0].hsa_balance != null ? Number(rows[0].hsa_balance) : undefined 
  };
  const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '8h' });
  return { user, token };
}

