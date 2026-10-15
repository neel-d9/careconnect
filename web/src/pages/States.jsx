import React from "react";
import { Ban, AlertCircle } from "lucide-react";

export default function States() {
  return (
    <div className="page-wrapper states-preview-page">
      <div className="page-header-simple">
        <h1 className="page-title">States for every screen: loading, empty and error</h1>
      </div>

      <div className="states-three-card-grid">
        {/* Card 1: Loading Skeleton */}
        <div className="dashboard-card state-card">
          <h2 className="state-card-title">Loading (skeleton)</h2>
          <div className="skeleton-container">
            <div className="skeleton-line" style={{ width: "100%" }} />
            <div className="skeleton-line" style={{ width: "75%" }} />
            <div className="skeleton-line" style={{ width: "100%" }} />
            <div className="skeleton-line" style={{ width: "60%" }} />
            <div className="skeleton-line" style={{ width: "100%" }} />
          </div>
        </div>

        {/* Card 2: Empty State */}
        <div className="dashboard-card state-card empty-state-card">
          <h2 className="state-card-title">Empty</h2>
          <div className="empty-content-wrap">
            <div className="empty-circle-icon">
              <Ban size={24} className="text-muted" />
            </div>
            <strong className="empty-title">No records found</strong>
            <p className="empty-subtext">Try a different filter or date range.</p>
            <button type="button" className="outline-teal-btn sm-btn">
              Clear filters
            </button>
          </div>
        </div>

        {/* Card 3: Error State */}
        <div className="dashboard-card state-card error-state-card">
          <h2 className="state-card-title">Error</h2>
          <div className="error-content-wrap">
            <div className="error-alert-box">
              <h3 className="error-alert-title">Something went wrong</h3>
              <p className="error-alert-desc">
                We could not load this data.
                <br />
                Check the connection and try again.
              </p>
            </div>
            <button type="button" className="solid-teal-btn sm-btn">
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
