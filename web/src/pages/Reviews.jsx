import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Loading, ErrorState } from "../components/State";
import { Star } from "lucide-react";

export default function Reviews() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("ANALYTICS"); // "ANALYTICS" | "CATALOG"
  const [reviewData, setReviewData] = useState(null);
  const [catalogData, setCatalogData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchReviewsAndCatalog = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError("");

      try {
        const [reviewsRes, catalogRes] = await Promise.allSettled([
          api.get(`/reviews/analytics/${user.id}`),
          api.get("/medical-catalog"),
        ]);

        if (!cancelled) {
          if (reviewsRes.status === "fulfilled") {
            setReviewData(reviewsRes.value.data);
          }
          if (catalogRes.status === "fulfilled") {
            setCatalogData(catalogRes.value.data?.data || catalogRes.value.data || []);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load review analytics or medical catalog.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchReviewsAndCatalog();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Aggregate review data from $facet with 0 defaults
  const avgRating = reviewData?.overallAverage?.averageRating ?? 0;
  const totalReviews = reviewData?.overallAverage?.totalReviews ?? 0;

  const totalReviewCount = reviewData?.overallAverage?.totalReviews || 0;
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const item = (reviewData?.ratingDistribution || []).find((d) => Number(d.rating) === stars);
    const count = item ? Number(item.count) : 0;
    const pct = totalReviewCount > 0 ? Math.round((count / totalReviewCount) * 100) : 0;
    return { stars, pct, count };
  });

  const topTags = (reviewData?.topTags || []).map((t) => ({
    tag: t.tag.replace(/_/g, " "),
    count: Number(t.count),
    isNegative: t.tag === "long_wait",
  }));

  const sampleReviews = (reviewData?.recentReviews || []).map((rev) => ({
    stars: Number(rev.rating) || 5,
    tag: rev.tags?.[0]?.replace(/_/g, " ") || "feedback",
    text: rev.comment || `Patient reported ${rev.tags?.map((t) => t.replace(/_/g, " ")).join(", ") || "consultation experience"}.`,
    date: rev.created_at
      ? new Date(rev.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
      : "Recent",
  }));

  // Raw catalog document from MongoDB MedicalCatalogs
  const rawDocument = React.useMemo(() => {
    if (Array.isArray(catalogData) && catalogData.length > 0) {
      const match = catalogData.find(
        (c) => c.clinic_id === user?.id || c.name?.toLowerCase().includes(user?.name?.toLowerCase().split(" ")[0])
      );
      return match || catalogData[0];
    }
    return catalogData || null;
  }, [catalogData, user]);

  return (
    <div className="page-wrapper reviews-catalog-page">
      {/* Page Header */}
      <div className="page-header-simple">
        <h1 className="page-title">Reviews and catalog</h1>
        <p className="page-subtitle">
          Reviews and catalog documents for {user?.name || "Clinic"}.
        </p>
      </div>

      {/* Tab Switcher Pills */}
      <div className="view-toggle-pills-row">
        <button
          type="button"
          className={`toggle-tab-pill ${activeTab === "ANALYTICS" ? "active" : ""}`}
          onClick={() => setActiveTab("ANALYTICS")}
        >
          Review Analytics
        </button>
        <button
          type="button"
          className={`toggle-tab-pill ${activeTab === "CATALOG" ? "active" : ""}`}
          onClick={() => setActiveTab("CATALOG")}
        >
          Medical Catalog
        </button>
      </div>

      {error && <div className="alert-box alert-danger mb-3">{error}</div>}

      {/* VIEW A: Review Analytics (C5a_Reviews) */}
      {activeTab === "ANALYTICS" && (
        <div className="reviews-three-column-grid">
          {/* Column 1: Rating summary & distribution */}
          <div className="reviews-col-left">
            <div className="dashboard-card avg-rating-card">
              <span className="card-label">Average rating</span>
              <div className="avg-rating-val">★ {Number(avgRating).toFixed(1)} / 5.0</div>
              <span className="subtext-muted">{totalReviews} reviews</span>
            </div>

            <div className="dashboard-card rating-distribution-card">
              <h3 className="section-title">Rating distribution</h3>
              <div className="distribution-bars-list">
                {distribution.map((d) => (
                  <div key={d.stars} className="dist-row">
                    <span className="dist-star-label">{d.stars}★</span>
                    <div className="dist-bar-track">
                      <div className="dist-bar-fill" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="dist-pct-text">{d.pct}%</span>
                    <span className="dist-count-text">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Top Sentiment Tags */}
          <div className="dashboard-card sentiment-tags-card">
            <h3 className="section-title">Top sentiment tags</h3>
            <div className="sentiment-tags-list">
              {(() => {
                const maxTagCount = Math.max(...topTags.map((x) => Number(x.count) || 0), 1);
                return topTags.map((t) => {
                  const isNegative = t.tag === "long_wait";
                  const pct = Math.max(6, Math.round((Number(t.count) / maxTagCount) * 100));
                  return (
                    <div key={t.tag} className="tag-metric-row">
                      <div className="tag-metric-top">
                        <span className="tag-metric-name">{t.tag}</span>
                        <span className="tag-metric-count">{t.count}</span>
                      </div>
                      <div className="tag-bar-track">
                        <div
                          className={`tag-bar-fill ${isNegative ? "orange-fill" : "teal-fill"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Column 3: Recent Reviews Feed */}
          <div className="dashboard-card recent-reviews-card">
            <h3 className="section-title">Recent reviews</h3>
            <div className="reviews-feed-list">
              {sampleReviews.map((rev, idx) => (
                <div key={idx} className="review-feed-item">
                  <div className="review-feed-top">
                    <div className="stars-row">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={i < rev.stars ? "star-gold" : "star-gray"}
                          fill={i < rev.stars ? "#F59E0B" : "none"}
                        />
                      ))}
                    </div>
                    <span className={`tag-pill-sm ${rev.tag === "long_wait" ? "orange" : "teal"}`}>
                      {rev.tag}
                    </span>
                  </div>
                  <p className="review-text">{rev.text}</p>
                  <span className="review-date-text">{rev.date}</span>
                </div>
              ))}
              {sampleReviews.length === 0 && (
                <p className="text-muted py-4 text-center">No reviews recorded yet for this clinic.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: Medical Catalog (C5b_medical_catalog.png) */}
      {activeTab === "CATALOG" && (
        <div className="catalog-single-column">
          {/* Card 1: Specialist Availability */}
          <div className="dashboard-card specialist-availability-card mb-4">
            <h3 className="section-title">Specialist availability</h3>
            
            <div className="specialist-header-row">
              <div className="specialist-avatar-circle">
                {(catalogData?.specialist ? catalogData.specialist.split(" ").slice(-2).map(w => w[0]).join("") : "AR")}
              </div>
              <div className="specialist-info-col">
                <h4 className="specialist-name-bold">{catalogData?.specialist || "Dr. Anita Rao"}</h4>
                <span className="specialist-specialty-sub">{catalogData?.specialty || "Cardiology"}</span>
              </div>
            </div>

            <div className="specialist-section-group">
              <span className="specialist-label">Weekly slots</span>
              <div className="slots-pills-row">
                {(catalogData?.slots || ["Mon 09:00–13:00", "Wed 09:00–13:00", "Fri 14:00–18:00"]).map((slot, idx) => (
                  <span key={idx} className="slot-teal-pill">
                    {slot}
                  </span>
                ))}
              </div>
            </div>

            <div className="specialist-section-group">
              <span className="specialist-label">Mode</span>
              <div className="mode-pills-row">
                {(catalogData?.mode || ["in_person", "telehealth"]).map((m, idx) => {
                  const isInPerson = m === "in_person" || /in-person/i.test(m);
                  return (
                    <span
                      key={idx}
                      className={`mode-badge ${isInPerson ? "mode-in-person" : "mode-telehealth"}`}
                    >
                      {isInPerson ? "In-person" : "Telehealth"}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Medications & Formularies Table */}
          <div className="dashboard-card formularies-table-card">
            <h3 className="section-title">Medications and formularies</h3>
            <div className="table-responsive">
              <table className="wireframe-table">
                <thead>
                  <tr>
                    <th>Medication</th>
                    <th>Category</th>
                    <th>Dosage guideline</th>
                    <th>Copay tier</th>
                  </tr>
                </thead>
                <tbody>
                  {(catalogData?.formulary || [
                    { name: "Amlodipine", category: "Antihypertensive", dosage: "5 mg once daily", tier: 1 },
                    { name: "Metformin", category: "Antidiabetic", dosage: "500 mg twice daily", tier: 1 },
                    { name: "Atorvastatin", category: "Lipid lowering", dosage: "10 mg at night", tier: 2 },
                  ]).map((item, idx) => (
                    <tr key={idx}>
                      <td className="font-semibold">{item.name}</td>
                      <td>{item.category}</td>
                      <td>{item.dosage}</td>
                      <td>Tier {item.tier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
