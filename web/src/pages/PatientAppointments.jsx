import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Loading, ErrorState } from "../components/State";
import Pagination from "../components/Pagination";

export default function PatientAppointments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ALL"); // "ALL" | "ACTIVE" | "DISCHARGED"
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    let cancelled = false;
    const fetchMyAppointments = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/appointments", {
          params: { page: 1, limit: 100, patientId: user.id },
        });

        if (!cancelled) {
          const list = response.data?.data || [];
          setAppointments(list);
          if (list.length > 0 && !selectedAppointment) {
            setSelectedAppointment(list[0]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || "Unable to load appointments.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMyAppointments();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Tab filter
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (activeTab === "ACTIVE") {
        return apt.status === "WAITING" || apt.status === "IN_CONSULTATION";
      }
      if (activeTab === "DISCHARGED") {
        return apt.status === "DISCHARGED";
      }
      return true;
    });
  }, [appointments, activeTab]);

  const getStepIndex = (status) => {
    if (status === "WAITING") return 0;
    if (status === "IN_CONSULTATION") return 1;
    if (status === "DISCHARGED") return 2;
    return 0;
  };

  return (
    <div className="page-wrapper patient-appointments-page">
      {/* Page Header */}
      <div className="page-header-simple">
        <h1 className="page-title">My Appointments</h1>
        <p className="page-subtitle">Only your own appointments are shown.</p>
      </div>

      {error && <div className="alert-box alert-danger mb-3">{error}</div>}

      {/* Filter Tabs matching P2_My_appointments 1.png */}
      <div className="patients-filter-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === "ALL" ? "active" : ""}`}
          onClick={() => setActiveTab("ALL")}
        >
          All
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "ACTIVE" ? "active" : ""}`}
          onClick={() => setActiveTab("ACTIVE")}
        >
          Active
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "DISCHARGED" ? "active" : ""}`}
          onClick={() => setActiveTab("DISCHARGED")}
        >
          Discharged
        </button>
      </div>

      {/* Main Grid: Appointments Table (2/3) + Detail Stepper Card (1/3) */}
      <div className="patients-split-grid mb-4">
        {/* Table Card */}
        <div className="dashboard-card patients-table-card">
          {/* Desktop Table View */}
          <div className="table-responsive desktop-only-table">
            <table className="wireframe-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Clinic</th>
                  <th>Date</th>
                  <th>Copay deducted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && appointments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4">
                      <Loading label="Loading your appointments..." />
                    </td>
                  </tr>
                ) : filteredAppointments.length > 0 ? (
                  filteredAppointments
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((apt) => {
                    const isSelected = selectedAppointment?.id === apt.id;
                    return (
                      <tr
                        key={apt.id}
                        className={`clickable-row ${isSelected ? "row-selected" : ""}`}
                        onClick={() => setSelectedAppointment(apt)}
                      >
                        <td className="patient-id-text">
                          APT-{apt.id ? String(apt.id).slice(0, 5).toUpperCase() : "—"}
                        </td>
                        <td className="font-semibold">{apt.clinic_name}</td>
                        <td>
                          {new Date(apt.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>${Number(apt.copay_amount).toFixed(2)}</td>
                        <td>
                          <span className={`status-pill ${apt.status.toLowerCase()}`}>
                            {apt.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      No appointments found in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View matching M1_browse_mobile.png */}
          <div className="mobile-only-cards-list">
            {loading && appointments.length === 0 ? (
              <div className="py-4 text-center">
                <Loading label="Loading your appointments..." />
              </div>
            ) : filteredAppointments.length > 0 ? (
              filteredAppointments
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((apt) => {
                  const isSelected = selectedAppointment?.id === apt.id;
                  return (
                    <div
                      key={apt.id}
                      className={`mobile-wireframe-card ${
                        isSelected ? "selected-card" : ""
                      }`}
                      onClick={() => setSelectedAppointment(apt)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="mobile-wireframe-card-top">
                        <span className="mobile-card-code">
                          APT-{apt.id ? String(apt.id).slice(0, 5).toUpperCase() : "—"}
                        </span>
                        <span className={`status-pill ${apt.status.toLowerCase()}`}>
                          {apt.status}
                        </span>
                      </div>
                      <div className="mobile-wireframe-card-mid">
                        <span className="mobile-card-title">{user?.name || "Patient"}</span>
                        <span className="mobile-card-fee">
                          ${Number(apt.copay_amount).toFixed(2)}
                        </span>
                      </div>
                      <div className="mobile-wireframe-card-bottom">
                        {apt.clinic_name} ·{" "}
                        {new Date(apt.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="text-center text-muted py-4">
                No appointments found in this category.
              </div>
            )}
            <div className="mobile-tap-hint">
              Showing {filteredAppointments.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredAppointments.length)} of {filteredAppointments.length} · tap a card to inspect status
            </div>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredAppointments.length / pageSize)}
            totalItems={filteredAppointments.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Right Detail Card matching P2_My_appointments 1.png */}
        <div className="dashboard-card patient-detail-stepper-card">
          {selectedAppointment ? (
            <>
              <h2 className="detail-patient-name">
                APT-{selectedAppointment.id ? String(selectedAppointment.id).slice(0, 5).toUpperCase() : "—"}
              </h2>

              <div className="detail-meta-group">
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Clinic</span>
                  <span className="detail-meta-val">{selectedAppointment.clinic_name}</span>
                </div>
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Date</span>
                  <span className="detail-meta-val">
                    {new Date(selectedAppointment.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Copay deducted</span>
                  <span className="detail-meta-val">
                    ${Number(selectedAppointment.copay_amount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Status Stepper Graphic */}
              <div className="status-stepper-container">
                <span className="stepper-title">Status</span>
                <div className="stepper-track-wrap">
                  <div className="stepper-track-line" />
                  <div
                    className={`stepper-node ${
                      getStepIndex(selectedAppointment.status) >= 0 ? "active" : ""
                    }`}
                  >
                    <span className="node-dot" />
                    <span className="node-label">WAITING</span>
                  </div>
                  <div
                    className={`stepper-node ${
                      getStepIndex(selectedAppointment.status) >= 1 ? "active" : ""
                    }`}
                  >
                    <span className="node-dot" />
                    <span className="node-label">IN_CONSULTATION</span>
                  </div>
                  <div
                    className={`stepper-node ${
                      getStepIndex(selectedAppointment.status) >= 2 ? "active" : ""
                    }`}
                  >
                    <span className="node-dot" />
                    <span className="node-label">DISCHARGED</span>
                  </div>
                </div>
              </div>

              <p className="stepper-caption">The clinic updates your status.</p>
            </>
          ) : (
            <div className="no-selection-placeholder">
              <p className="text-muted">Select an appointment to inspect its status.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Information Notice Banner */}
      <div className="bottom-notice-banner">
        <span>You can book a new appointment once your active one is discharged.</span>
      </div>
    </div>
  );
}