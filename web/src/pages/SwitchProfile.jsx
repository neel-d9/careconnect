import React from "react";
import { useNavigate } from "react-router-dom";
import { Check, UserRound, Building2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function SwitchProfile() {
  const { user, demoProfiles, quickSwitch } = useAuth();
  const navigate = useNavigate();

  const isPatient = user?.role === "patient";

  const handleSelect = async (role, id) => {
    try {
      await quickSwitch(role, id);
      if (role === "patient") {
        navigate("/patient/dashboard");
      } else {
        navigate("/clinic/dashboard");
      }
    } catch (err) {
      console.error("Failed to switch profile:", err);
    }
  };

  const patientsList = demoProfiles?.patients || [];
  const clinicsList = demoProfiles?.clinics || [];

  return (
    <div className="page-wrapper switch-profile-page">
      <div className="page-header-simple">
        <h1 className="page-title">Select a Demo Profile</h1>
        <p className="page-subtitle">
          Choose a patient or clinic account to explore CareConnect with pre-seeded data.
        </p>
      </div>

      <div className="switch-two-col-grid">
        {/* Column 1: Patients List */}
        <div className="profile-column-card">
          <div className="profile-col-header">
            <div className="profile-col-title-group">
              <UserRound size={20} className="text-teal" />
              <h2 className="profile-col-title">Patients</h2>
            </div>
            <span className="profile-col-count-pill">
              {patientsList.length} Demo Accounts
            </span>
          </div>

          <div className="profile-picker-scroll-list">
            {patientsList.map((p) => {
              const isSelected = isPatient && String(p.id) === String(user?.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`profile-card-btn ${isSelected ? "active" : ""}`}
                  onClick={() => handleSelect("patient", p.id)}
                >
                  <div className="profile-card-left">
                    <span className="dot patient-dot" />
                    <div>
                      <div className="profile-card-name">{p.name}</div>
                      <div className="profile-card-sub">
                        HSA Balance:{" "}
                        <span className="profile-card-hsa">
                          ${Number(p.hsa_balance ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check size={18} className="check-icon" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: Clinics List */}
        <div className="profile-column-card">
          <div className="profile-col-header">
            <div className="profile-col-title-group">
              <Building2 size={20} style={{ color: "#0F172A" }} />
              <h2 className="profile-col-title">Clinics</h2>
            </div>
            <span className="profile-col-count-pill">
              {clinicsList.length} Facilities
            </span>
          </div>

          <div className="profile-picker-scroll-list">
            {clinicsList.map((c) => {
              const isSelected = !isPatient && String(c.id) === String(user?.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`profile-card-btn ${isSelected ? "active" : ""}`}
                  onClick={() => handleSelect("clinic", c.id)}
                >
                  <div className="profile-card-left">
                    <span className="dot clinic-dot" />
                    <div>
                      <div className="profile-card-name">{c.name}</div>
                      <div className="profile-card-sub">
                        {c.is_accepting_patients ? (
                          <span className="text-success font-medium">Accepting Patients</span>
                        ) : (
                          <span className="text-muted">Closed</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check size={18} className="check-icon" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
