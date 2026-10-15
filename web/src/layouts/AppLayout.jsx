import React, { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, Check, Plus, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const patientNav = [
  ["/patient/dashboard", "Dashboard"],
  ["/patient/appointments", "My Appointments"],
  ["/patient/book", "Book Appointment"],
  ["/patient/clinics", "Clinics"],
  ["/patient/wallet", "My Wallet"],
];

const clinicNav = [
  ["/clinic/dashboard", "Dashboard"],
  ["/clinic/patients", "Patients"],
  ["/clinic/nurse-map", "Nurse Map"],
  ["/clinic/analytics", "Analytics"],
  ["/clinic/reviews", "Reviews"],
];

export default function AppLayout() {
  const { user, demoProfiles, quickSwitch, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isPatient = user?.role === "patient";
  const nav = isPatient ? patientNav : clinicNav;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleProfileSwitch = async (role, id) => {
    try {
      await quickSwitch(role, id);
      setDropdownOpen(false);
      if (role === "patient") {
        navigate("/patient/dashboard");
      } else {
        navigate("/clinic/dashboard");
      }
    } catch (err) {
      console.error("Failed to switch profile:", err);
    }
  };

  // Formatted balance for top pill
  const balanceText =
    user?.hsa_balance != null
      ? ` · $${Number(user.hsa_balance).toFixed(2)}`
      : "";

  return (
    <div className="layout-root">
      {/* Top Navbar matching Figma wireframes */}
      <header className="top-navbar" ref={dropdownRef}>
        <div className="nav-container">
          <div className="nav-left">
            {/* Hamburger button visible only on mobile */}
            <button
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={22} />}
            </button>

            {/* Logo */}
            <div
              className="brand-logo"
              onClick={() =>
                navigate(isPatient ? "/patient/dashboard" : "/clinic/dashboard")
              }
              role="button"
              tabIndex={0}
            >
              <div className="logo-icon">
                <Plus size={16} strokeWidth={3} />
              </div>
              <span className="logo-text">CareConnect</span>
            </div>

            {/* Role indicator badge */}
            <span
              className={`view-pill-badge ${
                isPatient ? "patient-badge" : "clinic-badge"
              }`}
            >
              {isPatient ? "PATIENT VIEW" : "CLINIC VIEW"}
            </span>

            {/* Pill Navigation Links (Desktop only) */}
            <nav className="nav-links desktop-nav-links">
              {nav.map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right Action: Interactive Profile Switcher Pill (Desktop) */}
          <div className="nav-right desktop-actor-wrapper">
            <button
              type="button"
              className="actor-switcher-pill"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
            >
              <span
                className={`actor-badge ${isPatient ? "patient" : "clinic"}`}
              >
                {isPatient ? "P" : "C"}
              </span>
              <span className="actor-label">
                {isPatient ? "Patient" : "Clinic"} · {user?.name || "Select Profile"}
                {isPatient && balanceText}
              </span>
              <ChevronDown
                size={16}
                className={`chevron ${dropdownOpen ? "rotate" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Mobile Actor Subheader Bar matching M1_browse_mobile.png and M2_book_mobile.png */}
        <div
          className="mobile-actor-bar"
          onClick={() => setDropdownOpen((prev) => !prev)}
          role="button"
          tabIndex={0}
          aria-expanded={dropdownOpen}
        >
          <div className="mobile-actor-bar-left">
            <span className={`actor-badge ${isPatient ? "patient" : "clinic"}`}>
              {isPatient ? "P" : "C"}
            </span>
            <span className="mobile-actor-bar-name">
              {isPatient ? "Patient" : "Clinic"} · {user?.name || "Select Profile"}
              {isPatient && balanceText}
            </span>
          </div>
          <ChevronDown
            size={18}
            className={`chevron ${dropdownOpen ? "rotate" : ""}`}
          />
        </div>

        {/* Floating Dropdown Menu matching switch profiles.png */}
        {dropdownOpen && (
          <div className="profile-dropdown-menu">
            <div className="dropdown-section">
              <div className="dropdown-section-title">PATIENTS ({demoProfiles?.patients?.length || 0})</div>
              <div className="profiles-list">
                {demoProfiles?.patients?.map((p) => {
                  const isSelected =
                    isPatient && String(p.id) === String(user?.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`profile-item ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() => handleProfileSwitch("patient", p.id)}
                    >
                      <span className="dot patient-dot" />
                      <div className="profile-item-info">
                        <span className="profile-item-name">{p.name}</span>
                        {p.hsa_balance != null && (
                          <span className="profile-item-sub">
                            HSA: ${Number(p.hsa_balance).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check size={16} className="check-icon" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dropdown-divider" />

            <div className="dropdown-section">
              <div className="dropdown-section-title">CLINICS ({demoProfiles?.clinics?.length || 0})</div>
              <div className="profiles-list">
                {demoProfiles?.clinics?.map((c) => {
                  const isSelected =
                    !isPatient && String(c.id) === String(user?.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`profile-item ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() => handleProfileSwitch("clinic", c.id)}
                    >
                      <span className="dot clinic-dot" />
                      <div className="profile-item-info">
                        <span className="profile-item-name">{c.name}</span>
                        <span className="profile-item-sub">
                          {c.is_accepting_patients
                            ? "Accepting patients"
                            : "Closed"}
                        </span>
                      </div>
                      {isSelected && <Check size={16} className="check-icon" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dropdown-footer">
              <button
                type="button"
                className="footer-link"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate("/switch-profile");
                }}
              >
                View All Profiles (Two-Column View) →
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Left Sidebar Drawer */}
      <div
        className={`mobile-nav-backdrop ${mobileMenuOpen ? "active" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`mobile-left-sidebar ${mobileMenuOpen ? "open" : ""}`}
        aria-label="Mobile Navigation Drawer"
      >
        <div className="mobile-sidebar-header">
          <div
            className="brand-logo"
            onClick={() => {
              setMobileMenuOpen(false);
              navigate(isPatient ? "/patient/dashboard" : "/clinic/dashboard");
            }}
            role="button"
            tabIndex={0}
          >
            <div className="logo-icon">
              <Plus size={16} strokeWidth={3} />
            </div>
            <span className="logo-text">CareConnect</span>
          </div>
          <button
            type="button"
            className="mobile-sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current User Snapshot in Drawer */}
        <div className="mobile-sidebar-user-card">
          <span className={`actor-badge ${isPatient ? "patient" : "clinic"}`}>
            {isPatient ? "P" : "C"}
          </span>
          <div className="mobile-sidebar-user-info">
            <span className="mobile-sidebar-user-name">
              {user?.name || "Select Profile"}
            </span>
            <span className="mobile-sidebar-user-sub">
              {isPatient
                ? `Patient · HSA $${Number(user?.hsa_balance ?? 0).toFixed(2)}`
                : "Clinic Staff"}
            </span>
          </div>
        </div>

        {/* Vertical Nav Links */}
        <div className="mobile-sidebar-nav-group">
          <div className="mobile-sidebar-section-title">
            {isPatient ? "PATIENT MENU" : "CLINIC MENU"}
          </div>
          <nav className="mobile-drawer-links">
            {nav.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `mobile-nav-link ${isActive ? "active" : ""}`
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="mobile-nav-link-text">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer Action */}
        <div className="mobile-sidebar-footer">
          <button
            type="button"
            className="mobile-switch-button"
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/switch-profile");
            }}
          >
            Switch Profile →
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content-container">
        <Outlet />
      </main>
    </div>
  );
}
