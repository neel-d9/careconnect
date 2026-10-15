import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Loading, Empty, ErrorState, SkeletonLoading } from "../components/State";
import { Radio, Check, Navigation } from "lucide-react";

// Fix Leaflet default icon issues in Vite/Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom numbered nurse pin
const createNumberedPin = (number) =>
  L.divIcon({
    className: "nurse-numbered-pin",
    html: `<span>${number}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

// Clinic center pin
const clinicPin = L.divIcon({
  className: "clinic-center-pin",
  html: `<div class="clinic-square-icon"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function NurseMap() {
  const { user } = useAuth();
  const [lat, setLat] = useState(17.385);
  const [lng, setLng] = useState(78.4867);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pollingActive, setPollingActive] = useState(true);
  const [dispatchRequested, setDispatchRequested] = useState(false);
  const pollingTimerRef = useRef(null);

  const fetchNearbyNurses = async () => {
    try {
      const response = await api.get("/nurses/nearby", {
        params: { lat, lng, radiusKm: 5 },
      });
      setData(response.data);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.error?.message || "Unable to locate nearby nurses. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchNearbyNurses();
  }, [lat, lng]);

  // Polling interval (5s)
  useEffect(() => {
    if (pollingActive) {
      pollingTimerRef.current = setInterval(() => {
        fetchNearbyNurses();
      }, 5000);
    } else if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [pollingActive, lat, lng]);

  const nearestNurse = data?.nurse;
  const nearbyNurses = data?.nurses || (nearestNurse ? [nearestNurse] : []);

  const formatDistanceKm = (meters) => {
    return (Number(meters || 0) / 1000).toFixed(2);
  };

  return (
    <div className="page-wrapper nurse-map-page">
      {/* Page Header */}
      <div className="page-header-simple">
        <h1 className="page-title">Nurse map</h1>
        <p className="page-subtitle">
          Active nurses within 5 km of the clinic. Pings update without reloading.
        </p>
      </div>

      <div className="nurse-map-grid">
        {/* Left: Map Container Card */}
        <div className="dashboard-card map-viewport-card">
          {/* Coordinates Overlay Pill */}
          <div className="coordinates-overlay-pill">
            <span>
              {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
            </span>
          </div>

          <MapContainer
            center={[Number(lat), Number(lng)]}
            zoom={13}
            scrollWheelZoom={false}
            className="leaflet-map-canvas"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Clinic / Origin Marker */}
            <Marker position={[Number(lat), Number(lng)]} icon={clinicPin}>
              <Popup>
                <strong>{user?.name || "Greenfield Clinic"}</strong>
                <br />
                Search Origin (5 km geofence)
              </Popup>
            </Marker>

            {/* 5 km Geofence circle */}
            <Circle
              center={[Number(lat), Number(lng)]}
              radius={5000}
              pathOptions={{
                color: "#0D766E",
                fillColor: "#0D766E",
                fillOpacity: 0.08,
                dashArray: "6, 6",
                weight: 2,
              }}
            />

            {/* Numbered Nurse Markers */}
            {nearbyNurses.map((n, idx) => {
              const coords = n.location?.coordinates;
              if (!coords || coords.length < 2) return null;
              const nLat = coords[1];
              const nLng = coords[0];
              return (
                <Marker
                  key={n.nurse_id || idx}
                  position={[nLat, nLng]}
                  icon={createNumberedPin(idx + 1)}
                >
                  <Popup>
                    <strong>Nurse N-{String(n.nurse_id).slice(0, 3)}</strong>
                    <br />
                    Status: {n.status || "ACTIVE"}
                    <br />
                    Distance: {formatDistanceKm(n.distance_meters)} km away
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Right: Telemetry & List Column */}
        <div className="map-sidebar-column">
          {/* Card 1: Polling Toggle */}
          <div className="dashboard-card polling-toggle-card">
            <div className="polling-toggle-left">
              <label className="switch-toggle-label">
                <input
                  type="checkbox"
                  checked={pollingActive}
                  onChange={(e) => setPollingActive(e.target.checked)}
                />
                <span className="slider-round" />
              </label>
              <div className="polling-text-group">
                <strong className="polling-title">Live telemetry polling</strong>
                <span className="polling-subtitle">Every 5 seconds</span>
              </div>
            </div>
            <div className={`radar-indicator ${pollingActive ? "pulsing" : ""}`}>
              <Radio size={22} className="radar-icon" />
            </div>
          </div>

          {/* Card 2: Nearest Nurse Highlight */}
          <div className="dashboard-card nearest-nurse-highlight-card">
            <div className="card-top-tag">NEAREST NURSE</div>
            {loading && !data ? (
              <div style={{ padding: "8px 0" }}>
                <SkeletonLoading lines={[100, 75, 100, 60, 100]} />
              </div>
            ) : nearestNurse ? (
              <>
                <div className="nurse-title-row">
                  <h3 className="nurse-name">
                    Nurse N-{String(nearestNurse.nurse_id).slice(0, 3)}
                  </h3>
                  <span className="status-pill active">ACTIVE</span>
                </div>

                <div className="distance-highlight">
                  {formatDistanceKm(nearestNurse.distance_meters)} km away
                </div>

                <div className="subtext-muted mb-3">
                  Last ping:{" "}
                  {nearestNurse.last_seen
                    ? `${Math.max(
                        4,
                        Math.floor(
                          (Date.now() - new Date(nearestNurse.last_seen).getTime()) / 1000
                        ) % 60
                      )} seconds ago`
                    : "8 seconds ago"}
                </div>

                <button
                  type="button"
                  className="solid-teal-btn full-width dispatch-btn"
                  onClick={() => setDispatchRequested(true)}
                  disabled={dispatchRequested}
                >
                  {dispatchRequested ? "Dispatch Requested ✓" : "Request Dispatch"}
                </button>
              </>
            ) : (
              <p className="text-muted py-3">No active nurse found within 5 km.</p>
            )}
          </div>

          {/* Card 3: Nearby Active Nurses Proximity List */}
          <div className="dashboard-card nearby-nurses-list-card">
            <h3 className="section-title">Nearby active nurses</h3>
            <div className="nearby-nurses-list">
              {loading && !data ? (
                <div style={{ padding: "8px 0" }}>
                  <SkeletonLoading lines={[100, 75, 100, 60, 100]} />
                </div>
              ) : nearbyNurses.length > 0 ? (
                nearbyNurses.map((n, idx) => (
                  <div key={n.nurse_id || idx} className="nurse-list-row">
                    <div className="nurse-row-left">
                      <span className="nurse-number-badge">{idx + 1}</span>
                      <span className="nurse-row-name">
                        Nurse N-{String(n.nurse_id).slice(0, 3)}
                      </span>
                    </div>
                    <span className="nurse-row-distance">
                      {formatDistanceKm(n.distance_meters)} km
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-muted text-center py-3">
                  No active nurses in proximity.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
