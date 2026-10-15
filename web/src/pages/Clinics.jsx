import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Loading, ErrorState } from "../components/State";
import { Star } from "lucide-react";
import Pagination from "../components/Pagination";

export default function Clinics() {
  const navigate = useNavigate();
  const { demoProfiles } = useAuth();
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 4;

  useEffect(() => {
    let cancelled = false;
    const fetchClinicsList = async () => {
      setLoading(true);
      setError("");

      try {
        let list = demoProfiles?.clinics?.filter((c) => c.is_accepting_patients) || [];
        if (list.length === 0) {
          const { data } = await api.get("/auth/demo-profiles");
          list = data.clinics?.filter((c) => c.is_accepting_patients) || [];
        }

        if (!cancelled && list.length > 0) {
          setClinics(list);
          if (!selectedClinic || !list.some((c) => String(c.id) === String(selectedClinic.id))) {
            setSelectedClinic(list[0]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || "Unable to load demo clinics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchClinicsList();
    return () => {
      cancelled = true;
    };
  }, [demoProfiles?.clinics]);

  // Fetch reviews whenever selected clinic changes
  useEffect(() => {
    let cancelled = false;
    if (!selectedClinic?.id) return;

    const fetchClinicReviews = async () => {
      try {
        const { data } = await api.get(`/reviews/analytics/${selectedClinic.id}`);
        if (!cancelled) {
          setReviewData(data);
        }
      } catch {
        // Fallback to default wireframe stats if clinic has sparse reviews
      }
    };

    fetchClinicReviews();
    return () => {
      cancelled = true;
    };
  }, [selectedClinic?.id]);

  const avgRating = reviewData?.overallAverage?.averageRating ?? selectedClinic?.avg_rating ?? null;
  const totalReviews = reviewData?.overallAverage?.totalReviews ?? selectedClinic?.total_reviews ?? 0;
  const avgCopay = reviewData?.avg_copay ?? selectedClinic?.avg_copay ?? null;
  const dischargesMonth = reviewData?.discharges_month ?? selectedClinic?.discharges_month ?? 0;

  const totalReviewCount = reviewData?.overallAverage?.totalReviews || 0;
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const item = (reviewData?.ratingDistribution || []).find((d) => Number(d.rating) === stars);
    const count = item ? Number(item.count) : 0;
    const pct = totalReviewCount > 0 ? Math.round((count / totalReviewCount) * 100) : 0;
    return { stars, pct, count };
  });

  const topTags = (reviewData?.topTags || []).slice(0, 4).map((t) => ({
    tag: t.tag.replace(/_/g, " "),
    count: Number(t.count),
    isNegative: t.tag === "long_wait",
  }));
  const maxTagCount = Math.max(...topTags.map((x) => x.count), 1);

  const recentReviews = (reviewData?.recentReviews || []).map((rev) => ({
    stars: Number(rev.rating) || 5,
    text: rev.comment || `Patient reported ${rev.tags?.join(", ") || "satisfactory consultation"}.`,
    clinic: selectedClinic?.name || "Clinic",
    date: rev.created_at
      ? new Date(rev.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
      : "Recent",
  }));

  return (
    <div className="page-wrapper clinics-reviews-page">
      {/* Page Header */}
      <div className="page-header-simple">
        <h1 className="page-title">Clinics: reviews and analytics</h1>
        <p className="page-subtitle">Compare clinics before you book.</p>
      </div>

      {error && <div className="alert-box alert-danger mb-3">{error}</div>}

      <div className="clinics-split-layout">
        {/* Left Column: Selectable Clinic Cards */}
        <div className="clinics-cards-column">
          {loading && clinics.length === 0 ? (
            <Loading label="Loading clinics..." />
          ) : (
            <>
              {clinics
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((clinic, idx) => {
                  const isSelected = selectedClinic?.id === clinic.id;
                  const r = (isSelected && reviewData?.overallAverage?.averageRating != null)
                    ? Number(reviewData.overallAverage.averageRating).toFixed(1)
                    : clinic.avg_rating != null
                    ? Number(clinic.avg_rating).toFixed(1)
                    : "—";
                  const c = (isSelected && reviewData?.avg_copay != null)
                    ? Number(reviewData.avg_copay).toFixed(0)
                    : clinic.avg_copay != null
                    ? Number(clinic.avg_copay).toFixed(0)
                    : "—";

                  return (
                    <div
                      key={clinic.id}
                      className={`dashboard-card clinic-select-card ${
                        isSelected ? "card-selected" : ""
                      }`}
                      onClick={() => setSelectedClinic(clinic)}
                    >
                      <div className="card-inner-top">
                        <h3 className="clinic-card-name">{clinic.name}</h3>
                        <div className="clinic-rating-meta">
                          ★ {r} · Avg copay ${c}
                        </div>
                      </div>

                      <div className="card-inner-bottom">
                        <span className="status-pill accepting">Accepting</span>
                        <button
                          type="button"
                          className={isSelected ? "solid-teal-btn sm-btn" : "outline-teal-btn sm-btn"}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/patient/book?clinic=${clinic.id}`);
                          }}
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  );
                })}
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(clinics.length / pageSize)}
                totalItems={clinics.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>

        {/* Right Column: Detailed Analytics & Reviews for Selected Clinic */}
        <div className="clinic-details-column">
          {selectedClinic ? (
            <>
              {/* Header row with Book CTA */}
              <div className="detail-header-action-row">
                <h2 className="detail-clinic-title">{selectedClinic.name}</h2>
                <button
                  type="button"
                  className="solid-teal-btn book-at-clinic-btn"
                  onClick={() => navigate(`/patient/book?clinic=${selectedClinic.id}`)}
                >
                  Book at {selectedClinic.name.split(" ")[0]}
                </button>
              </div>

              {/* 4 Summary KPI Cards */}
              <div className="clinic-four-kpi-grid">
                <div className="dashboard-card kpi-card">
                  <span className="kpi-label">Average rating</span>
                  <div className="kpi-value">{avgRating != null ? `${Number(avgRating).toFixed(1)} / 5` : "—"}</div>
                </div>
                <div className="dashboard-card kpi-card">
                  <span className="kpi-label">Reviews</span>
                  <div className="kpi-value">{totalReviews}</div>
                </div>
                <div className="dashboard-card kpi-card">
                  <span className="kpi-label">Average copay</span>
                  <div className="kpi-value">{avgCopay != null ? `$${Number(avgCopay).toFixed(0)}` : "—"}</div>
                </div>
                <div className="dashboard-card kpi-card">
                  <span className="kpi-label">Discharges this month</span>
                  <div className="kpi-value">{dischargesMonth}</div>
                </div>
              </div>

              {/* Middle Grid: Rating distribution (Left) & Top tags (Right) */}
              <div className="distribution-tags-grid">
                {/* Rating Distribution */}
                <div className="dashboard-card rating-distribution-card">
                  <h3 className="section-title">Rating distribution</h3>
                  <div className="distribution-bars-list">
                    {distribution.map((d) => (
                      <div key={d.stars} className="dist-row">
                        <span className="dist-star-label">{d.stars}★</span>
                        <div className="dist-bar-track">
                          <div
                            className="dist-bar-fill"
                            style={{ width: `${d.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Sentiment Tags */}
                <div className="dashboard-card top-tags-card">
                  <h3 className="section-title">Top tags</h3>
                  <div className="sentiment-tags-list">
                    {topTags.length > 0 ? (
                      topTags.map((t) => (
                        <div key={t.tag} className="tag-metric-row">
                          <div className="tag-metric-top">
                            <span className="tag-metric-name">{t.tag}</span>
                            <span className="tag-metric-count">{t.count}</span>
                          </div>
                          <div className="tag-bar-track">
                            <div
                              className={`tag-bar-fill ${
                                t.isNegative ? "orange-fill" : "teal-fill"
                              }`}
                              style={{ width: `${Math.min(100, (t.count / maxTagCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted py-2">No sentiment tags recorded.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom: Recent Reviews */}
              <div className="dashboard-card recent-reviews-container-card">
                <h3 className="section-title">Recent reviews</h3>
                <div className="reviews-cards-row">
                  {recentReviews.length > 0 ? (
                    recentReviews.map((rev, idx) => (
                      <div key={idx} className="review-boxed-item">
                        <div className="stars-row mb-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className="star-gold"
                              fill={i < rev.stars ? "#F59E0B" : "#CBD5E1"}
                            />
                          ))}
                        </div>
                        <p className="review-body-text">{rev.text}</p>
                        <div className="review-footer-meta">
                          {rev.clinic} · {rev.date}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted py-2">No reviews recorded yet for this clinic.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="dashboard-card text-center py-5">
              <p className="text-muted">Select a clinic from the list on the left.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}