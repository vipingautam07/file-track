const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const supabase = require('../config/supabase');
const logger = require('../config/logger');
const { isJwtBlacklisted } = require('./jwtBlacklist');

/**
 * Authenticate JWT access token from Authorization header.
 * Attaches req.user with {id, email, role, full_name}.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        throw new AppError('Token expired', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }

    // Reject tokens that were explicitly revoked (e.g. after logout)
    if (payload.jti && isJwtBlacklisted(payload.jti)) {
      throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
    }

    // Fetch fresh user from DB to ensure active
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, full_name, is_active, deleted_at')
      .eq('id', payload.sub)
      .single();

    if (error || !user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }
    if (!user.is_active || user.deleted_at) {
      throw new AppError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
    };

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Authorization middleware factory.
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    if (!roles.includes(req.user.role)) {
      logger.warn({
        message: 'Unauthorized access attempt',
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
      });
      return next(
        new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN')
      );
    }
    next();
  };
};

/**
 * Verify magic link token for customer access.
 */
const verifyMagicLink = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      throw new AppError('Magic link token required', 400, 'TOKEN_REQUIRED');
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('magic_link_token', token)
      .single();

    if (error || !user) {
      throw new AppError('Invalid magic link', 401, 'INVALID_MAGIC_LINK');
    }
    if (new Date(user.magic_link_expires_at) < new Date()) {
      throw new AppError('Magic link has expired', 401, 'MAGIC_LINK_EXPIRED');
    }

    req.magicUser = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, authorize, verifyMagicLink };
