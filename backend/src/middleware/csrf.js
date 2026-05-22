'use strict';

/**
 * CSRF Origin validation middleware.
 *
 * Since we use httpOnly SameSite=Strict cookies, cross-site requests will
 * not carry the cookie — but this middleware provides a defence-in-depth
 * layer that explicitly rejects state-changing requests (POST/PUT/PATCH/DELETE)
 * whose Origin or Referer header does not match FRONTEND_URL.
 *
 * Why not csurf?
 *   csurf is deprecated and requires synchronised token state. The
 *   combination of SameSite cookies + Origin validation is the modern
 *   standard for SPA apps (used by Django, Rails 7, Next.js, etc.)
 */

const ALLOWED_ORIGINS = new Set([
  process.env.FRONTEND_URL || 'http://localhost:5173',
  // Add additional origins here if you ever add a second frontend domain
]);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfProtection(req, res, next) {
  // Safe methods don't mutate state — skip check
  if (SAFE_METHODS.has(req.method)) return next();

  // Public endpoints that legitimately receive cross-origin requests
  // (e.g. Resend webhook callbacks) — skip check
  if (req.path.startsWith('/api/public/')) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // At least one must be present for non-safe methods
  const source = origin || (referer ? new URL(referer).origin : null);

  if (!source) {
    // Allow requests with no origin from the same server (server-to-server)
    // Only in development; in production this should be blocked
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: { code: 'CSRF_MISSING_ORIGIN', message: 'Forbidden — origin missing' },
      });
    }
    return next();
  }

  if (!ALLOWED_ORIGINS.has(source)) {
    return res.status(403).json({
      success: false,
      error: { code: 'CSRF_INVALID_ORIGIN', message: 'Forbidden — origin not allowed' },
    });
  }

  next();
}

module.exports = { csrfProtection };
