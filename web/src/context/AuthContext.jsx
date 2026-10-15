import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('careconnect_user'));
    } catch {
      return null;
    }
  });

  const [demoProfiles, setDemoProfiles] = useState({ patients: [], clinics: [] });
  const [loading, setLoading] = useState(false);

  // Load demo profiles from backend
  const fetchDemoProfiles = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/demo-profiles');
      if (data.success) {
        setDemoProfiles({
          patients: data.patients || [],
          clinics: data.clinics || [],
        });
        return data;
      }
    } catch (err) {
      console.warn('Could not load demo profiles:', err);
    }
    return null;
  }, []);

  // Quick switch profile (1-click without password)
  const quickSwitch = useCallback(async (role, id) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/quick-switch', { role, id });
      if (data.success) {
        localStorage.setItem('careconnect_token', data.token);
        localStorage.setItem('careconnect_user', JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      console.error('Quick switch failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Standard login for fallback
  const login = async (role, username, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { role, username, password });
      localStorage.setItem('careconnect_token', data.token);
      localStorage.setItem('careconnect_user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  // Refresh current user info (e.g. latest HSA balance)
  const refreshUser = useCallback(async () => {
    if (!user?.id || user?.role !== 'patient') return;
    try {
      const { data } = await api.get(`/patients/${user.id}`);
      if (data.success && data.data) {
        const updated = {
          ...user,
          hsa_balance: Number(data.data.hsa_balance),
        };
        setUser(updated);
        localStorage.setItem('careconnect_user', JSON.stringify(updated));
      }
    } catch (err) {
      console.warn('Could not refresh user balance:', err);
    }
  }, [user]);

  const logout = () => {
    localStorage.removeItem('careconnect_token');
    localStorage.removeItem('careconnect_user');
    setUser(null);
  };

  // On initial mount: load demo profiles and auto-select Sarah Jenkins or first patient if none logged in
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profiles = await fetchDemoProfiles();
      if (cancelled) return;

      const storedUser = localStorage.getItem('careconnect_user');
      if (!storedUser && profiles?.patients?.length) {
        // Find Sarah Jenkins or default to first patient
        const defaultPatient = profiles.patients.find((p) => p.name.includes('Sarah')) || profiles.patients[0];
        if (defaultPatient) {
          try {
            await quickSwitch('patient', defaultPatient.id);
          } catch {
            // ignore
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchDemoProfiles, quickSwitch]);

  return (
    <AuthContext.Provider
      value={{
        user,
        demoProfiles,
        login,
        quickSwitch,
        refreshUser,
        logout,
        loading,
        fetchDemoProfiles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
