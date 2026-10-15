import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import SwitchProfile from './pages/SwitchProfile';
import PatientDashboard from './pages/PatientDashboard';
import PatientAppointments from './pages/PatientAppointments';
import BookAppointment from './pages/BookAppointment';
import Clinics from './pages/Clinics';
import Wallet from './pages/Wallet';
import ClinicDashboard from './pages/ClinicDashboard';
import ClinicPatients from './pages/ClinicPatients';
import NurseMap from './pages/NurseMap';
import Analytics from './pages/Analytics';
import Reviews from './pages/Reviews';
import Catalog from './pages/Catalog';
import States from './pages/States';

function Role({ role, children }) {
  return <ProtectedRoute role={role}>{children}</ProtectedRoute>;
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to='/switch-profile' replace />;
  }
  return <Navigate to={user.role === 'clinic' ? '/clinic/dashboard' : '/patient/dashboard'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<RootRedirect />} />
          <Route path='/login' element={<Login />} />
          <Route path='/switch-profile' element={<SwitchProfile />} />
          <Route
            path='/patient'
            element={
              <Role role='patient'>
                <AppLayout />
              </Role>
            }
          >
            <Route index element={<Navigate to='dashboard' replace />} />
            <Route path='dashboard' element={<PatientDashboard />} />
            <Route path='appointments' element={<PatientAppointments />} />
            <Route path='book' element={<BookAppointment />} />
            <Route path='clinics' element={<Clinics />} />
            <Route path='wallet' element={<Wallet />} />
          </Route>
          <Route
            path='/clinic'
            element={
              <Role role='clinic'>
                <AppLayout />
              </Role>
            }
          >
            <Route index element={<Navigate to='dashboard' replace />} />
            <Route path='dashboard' element={<ClinicDashboard />} />
            <Route path='patients' element={<ClinicPatients />} />
            <Route path='nurse-map' element={<NurseMap />} />
            <Route path='analytics' element={<Analytics />} />
            <Route path='reviews' element={<Reviews />} />
            <Route path='catalog' element={<Catalog />} />
          </Route>
          <Route
            path='/states'
            element={
              <ProtectedRoute>
                <States />
              </ProtectedRoute>
            }
          />
          <Route path='*' element={<Navigate to='/login' replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
