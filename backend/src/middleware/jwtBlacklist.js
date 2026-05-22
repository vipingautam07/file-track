/**
 * JWT Blacklist — shared in-memory store.
 *
 * Tracks revoked access-token JTIs so that tokens cannot be reused
 * after logout even before they expire.
 *
 * NOTE: In-memory means the blacklist is cleared on server restart.
 * For production with multiple instances, replace with a Redis SET:
 *   await redis.set(`bl:${jti}`, '1', 'EX', ttlSeconds);
 *   const revoked = await redis.exists(`bl:${jti}`);
 */
const blacklist = new Set();

/**
 * Add a JTI to the blacklist.
 * @param {string} jti
 */
function blacklistJwt(jti) {
  if (jti) blacklist.add(jti);
}

/**
 * Check whether a JTI has been revoked.
 * @param {string} jti
 * @returns {boolean}
 */
function isJwtBlacklisted(jti) {
  if (!jti) return false;
  return blacklist.has(jti);
}

module.exports = { blacklistJwt, isJwtBlacklisted };
