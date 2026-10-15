import React, { useEffect, useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Loading, ErrorState } from "../components/State";
import { RotateCw, Trophy } from "lucide-react";

export default function Analytics() {
  const { user } = useAuth();
  const [windowData, setWindowData] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedText, setLastRefreshedText] = useState("Just now");
  const [error, setError] = useState("");

  const fetchAnalytics = async () => {
    setLoading(true);
    setError("");

    try {
      const [windowRes, summaryRes] = await Promise.all([
        api.get("/analytics/window"),
        api.get("/analytics/summary"),
      ]);

      const winList = windowRes.data?.data || [];
      const sumList = summaryRes.data?.data || [];
      setWindowData(winList);
      setSummaryData(sumList);

      // Find user rank
      const clinicName = user?.name || "";
      const match = winList.find((item) =>
        (user?.id && String(item.clinic_id) === String(user.id)) ||
        (clinicName && item.clinic_name?.toLowerCase().includes(clinicName.toLowerCase().split(" ")[0]))
      );
      if (match) {
        setUserRank(match.global_revenue_rank || 1);
      } else {
        setUserRank(1);
      }
      setLastRefreshedText("Just now");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Unable to load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [user?.id]);

  // Handle materialized view concurrent refresh
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError("");

    try {
      await api.post("/analytics/refresh");
      await fetchAnalytics();
      setLastRefreshedText("Just now");
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Failed to refresh monthly summary metrics. Please try again."
      );
    } finally {
      setRefreshing(false);
    }
  };

  // Find user summary metrics from Materialized View
  const clinicSummary = useMemo(() => {
    const clinicName = user?.name || "";
    const found = summaryData.find((s) =>
      (user?.id && String(s.clinic_id) === String(user.id)) ||
      (clinicName && s.clinic_name?.toLowerCase().includes(clinicName.toLowerCase().split(" ")[0]))
    );
    return (
      found || {
        total_discharges: 0,
        total_copay_revenue: 0,
      }
    );
  }, [summaryData, user]);

  // Daily revenue + moving average chart data
  const chartData = useMemo(() => {
    const clinicName = user?.name || "";
    const clinicWindow = windowData.filter((w) =>
      (user?.id && String(w.clinic_id) === String(user.id)) ||
      (clinicName && w.clinic_name?.toLowerCase().includes(clinicName.toLowerCase().split(" ")[0]))
    );

    if (clinicWindow.length > 0) {
      return clinicWindow.slice(0, 7).map((item) => ({
        day: new Date(item.rev_date).toLocaleDateString("en-US", { weekday: "short" }),
        daily: Number(item.daily_copay_total || 0),
        movingAvg: Number(item.moving_7day_avg || 0),
      }));
    }

    return [];
  }, [windowData, user]);

  // Grouped leaderboard for DENSE_RANK table using real total_clinic_revenue
  const leaderboard = useMemo(() => {
    const map = new Map();
    windowData.forEach((w) => {
      if (!map.has(w.clinic_name)) {
        map.set(w.clinic_name, {
          clinic_id: w.clinic_id,
          clinic_name: w.clinic_name,
          rank: Number(w.global_revenue_rank || 1),
          daily: Number(w.daily_copay_total || 0),
          movingAvg: Number(w.moving_7day_avg || 0),
          totalRevenue: Number(w.total_clinic_revenue || w.daily_copay_total || 0),
        });
      }
    });

    const list = Array.from(map.values()).sort((a, b) => a.rank - b.rank);
    return list.slice(0, 5);
  }, [windowData]);

  return (
    <div className="page-wrapper analytics-page">
      {/* Page Header */}
      <div className="page-header-simple">
        <h1 className="page-title">Analytics: {user?.name || "Clinic"}</h1>
        <p className="page-subtitle">Your clinic's revenue and discharges.</p>
      </div>

      {error && <div className="alert-box alert-danger mb-3">{error}</div>}

      {/* Section 1: Monthly Discharges & Materialized View Refresh */}
      <div className="mv-section-header-row">
        <div className="mv-header-left">
          <h2 className="section-title">Monthly discharges and revenue</h2>
          <span className="last-refreshed-pill">
            Last refreshed: {lastRefreshedText}
          </span>
        </div>
        <button
          type="button"
          className="solid-teal-btn refresh-mv-btn"
          disabled={refreshing}
          onClick={handleRefresh}
        >
          <RotateCw size={16} className={`btn-icon ${refreshing ? "spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh materialized view"}
        </button>
      </div>

      {/* 3 Summary KPI Cards */}
      <div className="analytics-kpi-grid">
        <div className="dashboard-card kpi-card">
          <span className="kpi-label">Your discharges (month to date)</span>
          <div className="kpi-value">{clinicSummary.total_discharges ?? 0}</div>
        </div>

        <div className="dashboard-card kpi-card">
          <span className="kpi-label">Your copay revenue</span>
          <div className="kpi-value">
            ${Number(clinicSummary.total_copay_revenue ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="dashboard-card kpi-card">
          <span className="kpi-label">Your rank among clinics</span>
          <div className="kpi-value rank-value">#{userRank || 1}</div>
        </div>
      </div>

      {/* Section 2: Daily Copay & 7-Day Moving Average Chart */}
      <div className="dashboard-card chart-container-card">
        <h3 className="chart-title">Daily copay total and 7-day moving average</h3>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 13 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 13 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
              <Bar dataKey="daily" name="Daily Copay ($)" fill="#99F6E4" radius={[4, 4, 0, 0]} barSize={40} />
              <Line
                type="monotone"
                dataKey="movingAvg"
                name="7-Day Moving Avg ($)"
                stroke="#0F172A"
                strokeWidth={3}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section 3: Revenue Leaderboard (DENSE_RANK) Table */}
      <div className="dashboard-card leaderboard-card">
        <h3 className="section-title">Revenue leaderboard (DENSE_RANK)</h3>
        <div className="table-responsive">
          <table className="wireframe-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Clinic</th>
                <th>Daily revenue</th>
                <th>7-day moving avg</th>
                <th>Total revenue</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, idx) => {
                const isUser = (user?.id && String(row.clinic_id) === String(user.id)) ||
                  Boolean(user?.name && row.clinic_name?.toLowerCase().includes(user.name.split(" ")[0].toLowerCase()));
                return (
                  <tr key={idx} className={isUser ? "user-rank-highlight" : ""}>
                    <td>
                      <span className="rank-badge">#{row.rank}</span>
                    </td>
                    <td className="font-semibold">
                      {isUser ? `${user?.name || row.clinic_name} (you)` : row.clinic_name}
                    </td>
                    <td>${row.daily}</td>
                    <td>${row.movingAvg}</td>
                    <td className="font-semibold">${row.totalRevenue?.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
