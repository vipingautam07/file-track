const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { rateLimit } = require('express-rate-limit');

const supabase = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');
const { writeAuditLog } = require('../services/auditService');

const router = express.Router();

// Stricter rate limiting for signup — prevent spam
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: { message: 'Too many signup attempts. Please try again later.', code: 'RATE_LIMITED' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/signup
 * Public registration — always creates a CUSTOMER account.
 * Admin can later promote via PATCH /api/users/:id.
 */
router.post(
  '/',
  signupLimiter,
  [
    body('fullName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be 2–100 characters'),
    body('email')
      .isEmail()
      .withMessage('Enter a valid email address'),
    body('phone')
      .optional({ checkFalsy: true })
      .matches(/^(\+91[\-\s]?)?[6-9]\d{9}$/)
      .withMessage('Enter a valid Indian mobile number'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
    body('confirmPassword').custom((val, { req }) => {
      if (val !== req.body.password) throw new Error('Passwords do not match');
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR'));
      }

      const { fullName, email, phone, password } = req.body;

      // Check if email already exists
      const { data: existing } = await supabase
        .from('users')
        .select('id, deleted_at')
        .eq('email', email)
        .single();

      if (existing && !existing.deleted_at) {
        return next(new AppError('An account with this email already exists', 409, 'DUPLICATE_EMAIL'));
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const { data: user, error } = await supabase
        .from('users')
        .insert({
          email,
          full_name: fullName,
          phone: phone || null,
          role: 'customer', // Always customer on public signup
          password_hash: passwordHash,
          is_active: true,
          email_verified: false, // Can add email verification later
        })
        .select('id, email, full_name, role, created_at')
        .single();

      if (error) {
        return next(new AppError('Failed to create account. Please try again.', 500, 'DB_ERROR'));
      }

      await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: 'customer',
        actorIp: req.ip,
        action: 'user_created',
        resourceType: 'user',
        resourceId: user.id,
        newValue: { method: 'self_signup', email, fullName },
        requestId: req.requestId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        message: 'Account created successfully. You can now sign in.',
        data: {
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
