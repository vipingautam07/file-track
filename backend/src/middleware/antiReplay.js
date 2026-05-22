'use strict';

/**
 * Anti-Replay middleware
 *
 * Clients may optionally send an X-Request-Timestamp header (Unix ms).
 * On state-changing requests (POST/PUT/PATCH/DELETE), if the header IS
 * present, we reject it if it's older than REQUEST_MAX_AGE_MS (default 5 min).
 * This prevents captured requests from being replayed later.
 *
 * The JTI-based blacklist already protects against JWT replay;
 * this adds a secondary layer at the HTTP layer.
 */

const REQUEST_MAX_AGE_MS = parseInt(process.env.REQUEST_MAX_AGE_MS || '300000', 10); // 5 min

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function antiReplay(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const tsHeader = req.headers['x-request-timestamp'];
  if (!tsHeader) return next(); // header is optional — don't block if absent

  const ts = parseInt(tsHeader, 10);
  if (isNaN(ts)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TIMESTAMP', message: 'X-Request-Timestamp must be a Unix millisecond timestamp' },
    });
  }

  const age = Date.now() - ts;
  if (age < 0 || age > REQUEST_MAX_AGE_MS) {
    return res.status(400).json({
      success: false,
      error: { code: 'REQUEST_EXPIRED', message: `Request timestamp is too old (>${REQUEST_MAX_AGE_MS / 1000}s). Re-send with a fresh timestamp.` },
    });
  }

  next();
}

module.exports = { antiReplay };
