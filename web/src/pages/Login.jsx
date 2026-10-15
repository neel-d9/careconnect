import React from "react";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, UserRound, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
export default function Login() {
  const [role, setRole] = useState('patient');
  const [id, setId] = useState('');
  const [password, setPassword] = useState(
    role === 'patient' ? 'admin' : 'root',
  );
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const nav = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(role, id, password);
      nav(role === 'patient' ? '/patient/dashboard' : '/clinic/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Login failed. Check the ID and demo password.',
      );
    }
  };
  return (
    <div className='auth-page'>
      <div className='auth-brand'>
        <span className='brand-mark'>
          <HeartPulse />
        </span>
        Care<span>Connect</span>
      </div>
      <div className='auth-card'>
        <div className='eyebrow'>WELCOME BACK</div>
        <h1>Sign in to CareConnect</h1>
        <p className='muted'>
          Choose your profile and use a seeded ID to continue.
        </p>
        <div className='role-tabs'>
          <button
            className={role === 'patient' ? 'active' : ''}
            onClick={() => {
              setRole('patient');
              setPassword('admin');
            }}
          >
            <UserRound size={17} /> Patient
          </button>
          <button
            className={role === 'clinic' ? 'active' : ''}
            onClick={() => {
              setRole('clinic');
              setPassword('root');
            }}
          >
            <Building2 size={17} /> Clinic
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            {role === 'patient' ? 'Patient ID' : 'Clinic ID'}
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder='Paste a seeded UUID'
              required
            />
          </label>
          <label>
            Password
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className='alert danger'>{error}</div>}
          <button className='btn primary full' disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className='demo-note'>
          Demo password: <b>{role === 'patient' ? 'admin' : 'root'}</b>
        </div>
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 16, textAlign: 'center' }}>
          <button
            type='button'
            className='btn outline full'
            onClick={() => nav('/switch-profile')}
          >
            Or Select From Seeded Demo Profiles →
          </button>
        </div>
      </div>
    </div>
  );
}
