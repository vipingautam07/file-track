import { useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

/**
 * AuthBootstrap
 *
 * Runs once on app mount and attempts a silent refresh using the httpOnly
 * refresh-token cookie. If successful, the new access token is stored in
 * memory and the user stays logged in across page refreshes without ever
 * exposing the refresh token to JavaScript.
 *
 * Flow on page load:
 *   1. Render children immediately using persisted `user` from sessionStorage
 *      → the UI shows the correct layout with no flash.
 *   2. In the background, call POST /api/auth/refresh (cookie auto-attached).
 *   3a. Success → store the new access token in memory, mark bootstrapped.
 *   3b. Failure → clear user state, mark bootstrapped (user must log in again).
 *
 * After `isBootstrapped` is true, ProtectedRoute can reliably gate content.
 */
export default function AuthBootstrap({ children }) {
  const { login, logout, setBootstrapped, isAuthenticated, isBootstrapped, user } =
    useAuthStore();

  useEffect(() => {
    // Only run the silent-refresh once
    if (isBootstrapped) return;

    const silentRefresh = async () => {
      try {
        const { data } = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true }
        );

        const { accessToken, user: refreshedUser } = data.data;

        if (accessToken && refreshedUser) {
          login(refreshedUser, accessToken);
        } else {
          // Unexpected response shape — clear stale state
          logout();
        }
      } catch {
        // Refresh failed (cookie missing, expired, or revoked) — logout cleanly
        logout();
      } finally {
        setBootstrapped();
      }
    };

    silentRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While bootstrap hasn't run yet, show a minimal loading screen
  // so ProtectedRoute doesn't redirect to /login prematurely
  if (!isBootstrapped) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          <img src="/logo.jpg" alt="Logo" style={{ width: 24, height: 24, objectFit: 'contain' }} />
        </div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Authenticating…
        </p>
      </div>
    );
  }

  return children;
}
