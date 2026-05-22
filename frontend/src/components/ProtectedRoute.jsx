import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function RequireAuth({ roles }) {
  const { isAuthenticated, isBootstrapped, user } = useAuthStore();

  // Don't redirect until the silent-refresh bootstrap has completed
  if (!isBootstrapped) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user?.role)) {
    // Redirect to correct dashboard
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'bank_member') return <Navigate to="/bank" replace />;
    if (user?.role === 'customer') return <Navigate to="/customer" replace />;
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function GuestOnly() {
  const { isAuthenticated, isBootstrapped, user } = useAuthStore();
  // Don't redirect until bootstrap completes
  if (!isBootstrapped) return null;
  if (!isAuthenticated) return <Outlet />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'bank_member') return <Navigate to="/bank" replace />;
  return <Navigate to="/customer" replace />;
}
