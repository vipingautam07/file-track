import * as Sentry from '@sentry/react';

/**
 * Initialise Sentry for the React frontend.
 * Call this once, as early as possible in main.jsx — before rendering.
 *
 * DSN is set via VITE_SENTRY_DSN environment variable.
 * If not set (e.g. in development), Sentry is silently disabled.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // disabled in development if no DSN set

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,          // 'development' | 'production'
    release: import.meta.env.VITE_APP_VERSION,  // set via CI: e.g. sha-abc1234

    // Performance monitoring — sample 20% of transactions in production
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,

    // Attach React component tree to error reports
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Record 10% of sessions, 100% of error sessions
        sessionSampleRate: 0.1,
        errorSampleRate: 1.0,
        // Mask all text + block all media — avoids capturing PII
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Scrub known sensitive fields from breadcrumbs/request bodies
    beforeSend(event) {
      if (event.request?.data) {
        const data = event.request.data;
        if (typeof data === 'object') {
          ['password', 'accessToken', 'refreshToken', 'otp'].forEach((key) => {
            if (key in data) data[key] = '[REDACTED]';
          });
        }
      }
      return event;
    },
  });
}

/**
 * Identify the current user in Sentry (called after successful login).
 * Only attaches non-sensitive identifiers — no email in production.
 */
export function setSentryUser(user) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.setUser({
    id: user?.id,
    role: user?.role,
    // Do NOT include email in production to avoid PII in error reports
    email: import.meta.env.PROD ? undefined : user?.email,
  });
}

/** Clear the Sentry user context on logout */
export function clearSentryUser() {
  Sentry.setUser(null);
}
