# CareConnect — API Endpoints Specification

**Course:** CS6.302 Software System Development  
**Deliverable:** Assignment 2 (Step 1 — API Design Sketch)  

This document lists the REST API endpoints exposed by our Express server (`api/`) to connect the React frontend with PostgreSQL and MongoDB.

---

## 1. Global Conventions

### 1.1 Base URL
```text
http://localhost:5000/api
```

### 1.2 Authentication
All protected routes require a standard Bearer Token header:
```text
Authorization: Bearer <jwt_token>
```
Tokens encode the user's UUID (`sub`), name (`name`), and role (`role: 'patient' | 'clinic'`).

### 1.3 Error Format
All errors follow a unified JSON schema:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation of what went wrong."
  }
}
```

---

## 2. Authentication & Actor Switching Endpoints

### 2.1 Demo Login
- **Endpoint**: `POST /api/auth/login`
- **Access**: Public
- **Description**: Authenticates a demo actor using seeded UUID credentials.
- **Request Body**:
  ```json
  {
    "role": "patient",
    "username": "88c0512a-34d7-42f9-a590-fd0b0fbcaddd",
    "password": "admin"
  }
  ```
  *(For clinic: `"role": "clinic"`, `"password": "root"`)*
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "user": {
      "id": "88c0512a-34d7-42f9-a590-fd0b0fbcaddd",
      "name": "Donald Roberts",
      "role": "patient"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Error Cases**:
  - `401 INVALID_CREDENTIALS`: Password does not match demo credentials or UUID not found in PostgreSQL.

---

### 2.2 Get Demo Profiles
- **Endpoint**: `GET /api/auth/demo-profiles`
- **Access**: Public
- **Description**: Returns a randomized set of 12 patients and 12 clinics from PostgreSQL to populate the 1-click Role Switcher and showcase real data variance.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "patients": [
      {
        "id": "88c0512a-34d7-42f9-a590-fd0b0fbcaddd",
        "name": "Donald Roberts",
        "hsa_balance": "7096.21"
      }
    ],
    "clinics": [
      {
        "id": "19f21a8c-4bd8-4cab-a980-8554c9643e9f",
        "name": "Lake Glenn Care Clinic",
        "latitude": "44.401118",
        "longitude": "-78.717736",
        "is_accepting_patients": true
      }
    ]
  }
  ```

---

### 2.3 1-Click Quick Switch
- **Endpoint**: `POST /api/auth/quick-switch`
- **Access**: Public
- **Description**: Switches the active persona without requiring manual password entry.
- **Request Body**:
  ```json
  {
    "role": "patient",
    "id": "88c0512a-34d7-42f9-a590-fd0b0fbcaddd"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "user": {
      "id": "88c0512a-34d7-42f9-a590-fd0b0fbcaddd",
      "name": "Donald Roberts",
      "role": "patient",
      "hsa_balance": 7096.21
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Error Cases**:
  - `404 USER_NOT_FOUND`: Target profile does not exist in PostgreSQL.

---

### 2.4 Get Current Profile
- **Endpoint**: `GET /api/auth/me`
- **Access**: Authenticated
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "user": {
      "id": "88c0512a-34d7-42f9-a590-fd0b0fbcaddd",
      "name": "Donald Roberts",
      "role": "patient"
    }
  }
  ```

---

## 3. Patient Endpoints

### 3.1 List Patients (Paginated)
- **Endpoint**: `GET /api/patients`
- **Access**: Authenticated
- **Query Parameters**:
  - `page` *(optional, integer, default 1)*
  - `limit` *(optional, integer, default 20, max 100)*
  - `search` *(optional, string, case-insensitive name filter)*
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "88c0512a-34d7-42f9-a590-fd0b0fbcaddd",
        "name": "Donald Roberts",
        "hsa_balance": "7096.21"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10000,
      "totalPages": 500
    }
  }
  ```

---

### 3.2 Get Patient by ID
- **Endpoint**: `GET /api/patients/:id`
- **Access**: Authenticated
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "88c0512a-34d7-42f9-a590-fd0b0fbcaddd",
      "name": "Donald Roberts",
      "hsa_balance": "7096.21"
    }
  }
  ```
- **Error Cases**:
  - `404 PATIENT_NOT_FOUND`: Patient UUID does not exist.

---

