import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Loading, ErrorState } from "../components/State";

export default function ClinicDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchClinicDash = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError("");

      try {
        const response = await api.get(`/clinics/${user.id}/dashboard`);
        if (!cancelled) {
          setData(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || "Unable to load clinic dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchClinicDash();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const counts = useMemo(() => {
    const map = {};
    data?.counts?.forEach((c) => {
      map[c.status] = Number(c.count);
    });
    return {
      waiting: map.WAITING ?? 0,
      inConsult: map.IN_CONSULTATION ?? 0,
      dischargedToday: Number(data?.today?.discharged_today ?? (map.DISCHARGED ?? 0)),
      revenueToday: Number(data?.today?.revenue_today ?? 0),
    };
  }, [data]);

  const queueAppointments = useMemo(() => {
    return (data?.recentAppointments || []).slice(0, 5);
  }, [data]);

  // 7-day discharge volume chart data
  const weeklyDischarges = useMemo(() => {
    if (data?.weeklyDischarges?.length) {
      return data.weeklyDischarges.map((w) => ({
        day: w.day.charAt(0),
        count: Number(w.count),
      }));
    }
    return [];
  }, [data]);

  return (
    <div className="page-wrapper clinic-dashboard-page">
      {/* Page Header */}
      <div className="page-header-simple">
        <h1 className="page-title">{user?.name || "Clinic"} dashboard</h1>
        <p className="page-subtitle">Today at a glance. Only your clinic's data is shown.</p>
      </div>

      {error && <div className="alert-box alert-danger mb-3">{error}</div>}

      {/* 4 Summary KPI Cards matching C1_Dashboard 1.png */}
      <div className="clinic-four-kpi-grid mb-4">
        <div className="dashboard-card kpi-card kpi-waiting">
          <span className="kpi-label">Waiting</span>
          <div className="kpi-value">{counts.waiting}</div>
        </div>

        <div className="dashboard-card kpi-card kpi-consult">
          <span className="kpi-label">In consultation</span>
          <div className="kpi-value">{counts.inConsult}</div>
        </div>

        <div className="dashboard-card kpi-card kpi-discharged">
          <span className="kpi-label">Discharged today</span>
          <div className="kpi-value">{counts.dischargedToday}</div>
        </div>

        <div className="dashboard-card kpi-card kpi-revenue">
          <span className="kpi-label">Copay revenue today</span>
          <div className="kpi-value">${counts.revenueToday}</div>
        </div>
      </div>

      {/* Row 2: Today's Queue Table (Left) + Discharges 7-Day Chart (Right) */}
      <div className="clinic-dash-bottom-grid">
        {/* Left Column: Today's Queue */}
        <div className="dashboard-card queue-table-card">
          <h2 className="section-title">Today's queue</h2>
          <div className="table-responsive">
            <table className="wireframe-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queueAppointments.length > 0 ? (
                  queueAppointments.map((apt) => {
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
                        className="clickable-row"
                        onClick={() => navigate("/clinic/patients")}
                      >
                        <td className="patient-id-text">
                          APT-{apt.id ? String(apt.id).slice(0, 5).toUpperCase() : "—"}
                        </td>
                        <td className="font-semibold">{apt.patient_name}</td>
                        <td>{dateStr}</td>
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
                    <td colSpan={4} className="text-center text-muted py-4">
                      No appointments currently in queue today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: 7-Day Discharge Bar Chart */}
        <div className="dashboard-card discharge-chart-card">
          <h2 className="section-title">Discharges, last 7 days</h2>
          <div className="discharge-chart-wrapper">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weeklyDischarges} margin={{ top: 20, right: 10, bottom: 10, left: -20 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 13 }} />
                <YAxis hide domain={[0, 16]} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "6px",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#99F6E4"
                  radius={[6, 6, 0, 0]}
                  label={{ position: "top", fill: "#334155", fontSize: 12, fontWeight: 600 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
