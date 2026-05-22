import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import AuthBootstrap from './components/AuthBootstrap';
import { RequireAuth, GuestOnly } from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import MagicAuthPage from './pages/MagicAuthPage';
import CustomerFilePage from './pages/CustomerFilePage';
import CustomerPortal from './pages/customer/CustomerPortal';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminFileList from './pages/admin/AdminFileList';
import AdminFileDetail from './pages/admin/AdminFileDetail';
import CreateFilePage from './pages/admin/CreateFilePage';
import CustomerListPage from './pages/admin/CustomerListPage';

export default function App() {
  return (
    /**
     * AuthBootstrap attempts a silent refresh on every page load.
     * It shows a loading screen until the httpOnly refresh-token cookie is
     * exchanged for a new in-memory access token, so users are never
     * logged out by a page refresh.
     */
    <BrowserRouter>
      <AuthBootstrap>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#0f172a',
              fontSize: '14px',
              fontWeight: 500,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            },
          }}
        />

        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          <Route path="/auth/magic" element={<MagicAuthPage />} />

          {/* Customer tracking — fully public, secure token is the only auth */}
          <Route path="/track/:token" element={<CustomerFilePage />} />

          {/* Customer portal */}
          <Route element={<RequireAuth roles={['customer']} />}>
            <Route path="/customer" element={<CustomerPortal />} />
          </Route>

          {/* Admin + Bank Member (shared layout) */}
          <Route element={<RequireAuth roles={['admin', 'bank_member']} />}>
            <Route element={<AdminLayout />}>
              {/* Admin exclusive */}
              <Route element={<RequireAuth roles={['admin']} />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/files/new" element={<CreateFilePage />} />
                <Route path="/admin/customers" element={<CustomerListPage />} />
                <Route path="/admin/analytics" element={<AdminDashboard />} />
              </Route>

              {/* Admin + Bank Member shared */}
              <Route element={<RequireAuth roles={['admin', 'bank_member']} />}>
                <Route path="/admin/files" element={<AdminFileList />} />
                <Route path="/admin/files/:id" element={<AdminFileDetail />} />
              </Route>

              {/* Bank member root */}
              <Route path="/bank" element={<AdminFileList />} />
              <Route path="/bank/files/:id" element={<AdminFileDetail />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthBootstrap>
    </BrowserRouter>
  );
}
