import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Auth store design (security-hardened):
 *
 * - accessToken  → in-memory ONLY (never persisted). Lost on page refresh, recovered via silent refresh.
 * - refreshToken → NOT stored in JS at all. Lives in an httpOnly cookie set by the backend.
 * - user (id, email, role, full_name) → persisted in sessionStorage for instant UI layout on reload
 *   while the silent refresh is in-flight. Contains NO secrets.
 * - isBootstrapped → false until the silent-refresh attempt on app mount completes.
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── Persisted (sessionStorage) ────────────────────────────────
      user: null,
      isAuthenticated: false,

      // ── In-memory only (never persisted) ─────────────────────────
      accessToken: null,

      // ── Bootstrap state ──────────────────────────────────────────
      isBootstrapped: false,

      // ── Actions ──────────────────────────────────────────────────
      login: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        }),

      /** Called by AuthBootstrap after a silent refresh succeeds or fails */
      setBootstrapped: () => set({ isBootstrapped: true }),

      /** Replace only the access token (e.g. after silent refresh) */
      updateAccessToken: (accessToken) => set({ accessToken }),

      /** Update user info (e.g. after profile edit) */
      updateUser: (user) => set({ user }),
    }),
    {
      name: 'kl-auth',
      // sessionStorage: survives tab navigation but NOT page close → safer than localStorage
      storage: createJSONStorage(() => sessionStorage),
      // Persist ONLY non-sensitive user info — NEVER the access token
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // accessToken intentionally excluded
      }),
    }
  )
);
