const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { rateLimit } = require('express-rate-limit');

const supabase = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { blacklistJwt } = require('../middleware/jwtBlacklist');
const { writeAuditLog } = require('../services/auditService');
const { queueNotification, templates } = require('../services/notificationService');
const logger = require('../config/logger');

/** Cookie options for the httpOnly refresh token */
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days in ms
  path: '/api/auth',              // cookie only sent to auth endpoints
};

const router = express.Router();

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { success: false, error: { message: 'Too many attempts, try again later', code: 'RATE_LIMITED' } },
  standardHeaders: true,
  legacyHeaders: false,
});

//refresh token endpoint needs a separate limiter to allow more frequent refreshes without blocking logins
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  message: {
    success: false,
    error: {
      message: 'Too many refresh requests, try again later',
      code: 'RATE_LIMITED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Cooldown rate limiter for sending access link (magic-link) to prevent abuse
const magicLinkLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP/user to 5 requests per minute
  message: { success: false, error: { message: 'Please wait at least a minute before requesting another access link', code: 'RATE_LIMITED' } },
  standardHeaders: true,
  legacyHeaders: false,
});

const generateTokens = (userId, role) => {
  const jti = crypto.randomUUID(); // unique ID for blacklisting on logout
  const accessToken = jwt.sign(
    { sub: userId, role, type: 'access', jti },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
  return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId, refreshToken, req) => {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await supabase.from('refresh_tokens').insert({
    user_id: userId,
    token_hash: hash,
    expires_at: expiresAt.toISOString(),
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });
};

// ── POST /api/auth/login ──────────────────────────────────────────
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password required'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR'));

    try {
      const { email, password } = req.body;

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single();

      if (error || !user || !user.password_hash) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // ── Account lockout check ───────────────────────────────────────────
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const remainingMs = new Date(user.locked_until) - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        logger.warn({ message: 'Login blocked — account locked', email, ip: req.ip });
        throw new AppError(
          `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`,
          429,
          'ACCOUNT_LOCKED'
        );
      }
      // Customers who signed up via magic-link only have no password — block them
      if (user.role === 'customer' && !user.password_hash) {
        throw new AppError('Please use the secure link sent to your email to access your file', 403, 'CUSTOMER_USE_MAGIC_LINK');
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        // ── Increment failed attempts, lock if threshold reached ──────────────
        const MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
        const LOCKOUT_MIN = parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15', 10);
        const newAttempts = (user.failed_login_attempts || 0) + 1;
        const lockedUntil = newAttempts >= MAX_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MIN * 60 * 1000).toISOString()
          : null;

        await supabase
          .from('users')
          .update({
            failed_login_attempts: newAttempts,
            ...(lockedUntil ? { locked_until: lockedUntil } : {}),
          })
          .eq('id', user.id);

        if (lockedUntil) {
          logger.warn({ message: 'Account locked after repeated failures', email, ip: req.ip, attempts: newAttempts });
        }

        await writeAuditLog({
          actorEmail: email,
          actorIp: req.ip,
          action: 'user_login',
          resourceType: 'user',
          resourceId: user.id,
          newValue: { success: false, reason: 'bad_password', attempt: newAttempts },
          requestId: req.requestId,
        });
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // ── Successful login: reset failed attempt counter ───────────────────
      if ((user.failed_login_attempts || 0) > 0) {
        await supabase
          .from('users')
          .update({ failed_login_attempts: 0, locked_until: null })
          .eq('id', user.id);
      }

      const { accessToken, refreshToken } = generateTokens(user.id, user.role);
      await storeRefreshToken(user.id, refreshToken, req);

      // Update last login
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString(), last_login_ip: req.ip })
        .eq('id', user.id);

      await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        actorIp: req.ip,
        action: 'user_login',
        resourceType: 'user',
        resourceId: user.id,
        newValue: { success: true },
        requestId: req.requestId,
        userAgent: req.headers['user-agent'],
      });

      // Set refresh token in httpOnly cookie — JS cannot access this
      res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTS);

      res.json({
        success: true,
        data: {
          user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
          accessToken,
          // refreshToken intentionally omitted from response body
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/auth/refresh ────────────────────────────────────────
// Reads the refresh token from httpOnly cookie (preferred) or body (fallback)
router.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    // Primary: read from httpOnly cookie; fallback: body (legacy clients)
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
    if (!refreshToken) throw new AppError('Refresh token required', 400, 'TOKEN_REQUIRED');

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      res.clearCookie('refresh_token', { path: '/api/auth' });
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const { data: storedToken } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', hash)
      .is('revoked_at', null)
      .single();

    if (!storedToken || new Date(storedToken.expires_at) < new Date()) {
      res.clearCookie('refresh_token', { path: '/api/auth' });
      throw new AppError('Invalid or expired refresh token', 401, 'TOKEN_EXPIRED');
    }

    // Rotate token: revoke old, issue new
    await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', storedToken.id);

    const { data: user } = await supabase
      .from('users')
      .select('id, email, role, full_name, is_active, deleted_at')
      .eq('id', payload.sub)
      .single();

    if (!user || !user.is_active || user.deleted_at) {
      res.clearCookie('refresh_token', { path: '/api/auth' });
      throw new AppError('Account unavailable', 403, 'ACCOUNT_UNAVAILABLE');
    }

    const { accessToken, refreshToken: newRefresh } = generateTokens(user.id, user.role);
    await storeRefreshToken(user.id, newRefresh, req);

    // Rotate cookie
    res.cookie('refresh_token', newRefresh, REFRESH_COOKIE_OPTS);

    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
        // newRefresh intentionally omitted — stored in httpOnly cookie
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // Revoke the refresh token from cookie (preferred) or body (fallback)
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
    if (refreshToken) {
      const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await supabase
        .from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', hash);
    }

    // Blacklist the current access token's jti so it cannot be reused
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.decode(authHeader.split(' ')[1]);
        if (decoded?.jti) blacklistJwt(decoded.jti);
      } catch { /* ignore decode errors */ }
    }

    // Clear the httpOnly refresh cookie
    res.clearCookie('refresh_token', { path: '/api/auth' });

    await writeAuditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      actorIp: req.ip,
      action: 'user_logout',
      resourceType: 'user',
      resourceId: req.user.id,
      requestId: req.requestId,
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/magic-link (Admin sends link to customer) ──────
router.post(
  '/magic-link',
  authenticate,
  magicLinkLimiter,
  [body('customerId').isUUID().withMessage('Valid customer ID required')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR'));

    try {
      // Only admins can send magic links
      if (req.user.role !== 'admin') {
        throw new AppError('Only admins can send magic links', 403, 'FORBIDDEN');
      }

      const { customerId } = req.body;
      const { data: customer } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('id', customerId)
        .eq('role', 'customer')
        .single();

      if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + parseInt(process.env.MAGIC_LINK_EXPIRY_MINUTES || '30') * 60 * 1000);

      await supabase
        .from('users')
        .update({ magic_link_token: token, magic_link_expires_at: expiresAt.toISOString() })
        .eq('id', customerId);

      // Fetch their file for context
      const { data: file } = await supabase
        .from('loan_files')
        .select('file_number, secure_token')
        .eq('customer_id', customerId)
        .is('deleted_at', null)
        .limit(1)
        .single();

      const magicUrl = `${process.env.FRONTEND_URL}/auth/magic?token=${token}`;
      const tmpl = templates.magicLink({
        applicantName: customer.full_name,
        magicUrl,
        fileNumber: file?.file_number || 'Your File',
      });

      const emailSent = await queueNotification({
        recipientId: customer.id,
        recipientEmail: 'vg.pvt13@gmail.com' || customer.email,
        channel: 'email',
        subject: tmpl.subject,
        body: `Access your file: ${magicUrl}`,
        html: tmpl.html,
      });

      if (!emailSent) {
        throw new AppError('Failed to send magic link email. Please verify your email configuration.', 500, 'EMAIL_SEND_FAILED');
      }

      res.json({ success: true, message: 'Magic link sent to customer email' });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/auth/magic-verify ────────────────────────────────────
router.get('/magic-verify', authLimiter, async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) throw new AppError('Token required', 400, 'TOKEN_REQUIRED');

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('magic_link_token', token)
      .single();

    if (!user || new Date(user.magic_link_expires_at) < new Date()) {
      throw new AppError('Invalid or expired magic link', 401, 'INVALID_MAGIC_LINK');
    }

    // Clear token after use
    await supabase
      .from('users')
      .update({ magic_link_token: null, magic_link_expires_at: null, last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await storeRefreshToken(user.id, refreshToken, req);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      actorIp: req.ip,
      action: 'user_login',
      resourceType: 'user',
      resourceId: user.id,
      newValue: { method: 'magic_link' },
      requestId: req.requestId,
    });

    // Set httpOnly cookie for refresh token
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTS);

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
        accessToken,
        // refreshToken intentionally omitted — stored in httpOnly cookie
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

// ── POST /api/auth/setup (First-time admin creation) ─────────────
router.post(
  '/setup',
  authLimiter,
  [
    body('setupKey').equals(process.env.JWT_ACCESS_SECRET?.slice(0, 16) || 'setup').withMessage('Invalid setup key'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }),
    body('fullName').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR'));

      // Check if any admin exists
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');

      if (count > 0) {
        throw new AppError('Setup already completed', 409, 'ALREADY_SETUP');
      }

      const { email, password, fullName } = req.body;
      const passwordHash = await bcrypt.hash(password, 12);

      const { data: admin, error } = await supabase
        .from('users')
        .insert({
          email,
          full_name: fullName,
          role: 'admin',
          password_hash: passwordHash,
          is_active: true,
          email_verified: true,
        })
        .select('id, email, role, full_name')
        .single();

      if (error) throw new AppError(error.message, 500, 'DB_ERROR');

      logger.info({ message: 'Initial admin created', email: admin.email });
      res.status(201).json({ success: true, data: { user: admin } });
    } catch (err) {
      next(err);
    }
  }
);

