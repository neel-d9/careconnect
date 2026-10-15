import React, { useEffect, useState, useMemo } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Loading, ErrorState } from "../components/State";
import { Search, ChevronDown, Check } from "lucide-react";
import Pagination from "../components/Pagination";

export default function ClinicPatients() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("TIME");
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [advancingId, setAdvancingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);

  const fetchClinicPatients = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");

    try {
      const response = await api.get(`/appointments/clinic/${encodeURIComponent(user.id)}`, {
        params: { page: 1, limit: 100 },
      });
      const list = response.data?.data || [];
      setAppointments(list);
      if (list.length > 0 && !selectedAppointment) {
        setSelectedAppointment(list[0]);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Unable to load clinic patients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinicPatients();
  }, [user?.id]);

  // Counts for tabs
  const counts = useMemo(() => {
    const waiting = appointments.filter((a) => a.status === "WAITING").length;
    const inConsult = appointments.filter((a) => a.status === "IN_CONSULTATION").length;
    const discharged = appointments.filter((a) => a.status === "DISCHARGED").length;
    return {
      all: appointments.length,
      waiting,
      inConsult,
      discharged,
    };
  }, [appointments]);

  // Filter & search
  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((a) => {
        if (activeTab === "WAITING") return a.status === "WAITING";
        if (activeTab === "IN_CONSULTATION") return a.status === "IN_CONSULTATION";
        if (activeTab === "DISCHARGED") return a.status === "DISCHARGED";
        return true;
      })
      .filter((a) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          a.patient_name?.toLowerCase().includes(q) ||
          a.patient_id?.toLowerCase().includes(q) ||
          a.id?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === "NAME") {
          return (a.patient_name || "").localeCompare(b.patient_name || "");
        }
        if (sortBy === "COPAY") {
          return Number(b.copay_amount || 0) - Number(a.copay_amount || 0);
        }
        // Default TIME (most recent first)
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [appointments, activeTab, searchQuery, sortBy]);

  // Handle advancing status (WAITING -> IN_CONSULTATION -> DISCHARGED)
  const handleAdvance = async (apt) => {
    if (!apt || advancingId) return;
    const nextStatus =
      apt.status === "WAITING"
        ? "IN_CONSULTATION"
        : apt.status === "IN_CONSULTATION"
        ? "DISCHARGED"
        : null;

    if (!nextStatus) return;

    setAdvancingId(apt.id);
    setError("");

    try {
      const { data } = await api.patch(`/appointments/${apt.id}/status`, {
        status: nextStatus,
      });

      // Update local state
      setAppointments((prev) =>
        prev.map((item) => (item.id === apt.id ? { ...item, status: nextStatus } : item))
      );

      if (selectedAppointment?.id === apt.id) {
        setSelectedAppointment((prev) => ({ ...prev, status: nextStatus }));
      }
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Failed to update appointment status. Check constraints."
      );
    } finally {
      setAdvancingId(null);
    }
  };

  const getStepIndex = (status) => {
    if (status === "WAITING") return 0;
    if (status === "IN_CONSULTATION") return 1;
    if (status === "DISCHARGED") return 2;
    return 0;
  };

  return (
    <div className="page-wrapper clinic-patients-page">
      {/* Header with DB Health Indicators */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Patients of this clinic</h1>
          <p className="page-subtitle">
            Only patients booked at {user?.name || "Greenfield Clinic"} are shown.
          </p>
        </div>
      </div>

      {/* Filter Tabs matching C2_Patients 1.png */}
      <div className="patients-filter-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === "ALL" ? "active" : ""}`}
          onClick={() => setActiveTab("ALL")}
        >
          All ({counts.all})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "WAITING" ? "active" : ""}`}
          onClick={() => setActiveTab("WAITING")}
        >
          Waiting ({counts.waiting})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "IN_CONSULTATION" ? "active" : ""}`}
          onClick={() => setActiveTab("IN_CONSULTATION")}
        >
          In consultation ({counts.inConsult})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "DISCHARGED" ? "active" : ""}`}
          onClick={() => setActiveTab("DISCHARGED")}
        >
          Discharged ({counts.discharged})
        </button>
      </div>

      {/* Search and Sort Toolbar */}
      <div className="patients-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search patient name or ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="sort-box">
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="TIME">Sort: Time</option>
            <option value="NAME">Sort: Name</option>
            <option value="COPAY">Sort: Copay</option>
          </select>
        </div>
      </div>

      {error && <div className="alert-box alert-danger mb-3">{error}</div>}

      {/* Main Grid: Patients Table (2/3) + Stepper Detail Panel (1/3) */}
      <div className="patients-split-grid">
        {/* Table Card */}
        <div className="dashboard-card patients-table-card">
          <div className="table-responsive">
            <table className="wireframe-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Copay</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && appointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4">
                      <Loading label="Loading patient records..." />
                    </td>
                  </tr>
                ) : filteredAppointments.length > 0 ? (
                  filteredAppointments
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((apt) => {
                    const isSelected = selectedAppointment?.id === apt.id;
                    const canAdvance =
                      apt.status === "WAITING" || apt.status === "IN_CONSULTATION";
                    const dt = new Date(apt.created_at);
                    const dateStr = `${dt.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })} ${dt.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`;

                    return (
                      <tr
                        key={apt.id}
                        className={`clickable-row ${isSelected ? "row-selected" : ""}`}
                        onClick={() => setSelectedAppointment(apt)}
                      >
                        <td className="patient-id-text">
                          P-{apt.patient_id ? String(apt.patient_id).slice(0, 5).toUpperCase() : "—"}
                        </td>
                        <td className="font-semibold">{apt.patient_name}</td>
                        <td>{dateStr}</td>
                        <td>${Number(apt.copay_amount).toFixed(2)}</td>
                        <td>
                          <span className={`status-pill ${apt.status.toLowerCase()}`}>
                            {apt.status}
                          </span>
                        </td>
                        <td>
                          {canAdvance ? (
                            <button
                              type="button"
                              className="outline-teal-btn sm-btn"
                              disabled={advancingId === apt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdvance(apt);
                              }}
                            >
                              {advancingId === apt.id ? "Updating..." : "Change Status"}
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No matching patient appointments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredAppointments.length / pageSize)}
            totalItems={filteredAppointments.length}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Right Stepper Detail Panel matching C2_Patients 1.png */}
        <div className="dashboard-card patient-detail-stepper-card">
          {selectedAppointment ? (
            <>
              <h2 className="detail-patient-name">{selectedAppointment.patient_name}</h2>

              <div className="detail-meta-group">
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Patient ID</span>
                  <span className="detail-meta-val">
                    P-{selectedAppointment.patient_id ? String(selectedAppointment.patient_id).slice(0, 5).toUpperCase() : "—"}
                  </span>
                </div>
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Appointment</span>
                  <span className="detail-meta-val">
                    {(() => {
                      const dt = new Date(selectedAppointment.created_at);
                      return `${dt.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })} ${dt.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`;
                    })()}
                  </span>
                </div>
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Copay</span>
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

              <p className="stepper-caption">
                Discharging frees the patient to book again.
              </p>
            </>
          ) : (
            <div className="no-selection-placeholder">
              <p className="text-muted">Select a patient from the list to view status and change status.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}