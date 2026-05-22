import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  // Required so the browser sends the httpOnly refresh-token cookie on every request
  withCredentials: true,
});

// ── Request interceptor: attach in-memory access token ─────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: transparent token refresh ─────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    const isTokenExpired =
      error.response?.status === 401 &&
      error.response?.data?.error?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry;

    if (isTokenExpired) {
      if (isRefreshing) {
        // Queue concurrent requests until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { updateAccessToken, logout } = useAuthStore.getState();

      try {
        // Cookie is sent automatically (withCredentials: true)
        // No need to pass refreshToken in body — the httpOnly cookie handles it
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const { accessToken: newAccess, user } = data.data;

        updateAccessToken(newAccess);
        // Also sync user info in case it changed (e.g. role update)
        if (user) useAuthStore.getState().updateUser(user);

        processQueue(null, newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
