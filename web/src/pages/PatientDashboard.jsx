import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Loading, ErrorState } from "../components/State";

export default function PatientDashboard() {
  const { user, demoProfiles } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [topClinics, setTopClinics] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchDashboard = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError("");

      try {
        const dashRes = await api.get(`/patients/${user.id}/dashboard`);
        let demoClinicList = demoProfiles?.clinics?.filter((c) => c.is_accepting_patients) || [];
        if (demoClinicList.length === 0) {
          const { data: profileData } = await api.get("/auth/demo-profiles");
          demoClinicList = profileData.clinics?.filter((c) => c.is_accepting_patients) || [];
        }

        if (!cancelled) {
          setData(dashRes.data);
          const sorted = [...demoClinicList].sort((a, b) => (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0));
          setTopClinics(sorted.slice(0, 3));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || "Unable to load dashboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDashboard();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading && !data) return <Loading label="Loading patient dashboard..." />;
  if (error) return <ErrorState message={error} />;

  const patient = data?.patient || user;
  const recentAppointments = data?.recentAppointments || [];
  const recentAudit = data?.recentAudit || [];

  // Active appointment (WAITING or IN_CONSULTATION)
  const activeAppointment = recentAppointments.find(
    (a) => a.status === "WAITING" || a.status === "IN_CONSULTATION"
  );

  // Last deduction calculation
  const lastDebit = recentAudit.find((a) => a.action_type === "DEBIT");

  return (
    <div className="page-wrapper patient-dashboard-page">
      {/* Page Header */}
      <div className="page-header-simple">
        <h1 className="page-title">Welcome back, {patient?.name?.split(" ")[0] || "Patient"}</h1>
        <p className="page-subtitle">Your wallet, your appointment and what to do next.</p>
      </div>

      {/* Row 1: Three Summary Action Cards */}
      <div className="dash-top-grid">
        {/* Card 1: HSA Balance */}
        <div className="dashboard-card hsa-card">
          <span className="card-label">HSA balance</span>
          <div className="hsa-amount-display">
            ${Number(patient?.hsa_balance ?? 0).toFixed(2)}
          </div>
          <div className="card-bottom-row">
            <span className={lastDebit ? "subtext-danger-styled" : "subtext-muted"}>
              {lastDebit
                ? `Last deduction: -$${Number(lastDebit.amount_changed).toFixed(2)} on ${new Date(
                    lastDebit.timestamp
                  ).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`
                : "No recent deductions"}
            </span>
            <button
              type="button"
              className="outline-teal-btn"
              onClick={() => navigate("/patient/wallet")}
            >
              My Wallet
            </button>
          </div>
        </div>

        {/* Card 2: Active Appointment */}
        <div className="dashboard-card active-appt-card">
          <span className="card-label">Active appointment</span>
          {activeAppointment ? (
            <>
              <div className="appt-clinic-name">{activeAppointment.clinic_name}</div>
              <div className="status-badge-row">
                <span className={`status-pill ${activeAppointment.status.toLowerCase()}`}>
                  {activeAppointment.status}
                </span>
              </div>
              <div className="subtext-muted">
                {new Date(activeAppointment.created_at).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · Copay ${Number(activeAppointment.copay_amount).toFixed(2)}
              </div>
            </>
          ) : (
            <div className="no-active-appt">
              <div className="appt-clinic-name text-muted">No active appointment</div>
              <span className="status-pill discharged">DISCHARGED / READY</span>
              <div className="subtext-muted">You are eligible to book a new appointment.</div>
            </div>
          )}
        </div>

        {/* Card 3: Quick Action Buttons */}
        <div className="dashboard-card actions-card">
          <span className="card-label">What would you like to do?</span>
          <div className="action-buttons-group">
            <button
              type="button"
              className="solid-teal-btn"
              onClick={() => navigate("/patient/book")}
            >
              Book an appointment
            </button>
            <button
              type="button"
              className="outline-teal-btn full-width"
              onClick={() => navigate("/patient/clinics")}
            >
              Find a clinic by reviews
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Recent Activity Table (Left) + Top Rated Clinics (Right) */}
      <div className="dash-bottom-grid">
        {/* Left Column: Recent Deductions Table */}
        <div className="dashboard-card recent-activity-card">
          <h2 className="section-title">Recent deductions</h2>
          <div className="table-responsive">
            <table className="wireframe-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Clinic</th>
                  <th>Amount deducted</th>
                  <th>Balance after</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.filter((a) => a.action_type === "DEBIT").length > 0 ? (
                  recentAudit
                    .filter((a) => a.action_type === "DEBIT")
                    .slice(0, 5)
                    .map((log) => {
                      const dt = new Date(log.timestamp);
                      const dateStr = `${dt.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })} ${dt.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`;

                      return (
                        <tr key={log.id}>
                          <td>{dateStr}</td>
                          <td className="font-semibold">{log.clinic_name || "—"}</td>
                          <td className="amount-debit">
                            -${Number(log.amount_changed).toFixed(2)}
                          </td>
                          <td className="amount-balance font-semibold">
                            ${Number(log.balance_after).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      No recent deduction records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Top Rated Clinics */}
        <div className="dashboard-card top-clinics-card">
          <h2 className="section-title">Top rated clinics</h2>
          <div className="clinics-list-column">
            {topClinics.map((clinic) => {
              const displayRating = clinic.avg_rating ? Number(clinic.avg_rating).toFixed(1) : "—";
              return (
                <div key={clinic.id} className="clinic-list-item">
                  <div className="clinic-info">
                    <div className="clinic-name-text">{clinic.name}</div>
                    <div className="clinic-meta-text">
                      ★ {displayRating} · {clinic.is_accepting_patients ? "Accepting patients" : (clinic.avg_copay ? `$${Number(clinic.avg_copay).toFixed(0)} copay` : "Accepting patients")}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="solid-teal-btn sm-btn"
                    onClick={() => navigate(`/patient/book?clinic=${clinic.id}`)}
                  >
                    Book
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