// ── Rate limiter for forgot-password OTP ─────────────────────────
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: { message: 'Too many OTP requests, try again later', code: 'RATE_LIMITED' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── POST /api/auth/forgot-password — Send OTP ─────────────────────
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [body('email').isEmail().withMessage('Valid email required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR'));

      const { email } = req.body;

      const { data: user } = await supabase
        .from('users')
        .select('id, email, full_name, last_password_reset_at')
        .eq('email', email)
        .single();

      // Always respond 200 to prevent email enumeration
      if (!user) return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });

      // 24-hour cooldown check
      if (user.last_password_reset_at) {
        const hoursSinceLast = (Date.now() - new Date(user.last_password_reset_at).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < 24) {
          const hoursLeft = Math.ceil(24 - hoursSinceLast);
          return next(new AppError(
            `Password was recently changed. Please wait ${hoursLeft} hour(s) before resetting again.`,
            429,
            'RESET_COOLDOWN'
          ));
        }
      }

      // Generate 6-digit OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await supabase
        .from('users')
        .update({ password_reset_otp: otpHash, password_reset_otp_expires_at: expiresAt.toISOString() })
        .eq('id', user.id);

      const tmpl = templates.passwordResetOtp({ applicantName: user.full_name, otp });
      const emailSent = await queueNotification({
        recipientId: user.id,
        recipientEmail: user.email,
        channel: 'email',
        subject: tmpl.subject,
        body: `Your password reset OTP is: ${otp}`,
        html: tmpl.html,
      });

      if (!emailSent) {
        // Clear the OTP so it can't be used — keep the DB clean
        await supabase
          .from('users')
          .update({ password_reset_otp: null, password_reset_otp_expires_at: null })
          .eq('id', user.id);

        throw new AppError(
          'Failed to send OTP email. Please check your email address or try again later.',
          500,
          'EMAIL_SEND_FAILED'
        );
      }

      logger.info({ message: 'Password reset OTP sent', email: user.email });
      res.json({ success: true, message: 'OTP sent! Check your email inbox.' });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/auth/reset-password — Verify OTP & set new password ─
router.post(
  '/reset-password',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR'));

      const { email, otp, newPassword } = req.body;

      const { data: user } = await supabase
        .from('users')
        .select('id, email, full_name, password_reset_otp, password_reset_otp_expires_at, last_password_reset_at')
        .eq('email', email)
        .single();

      if (!user || !user.password_reset_otp) {
        throw new AppError('Invalid or expired OTP', 400, 'INVALID_OTP');
      }

      // Check expiry
      if (new Date() > new Date(user.password_reset_otp_expires_at)) {
        throw new AppError('OTP has expired. Please request a new one.', 400, 'OTP_EXPIRED');
      }

      // Verify OTP
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      if (otpHash !== user.password_reset_otp) {
        throw new AppError('Invalid OTP. Please check and try again.', 400, 'INVALID_OTP');
      }

      // Hash new password and update
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          password_reset_otp: null,
          password_reset_otp_expires_at: null,
          last_password_reset_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: 'self',
        action: 'password_reset',
        resourceType: 'user',
        resourceId: user.id,
      });

      logger.info({ message: 'Password reset successful', email: user.email });
      res.json({ success: true, message: 'Password updated successfully. You can now log in.' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
