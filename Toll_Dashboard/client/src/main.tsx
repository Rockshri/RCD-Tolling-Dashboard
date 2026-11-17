import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { PlazaForm } from './pages/PlazaForm';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { AdminUsers } from './pages/AdminUsers';
import { AuthProvider, useAuth } from './lib/auth';
import './index.css';

function Protected({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-8 text-grey">Loading…</div>;
  if (!me) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/plazas/new" element={<Protected><PlazaForm mode="new" /></Protected>} />
        <Route path="/plazas/:id/edit" element={<Protected><PlazaForm mode="edit" /></Protected>} />
        <Route path="/admin/users" element={<Protected><AdminUsers /></Protected>} />
      </Routes>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