### 3.3 Patient Dashboard Aggregation
- **Endpoint**: `GET /api/patients/:id/dashboard`
- **Access**: Authenticated (Patient)
- **Description**: Aggregates current balance, recent consultations, and recent wallet deductions for P1 Dashboard rendering.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "patient": {
      "id": "88c0512a-34d7-42f9-a590-fd0b0fbcaddd",
      "name": "Donald Roberts",
      "hsa_balance": "7096.21"
    },
    "recentAppointments": [
      {
        "id": "10482a1b-...",
        "clinic_name": "Lake Glenn Care Clinic",
        "copay_amount": "25.00",
        "status": "WAITING",
        "created_at": "2026-10-15T02:00:00Z"
      }
    ],
    "recentAudit": [
      {
        "id": "f81a2930-...",
        "amount_changed": "25.00",
        "action_type": "DEBIT",
        "balance_after": "7071.21",
        "timestamp": "2026-10-15T02:00:00Z"
      }
    ]
  }
  ```

---

### 3.4 Patient Wallet Audit Trail
- **Endpoint**: `GET /api/patients/:patientId/audit`
- **Access**: Authenticated (Patient)
- **Query Parameters**:
  - `page` *(default 1)*
  - `limit` *(default 20)*
  - `from` *(optional ISO date, e.g. `2026-10-01`)*
  - `to` *(optional ISO date, e.g. `2026-10-15`)*
  - `action` *(optional: `DEBIT` or `CREDIT`)*
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "f81a2930-...",
        "patient_id": "88c0512a-...",
        "amount_changed": "25.00",
        "action_type": "DEBIT",
        "balance_after": "7071.21",
        "timestamp": "2026-10-15T02:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
  ```

---

## 4. Clinic Endpoints

### 4.1 Browse Clinics (Paginated)
- **Endpoint**: `GET /api/clinics`
- **Access**: Authenticated
- **Query Parameters**:
  - `page` *(default 1)*
  - `limit` *(default 20)*
  - `search` *(optional string)*
  - `accepting` *(optional boolean: `true` or `false`)*
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "19f21a8c-4bd8-4cab-a980-8554c9643e9f",
        "name": "Lake Glenn Care Clinic",
        "latitude": "44.401118",
        "longitude": "-78.717736",
        "is_accepting_patients": true
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 200, "totalPages": 10 }
  }
  ```

---

### 4.2 Clinic Dashboard Summary
- **Endpoint**: `GET /api/clinics/:id/dashboard`
- **Access**: Authenticated (Clinic)
- **Description**: Returns today's live queue status counts (`WAITING`, `IN_CONSULTATION`, `DISCHARGED`), today's copay revenue, and recent appointments.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "counts": [
      { "status": "WAITING", "count": "6" },
      { "status": "IN_CONSULTATION", "count": "3" },
      { "status": "DISCHARGED", "count": "11" }
    ],
    "revenueToday": 385,
    "recentAppointments": [
      {
        "id": "10482...",
        "patient_name": "Sarah Jenkins",
        "status": "WAITING",
        "copay_amount": "25.00",
        "created_at": "2026-10-15T10:30:00Z"
      }
    ]
  }
  ```

---

## 5. Transactional Appointments Workflow (Workflow 1)

### 5.1 Book Appointment (Atomic Transaction)
- **Endpoint**: `POST /api/appointments/book`
- **Access**: Authenticated (Role: `patient`)
- **Description**: Calls PostgreSQL stored procedure `sp_book_appointment(...)`. Atomically validates the clinic status, checks that the patient has sufficient HSA balance, debits the copay, triggers `wallet_audit_logs`, and inserts the appointment.
- **Request Body**:
  ```json
  {
    "patientId": "88c0512a-34d7-42f9-a590-fd0b0fbcaddd",
    "clinicId": "19f21a8c-4bd8-4cab-a980-8554c9643e9f",
    "copayAmount": 25.00
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Appointment booked successfully",
    "appointment": {
      "id": "a91b2c3d-...",
      "patient_id": "88c0512a-...",
      "clinic_id": "19f21a8c-...",
      "copay_amount": "25.00",
      "status": "WAITING",
      "created_at": "2026-10-15T04:00:00Z"
    },
    "balance": {
      "before": 7096.21,
      "after": 7071.21
    },
    "audit": {
      "id": "e4f5a6b7-...",
      "amount_changed": "25.00",
      "action_type": "DEBIT",
      "balance_after": "7071.21",
      "timestamp": "2026-10-15T04:00:00Z"
    }
  }
  ```
- **Error Cases**:
  - `409 INSUFFICIENT_HSA`: Patient does not possess sufficient HSA balance for copay deduction.
  - `409 ACTIVE_CONSULTATION_EXISTS`: PostgreSQL partial unique index `idx_active_consult` rejects concurrent active consultations.
  - `404 CLINIC_NOT_FOUND`: Clinic does not exist or `is_accepting_patients` is false.
  - `400 INVALID_INPUT`: Negative copay amount or invalid UUID.

---

### 5.2 Advance Appointment Status
- **Endpoint**: `PATCH /api/appointments/:id/status`
- **Access**: Authenticated
- **Description**: Moves an appointment through the care lifecycle: `WAITING` -> `IN_CONSULTATION` -> `DISCHARGED`.
- **Request Body**:
  ```json
  {
    "status": "IN_CONSULTATION"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "appointment": {
      "id": "a91b2c3d-...",
      "status": "IN_CONSULTATION"
    }
  }
  ```
- **Error Cases**:
  - `400 INVALID_STATUS`: Status must be `WAITING`, `IN_CONSULTATION`, or `DISCHARGED`.
  - `409 ACTIVE_CONSULTATION_EXISTS`: Cannot advance to `WAITING` or `IN_CONSULTATION` if another active consultation exists.

