import React, { useEffect, useState, useMemo } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Loading, ErrorState } from "../components/State";
import Pagination from "../components/Pagination";

export default function Wallet() {
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const fetchWalletData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");

    try {
      const [patientRes, auditRes] = await Promise.all([
        api.get(`/patients/${user.id}`),
        api.get(`/patients/${user.id}/audit`, {
          params: { page: 1, limit: 100 },
        }),
      ]);

      setPatient(patientRes.data?.data || null);
      setAuditLogs(auditRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Unable to load wallet data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, [user?.id]);

  // Filtered logs based on date and action
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (actionFilter !== "ALL" && log.action_type !== actionFilter) {
        return false;
      }
      if (startDate) {
        const logDate = new Date(log.timestamp);
        const start = new Date(startDate);
        if (logDate < start) return false;
      }
      if (endDate) {
        const logDate = new Date(log.timestamp);
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        if (logDate > end) return false;
      }
      return true;
    });
  }, [auditLogs, actionFilter, startDate, endDate]);

  // Aggregate totals
  const totals = useMemo(() => {
    let deducted = 0;
    let added = 0;
    auditLogs.forEach((log) => {
      const amt = Number(log.amount_changed || 0);
      if (log.action_type === "DEBIT") {
        deducted += amt;
      } else {
        added += amt;
      }
    });

    return {
      currentBalance: Number(patient?.hsa_balance ?? user?.hsa_balance ?? 0),
      deducted,
      added,
    };
  }, [auditLogs, patient, user]);

  return (
    <div className="page-wrapper wallet-page">
      {/* Page Header */}
      <div className="page-header-simple">
        <h1 className="page-title">My Wallet</h1>
        <p className="page-subtitle">Your HSA balance and every amount deducted or added.</p>
      </div>

      {error && <div className="alert-box alert-danger mb-3">{error}</div>}

      {/* 3 KPI Summary Cards matching P5_My_wallet 1.png */}
      <div className="analytics-kpi-grid mb-4">
        <div className="dashboard-card kpi-card">
          <span className="kpi-label">Current HSA balance</span>
          <div className="kpi-value text-teal">
            ${totals.currentBalance.toFixed(2)}
          </div>
        </div>

        <div className="dashboard-card kpi-card">
          <span className="kpi-label">Total deducted (copays)</span>
          <div className="kpi-value">
            ${totals.deducted.toFixed(2)}
          </div>
        </div>

        <div className="dashboard-card kpi-card">
          <span className="kpi-label">Total added</span>
          <div className="kpi-value">
            ${totals.added.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="dashboard-card wallet-filter-card mb-4">
        <div className="filter-controls-row">
          <div className="form-group-inline">
            <label className="filter-label">Start date</label>
            <input
              type="date"
              className="filter-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="form-group-inline">
            <label className="filter-label">End date</label>
            <input
              type="date"
              className="filter-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="form-group-inline">
            <label className="filter-label">Action</label>
            <select
              className="filter-select"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="ALL">Action: All</option>
              <option value="DEBIT">Action: DEBIT only</option>
              <option value="CREDIT">Action: CREDIT only</option>
            </select>
          </div>

          <button
            type="button"
            className="solid-teal-btn apply-filter-btn"
            onClick={fetchWalletData}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Audit Ledger Table Card */}
      <div className="dashboard-card audit-table-card">
        <div className="table-responsive">
          <table className="wireframe-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Transaction ID</th>
                <th>Action type</th>
                <th>Amount</th>
                <th>Running balance after</th>
              </tr>
            </thead>
            <tbody>
              {loading && auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4">
                    <Loading label="Loading wallet audit logs..." />
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((log) => {
                  const isDebit = log.action_type === "DEBIT";
                  return (
                    <tr key={log.id}>
                      <td>
                        {new Date(log.timestamp).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="log-id-mono">
                        LOG-{String(log.id).slice(0, 5).toUpperCase()}
                      </td>
                      <td>
                        <span className={`status-pill ${isDebit ? "debit" : "credit"}`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className={isDebit ? "amount-debit" : "amount-credit"}>
                        {isDebit ? "-" : "+"} ${Number(log.amount_changed).toFixed(2)}
                      </td>
                      <td className="font-semibold">
                        ${Number(log.balance_after).toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    No wallet audit log entries match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredLogs.length / pageSize)}
          totalItems={filteredLogs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
