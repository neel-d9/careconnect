import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Loading } from "../components/State";
import { Check, AlertCircle, AlertTriangle, Building2, Info } from "lucide-react";

export default function BookAppointment() {
  const { user, refreshUser, demoProfiles } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedClinicId = searchParams.get("clinic");

  const [clinics, setClinics] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [copay, setCopay] = useState("35.00");
  const [loading, setLoading] = useState(false);

  // States
  const [successResult, setSuccessResult] = useState(null);
  const [insufficientError, setInsufficientError] = useState(null);
  const [activeConsultError, setActiveConsultError] = useState(null);
  const [genericError, setGenericError] = useState("");

  const currentBalance = Number(user?.hsa_balance ?? 0);
  const copayNum = Number(copay) || 0;
  const balanceAfter = Math.max(0, currentBalance - copayNum);

  // Load the 12 demo clinics so booked appointments can be viewed upon switching
  useEffect(() => {
    let cancelled = false;
    const loadClinics = async () => {
      try {
        let list = demoProfiles?.clinics?.filter((c) => c.is_accepting_patients) || [];
        if (list.length === 0) {
          const { data } = await api.get("/auth/demo-profiles");
          list = data.clinics?.filter((c) => c.is_accepting_patients) || [];
        }
        if (!cancelled && list.length > 0) {
          setClinics(list);
          if (requestedClinicId && list.some((c) => String(c.id) === String(requestedClinicId))) {
            setSelectedClinicId(requestedClinicId);
          } else if (!selectedClinicId || !list.some((c) => String(c.id) === String(selectedClinicId))) {
            setSelectedClinicId(String(list[0].id));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setGenericError("Unable to load demo clinics.");
        }
      }
    };

    loadClinics();
    return () => {
      cancelled = true;
    };
  }, [demoProfiles?.clinics, requestedClinicId]);

  const selectedClinic = clinics.find((c) => String(c.id) === String(selectedClinicId));
  useEffect(() => {
    if (selectedClinic?.avg_copay) {
      setCopay(Number(selectedClinic.avg_copay).toFixed(2));
    }
  }, [selectedClinic?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClinicId || loading) return;

    // Reset feedback states
    setSuccessResult(null);
    setInsufficientError(null);
    setActiveConsultError(null);
    setGenericError("");
    setLoading(true);

    try {
      const response = await api.post("/appointments/book", {
        patientId: user.id,
        clinicId: selectedClinicId,
        copayAmount: copayNum,
      });

      if (response.data?.success || response.data?.appointment) {
        setSuccessResult(response.data);
        if (refreshUser) refreshUser();
      }
    } catch (err) {
      const status = err.response?.status;
      const code = err.response?.data?.error?.code || "";
      const msg = err.response?.data?.error?.message || "";

      if (code === "INSUFFICIENT_HSA" || /insufficient/i.test(msg)) {
        setInsufficientError({
          currentBalance,
          requiredCopay: copayNum,
        });
      } else if (
        code === "ACTIVE_APPOINTMENT_CONFLICT" ||
        /active|consult|already/i.test(msg) ||
        status === 409
      ) {
        setActiveConsultError(true);
      } else {
        setGenericError(msg || "Failed to book appointment. Please check inputs.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper book-appointment-page">
      {/* Page Header */}
      <div className="page-header-simple">
        <h1 className="page-title">Book an appointment</h1>
        <p className="page-subtitle">
          Pick a clinic using its rating. The fee is deducted from your HSA wallet.
        </p>
      </div>

      <div className="book-layout-grid">
        {/* Left Card: Form */}
        <div className="dashboard-card new-appointment-form-card">
          <h2 className="section-title">New appointment</h2>

          {/* Patient balance card */}
          <div className="patient-balance-preview-box">
            <div className="patient-meta">
              <span className="patient-name-bold">{user?.name || "Patient"}</span>
              <span className="patient-balance-sub">HSA balance before</span>
            </div>
            <div className="patient-balance-val">
              ${currentBalance.toFixed(2)}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="booking-form">
            {/* Clinic Dropdown */}
            <div className="form-group">
              <label className="form-label" htmlFor="clinic-select">Clinic</label>
              <select
                id="clinic-select"
                className="form-select"
                value={selectedClinicId}
                onChange={(e) => setSelectedClinicId(e.target.value)}
                required
              >
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · Hyderabad
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Clinic Rating & Info Pill */}
            {selectedClinic && (
              <div className="clinic-meta-pill">
                ★ {selectedClinic.avg_rating ? Number(selectedClinic.avg_rating).toFixed(1) : "—"} · {selectedClinic.total_reviews ? selectedClinic.total_reviews.toLocaleString() : 0} reviews · Avg copay ${selectedClinic.avg_copay ? Number(selectedClinic.avg_copay).toFixed(0) : "35"} · Accepting
              </div>
            )}

            {/* Copay Amount */}
            <div className="form-group">
              <label className="form-label" htmlFor="copay-input">Copay amount</label>
              <input
                id="copay-input"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={copay}
                onChange={(e) => setCopay(e.target.value)}
                required
              />
            </div>

            {/* Math Breakdown Box */}
            <div className="math-breakdown-box">
              <div className="math-row">
                <span>Current balance</span>
                <span>${currentBalance.toFixed(2)}</span>
              </div>
              <div className="math-row">
                <span>Copay deduction</span>
                <span className="text-danger">-${copayNum.toFixed(2)}</span>
              </div>
              <div className="math-divider" />
              <div className="math-row math-total">
                <strong>Balance after booking</strong>
                <strong className="text-success">${balanceAfter.toFixed(2)}</strong>
              </div>
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              className="solid-teal-btn full-width submit-btn"
              disabled={loading || !selectedClinicId}
            >
              {loading ? "Confirming appointment..." : "Confirm & Book Appointment"}
            </button>
          </form>

          {genericError && <div className="alert-box alert-danger mt-3">{genericError}</div>}
        </div>

        {/* Right Column: Dynamic State Feedbacks */}
        <div className="feedback-states-column">
          {/* State 1: Success Alert & Confirmation */}
          {successResult && (
            <div className="feedback-card success-feedback-card">
              <div className="success-banner">
                <div className="success-icon-circle">
                  <Check size={18} strokeWidth={3} />
                </div>
                <span className="success-banner-text">
                  Appointment confirmed. ${copayNum.toFixed(2)} deducted from your wallet.
                </span>
              </div>

              <div className="success-balance-row">
                <span className="label-sub">Remaining HSA balance</span>
                <div className="new-balance-display">
                  ${(successResult.balance?.after ?? balanceAfter).toFixed(2)}
                </div>
              </div>

              {/* Wallet record for this booking */}
              <div className="wallet-record-subcard">
                <div className="wallet-record-title">Transaction Receipt</div>
                <div className="table-responsive">
                  <table className="wireframe-table compact-table">
                    <thead>
                      <tr>
                        <th>Receipt ID</th>
                        <th>Amount</th>
                        <th>Type</th>
                        <th>Balance After</th>
                        <th>Date & Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{successResult.audit?.id?.slice(0, 8) || "REC-" + (successResult.appointment?.id?.slice(0, 5) || "NEW").toUpperCase()}</td>
                        <td>${Number(successResult.audit?.amount_changed ?? copayNum).toFixed(2)}</td>
                        <td>
                          <span className="status-pill debit">
                            {successResult.audit?.action_type || "DEBIT"}
                          </span>
                        </td>
                        <td>${Number(successResult.balance?.after ?? balanceAfter).toFixed(2)}</td>
                        <td>
                          {new Date().toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* State 2: Insufficient HSA Funds (Red) */}
          {insufficientError && (
            <div className="feedback-card failure-feedback-card highlighted-state">
              <div className="feedback-card-header text-danger">
                <AlertCircle size={20} className="feedback-icon" />
                <h3 className="feedback-title">Insufficient HSA Balance</h3>
              </div>
              <p className="feedback-body">
                Your current wallet balance (${currentBalance.toFixed(2)}) is less than the required copay fee (${copayNum.toFixed(2)}).
                Please add funds to your HSA wallet or choose a clinic with a lower consultation fee.
              </p>
            </div>
          )}

          {/* State 3: Active Appointment Blocked (Amber) */}
          {activeConsultError && (
            <div className="feedback-card warning-feedback-card highlighted-state">
              <div className="feedback-card-header text-warning">
                <AlertTriangle size={20} className="feedback-icon" />
                <h3 className="feedback-title">Active Consultation in Progress</h3>
              </div>
              <p className="feedback-body">
                You already have an appointment that is waiting or currently in consultation. Patients can only hold one active consultation at a time.
              </p>
              <p className="feedback-subtext mt-2 text-muted">
                You will be able to book another appointment as soon as your current consultation is completed.
              </p>
            </div>
          )}

          {/* State 4: Default Clinic Overview (Before Booking) */}
          {!successResult && !insufficientError && !activeConsultError && selectedClinic && (
            <div className="clinic-preview-card">
              <div className="clinic-preview-header">
                <div className="clinic-icon-box">
                  <Building2 size={24} />
                </div>
                <div className="clinic-header-text">
                  <h3 className="clinic-name-heading">{selectedClinic.name}</h3>
                  <div className="clinic-rating-pill">
                    <span className="rating-star-tag">★ {selectedClinic.avg_rating ? Number(selectedClinic.avg_rating).toFixed(1) : "—"}</span>
                    <span>{selectedClinic.total_reviews ? selectedClinic.total_reviews.toLocaleString() : 0} patient reviews</span>
                    <span>·</span>
                    <span>Hyderabad</span>
                  </div>
                </div>
              </div>

              <div className="clinic-spec-list">
                <div className="clinic-spec-row">
                  <span className="spec-label">Service Type</span>
                  <span className="spec-value">On-Demand Teleconsultation</span>
                </div>
                <div className="clinic-spec-row">
                  <span className="spec-label">Availability</span>
                  <span className="spec-value text-success">Accepting Patients Today</span>
                </div>
                <div className="clinic-spec-row">
                  <span className="spec-label">Consultation Copay</span>
                  <span className="spec-value text-teal">${copayNum.toFixed(2)}</span>
                </div>
                <div className="clinic-spec-row">
                  <span className="spec-label">Payment Method</span>
                  <span className="spec-value">HSA Wallet (Instant Debit)</span>
                </div>
                <div className="clinic-spec-row">
                  <span className="spec-label">Estimated Wait Time</span>
                  <span className="spec-value">~5 - 10 minutes</span>
                </div>
              </div>

              <div className="clinic-notice-box">
                <Info size={16} className="text-muted flex-shrink-0" style={{ marginTop: "2px" }} />
                <span>
                  Your copay will be deducted from your HSA balance upon booking. Each patient can hold at most one active consultation at a time.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}