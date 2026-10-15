import * as auth from '../services/auth.service.js';
import * as patients from '../services/patient.service.js';
import * as clinics from '../services/clinic.service.js';
import * as appointments from '../services/appointment.service.js';
import * as audit from '../services/audit.service.js';
import * as analytics from '../services/analytics.service.js';
import * as mongo from '../services/mongo.service.js';
import { httpError } from '../utils/httpError.js';

const pag = (total, page, limit) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const login = async (req, res, next) => {
  try {
    res.json({ success: true, ...(await auth.login(req.body)) });
  } catch (e) {
    next(e);
  }
};

export const demoProfiles = async (req, res, next) => {
  try {
    const data = await auth.getDemoProfiles();
    res.json({ success: true, ...data });
  } catch (e) {
    next(e);
  }
};

export const quickSwitch = async (req, res, next) => {
  try {
    const result = await auth.quickSwitch(req.body);
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
};

export const me = async (req, res) =>

  res.json({
    success: true,
    user: { id: req.user.sub, name: req.user.name, role: req.user.role },
  });

export const listPatients = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1),
      limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const r = await patients.listPatients({
      page,
      limit,
      search: req.query.search,
    });
    res.json({
      success: true,
      data: r.data,
      pagination: pag(r.total, page, limit),
    });
  } catch (e) {
    next(e);
  }
};
export const getPatient = async (req, res, next) => {
  try {
    const r = await patients.getPatient(req.params.id);
    if (!r) throw httpError(404, 'PATIENT_NOT_FOUND', 'Patient was not found.');
    res.json({ success: true, data: r });
  } catch (e) {
    next(e);
  }
};
export const patientDashboard = async (req, res, next) => {
  try {
    const r = await patients.getDashboard(req.params.id);
    if (!r) throw httpError(404, 'PATIENT_NOT_FOUND', 'Patient was not found.');
    res.json({ success: true, ...r });
  } catch (e) {
    next(e);
  }
};

export const listClinics = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1),
      limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const r = await clinics.listClinics({
      page,
      limit,
      search: req.query.search,
      accepting: req.query.accepting,
    });
    res.json({
      success: true,
      data: r.data,
      pagination: pag(r.total, page, limit),
    });
  } catch (e) {
    next(e);
  }
};

export const countClinics = async (req, res, next) => {
  try {
    const count = await clinics.countClinics();
    res.json({ success: true, count });
  } catch (e) {
    next(e);
  }
};

export const getClinic = async (req, res, next) => {
  try {
    const r = await clinics.getClinic(req.params.id);
    if (!r) throw httpError(404, 'CLINIC_NOT_FOUND', 'Clinic was not found.');
    res.json({ success: true, data: r });
  } catch (e) {
    next(e);
  }
};
export const clinicDashboard = async (req, res, next) => {
  try {
    const r = await clinics.getDashboard(req.params.id);
    if (!r) throw httpError(404, 'CLINIC_NOT_FOUND', 'Clinic was not found.');
    res.json({ success: true, ...r });
  } catch (e) {
    next(e);
  }
};

export const listAppointments = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1),
      limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const role = req.user.role;
    let patientId = req.query.patientId,
      clinicId = req.query.clinicId;
    if (role === 'patient') patientId = req.user.sub;
    if (role === 'clinic') clinicId = req.user.sub;
    const r = await appointments.listAppointments({
      page,
      limit,
      patientId,
      clinicId,
      status: req.query.status,
    });
    res.json({
      success: true,
      data: r.data,
      pagination: pag(r.total, page, limit),
    });
  } catch (e) {
    next(e);
  }
};


export const listClinicAppointments = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1),
      limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const role = req.user.role;
    let patientId = req.query.patientId,
      clinicId = req.query.clinicId;
    if (role === 'patient') patientId = req.user.sub;
    if (role === 'clinic') clinicId = req.user.sub;
    const r = await appointments.listClinicAppointments({
      page,
      limit,
      patientId,
      clinicId,
      status: req.query.status,
    });
    res.json({
      success: true,
      data: r.data,
      pagination: pag(r.total, page, limit),
    });
  } catch (e) {
    next(e);
  }
};