---

## 6. Analytics & Materialized View (Workflow 2)

### 6.1 Rolling 7-Day Moving Average & Dense Rank
- **Endpoint**: `GET /api/analytics/window`
- **Access**: Authenticated (Role: `clinic`)
- **Description**: Executes `06_window_analytics.sql` (or `clinic_window_analytics` view). Returns daily copay totals, mathematically continuous 7-day moving averages, and global `DENSE_RANK()`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "clinic_name": "Lake Glenn Care Clinic",
        "rev_date": "2026-10-14",
        "daily_copay_total": "240.00",
        "moving_7day_avg": "194.28",
        "global_revenue_rank": 1
      }
    ]
  }
  ```

---

### 6.2 Materialized View Monthly Summary
- **Endpoint**: `GET /api/analytics/summary`
- **Access**: Authenticated (Role: `clinic`)
- **Description**: Queries `mv_clinic_monthly_discharges`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "clinic_id": "19f21a8c-...",
        "clinic_name": "Lake Glenn Care Clinic",
        "total_discharges": 312,
        "total_copay_revenue": "18420.00"
      }
    ],
    "lastRefreshed": "2026-10-15T03:30:00Z"
  }
  ```

---

### 6.3 Refresh Materialized View
- **Endpoint**: `POST /api/analytics/refresh`
- **Access**: Authenticated (Role: `clinic`)
- **Description**: Triggers PostgreSQL function `refresh_clinic_monthly_mv()` to synchronize reporting metrics with real-time appointment records.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Analytics materialized view refreshed successfully",
    "refreshedAt": "2026-10-15T04:10:00Z"
  }
  ```

---

## 7. Geospatial Telemetry (Workflow 3)

### 7.1 Nearest Active Nurse Search
- **Endpoint**: `GET /api/nurses/nearby`
- **Access**: Authenticated
- **Query Parameters**:
  - `lat` *(required, decimal latitude)*
  - `lng` *(required, decimal longitude)*
  - `radiusKm` *(optional, capped at 5.0 km by assignment rule)*
- **Description**: Executes MongoDB `$geoNear` aggregation pipeline on `NursePings` utilizing the `location_2dsphere` index, filtering for `status: 'ACTIVE'`, and grouping to keep each nurse's most recent ping.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "origin": { "lat": 17.385, "lng": 78.4867 },
    "nurse": {
      "nurse_id": "NURSE-0419",
      "distance_meters": 840.2,
      "distance_km": 0.84,
      "last_seen": "2026-10-15T04:02:10Z",
      "location": {
        "type": "Point",
        "coordinates": [78.4892, 17.3891]
      }
    },
    "nurses": [
      {
        "nurse_id": "NURSE-0419",
        "distance_meters": 840.2,
        "distance_km": 0.84,
        "location": { "type": "Point", "coordinates": [78.4892, 17.3891] }
      }
    ]
  }
  ```
- **Error Cases**:
  - `400 INVALID_COORDINATES`: Missing or invalid latitude/longitude parameters.

---

## 8. Review Analytics & Medical Catalog (Workflow 4)

### 8.1 Multi-Faceted Review Analytics
- **Endpoint**: `GET /api/reviews/analytics/:id`
- **Access**: Authenticated
- **Description**: Executes MongoDB `$facet` aggregation pipeline on `PatientReviews` to calculate rating breakdown, top 10 sentiment tags, and overall clinic rating in a single query.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "ratingDistribution": [
      { "rating": 5, "count": 294 },
      { "rating": 4, "count": 184 },
      { "rating": 3, "count": 86 },
      { "rating": 2, "count": 36 },
      { "rating": 1, "count": 12 }
    ],
    "topTags": [
      { "tag": "friendly", "count": 412 },
      { "tag": "clean_facility", "count": 338 },
      { "tag": "on_time", "count": 187 },
      { "tag": "long_wait", "count": 92 }
    ],
    "overallAverage": {
      "averageRating": 4.38,
      "totalReviews": 612
    }
  }
  ```

---

### 8.2 Medical Catalog Document
- **Endpoint**: `GET /api/medical-catalog`
- **Access**: Authenticated
- **Description**: Reads flexible medical catalog documents (`MedicalCatalogs`). If the collection is unseeded in the inherited database, returns a graceful structured fallback document rather than an unhandled 500 failure.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "specialist": "Dr. Anita Rao",
      "specialty": "Cardiology",
      "mode": ["in_person", "telehealth"],
      "slots": ["Mon 09:00-13:00", "Wed 09:00-13:00", "Fri 14:00-18:00"],
      "formulary": [
        { "name": "Amlodipine", "category": "Antihypertensive", "dosage": "5 mg once daily", "tier": 1 },
        { "name": "Metformin", "category": "Antidiabetic", "dosage": "500 mg twice daily", "tier": 1 },
        { "name": "Atorvastatin", "category": "Lipid lowering", "dosage": "10 mg at night", "tier": 2 }
      ]
    }
  }
  ```