export const getAppointment = async (req, res, next) => {
  try {
    const r = await appointments.getAppointment(req.params.id);
    if (!r)
      throw httpError(
        404,
        'APPOINTMENT_NOT_FOUND',
        'Appointment was not found.',
      );
    res.json({ success: true, data: r });
  } catch (e) {
    next(e);
  }
};
export const book = async (req, res, next) => {
  try {
    if (req.user.role !== 'patient' || req.user.sub !== req.body.patientId)
      throw httpError(
        403,
        'FORBIDDEN',
        'You can only book an appointment for the signed-in patient.',
      );
    const { patientId, clinicId, copayAmount } = req.body;
    if (
      !patientId ||
      !clinicId ||
      !Number.isFinite(Number(copayAmount)) ||
      Number(copayAmount) <= 0
    )
      throw httpError(
        400,
        'INVALID_BOOKING',
        'Patient, clinic and a positive copay are required.',
      );
    res
      .status(201)
      .json({
        success: true,
        ...(await appointments.bookAppointment({
          patientId,
          clinicId,
          copayAmount: Number(copayAmount),
        })),
      });
  } catch (e) {
    next(e);
  }
};
export const status = async (req, res, next) => {
  try {
    const r = await appointments.getAppointment(req.params.id);
    if (!r)
      throw httpError(
        404,
        'APPOINTMENT_NOT_FOUND',
        'Appointment was not found.',
      );
    if (req.user.role === 'patient' && r.patient_id !== req.user.sub)
      throw httpError(403, 'FORBIDDEN', 'You cannot update this appointment.');
    if (req.user.role === 'clinic' && r.clinic_id !== req.user.sub)
      throw httpError(403, 'FORBIDDEN', 'You cannot update this appointment.');
    res.json({
      success: true,
      data: await appointments.updateStatus(req.params.id, req.body.status),
    });
  } catch (e) {
    next(e);
  }
};

export const getAudit = async (req, res, next) => {
  try {
    if (req.user.role === 'patient' && req.user.sub !== req.params.patientId)
      throw httpError(
        403,
        'FORBIDDEN',
        'You can only view your own HSA audit.',
      );
    const page = Math.max(1, Number(req.query.page) || 1),
      limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const r = await audit.getAudit(req.params.patientId, {
      from: req.query.from,
      to: req.query.to,
      page,
      limit,
    });
    res.json({
      success: true,
      data: r.data,
      pagination: pag(r.total, page, limit),
    });
  } catch (e) {
    next(e);
  }
};

export const patientDashboardAlias = patientDashboard;
export const analyticsWindow = async (req, res, next) => {
  try {
    res.json({ success: true, data: await analytics.windowAnalytics() });
  } catch (e) {
    next(e);
  }
};

export const analyticsWindowRank = async (req, res, next) => {
  try {
    res.json({ success: true, data: await analytics.windowAnalyticsRank(req.params.name) });
  } catch (e) {
    next(e);
  }
};
export const analyticsSummary = async (req, res, next) => {
  try {
    res.json({ success: true, data: await analytics.summary() });
  } catch (e) {
    next(e);
  }
};
export const analyticsRefresh = async (req, res, next) => {
  try {
    await analytics.refresh();
    res.json({ success: true, message: 'Analytics refreshed successfully.' });
  } catch (e) {
    next(e);
  }
};
export const nearbyNurse = async (req, res, next) => {
  try {
    const lat = Number(req.query.lat),
      lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      throw httpError(
        400,
        'INVALID_COORDINATES',
        'Valid latitude and longitude are required.',
      );
    const result = await mongo.nearbyNurse({
      lat,
      lng,
      radiusKm: req.query.radiusKm,
    });
    res.json({
      success: true,
      origin: { lat, lng },
      nurse: result.nurse,
      nurses: result.nurses || (result.nurse ? [result.nurse] : []),
    });
  } catch (e) {
    next(e);
  }
};

export const reviews = async (req, res, next) => {
  try {
    const clinicId = req.params.id;
    const result = await mongo.reviewAnalytics(clinicId);

    let avgCopay = null;
    let dischargesMonth = 0;
    try {
      const copayRes = await pool.query(
        'SELECT ROUND(AVG(copay_amount), 2) AS avg_copay FROM appointments WHERE clinic_id = $1',
        [clinicId]
      );
      if (copayRes.rows[0]?.avg_copay) {
        avgCopay = Number(copayRes.rows[0].avg_copay);
      }
      const monthRes = await pool.query(
        'SELECT total_discharges FROM mv_clinic_monthly_discharges WHERE clinic_id = $1 ORDER BY month_period DESC LIMIT 1',
        [clinicId]
      );
      if (monthRes.rows[0]?.total_discharges) {
        dischargesMonth = Number(monthRes.rows[0].total_discharges);
      }
    } catch (pgErr) {
      console.warn('PG review stats lookup warning:', pgErr.message);
    }

    res.json({
      success: true,
      ...result,
      avg_copay: avgCopay,
      discharges_month: dischargesMonth,
    });
  } catch (e) {
    console.error('Review analytics failed:', e);
    next(e);
  }
};
export const catalog = async (req, res, next) => {
  try {
    const data = await mongo.medicalCatalog();
    if (data === null)
      throw httpError(
        404,
        'CATALOG_UNAVAILABLE',
        'MedicalCatalogs is not present in the inherited MongoDB database.',
      );
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};
