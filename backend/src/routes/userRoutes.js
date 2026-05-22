const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');

const supabase = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');
const { writeAuditLog } = require('../services/auditService');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

const validate = (req, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
};

// ── GET /api/users — Admin: list all users ────────────────────────
router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let queryBuilder = supabase
      .from('users')
      .select('id, email, phone, full_name, role, customer_ref, is_active, last_login_at, created_at', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (role) queryBuilder = queryBuilder.eq('role', role);
    if (search) queryBuilder = queryBuilder.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data: users, error, count } = await queryBuilder;
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.json({
      success: true,
      data: { users, total: count, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/users — Admin: create user ─────────────────────────
router.post(
  '/',
  authorize('admin'),
  [
    body('email').isEmail().normalizeEmail(),
    body('fullName').notEmpty().trim(),
    body('role').isIn(['admin', 'bank_member', 'customer']),
    body('phone').optional().isMobilePhone(),
    body('password').if(body('role').isIn(['admin', 'bank_member'])).isLength({ min: 8 }),
    body('customerRef').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      validate(req, next);
      const { email, fullName, role, phone, password, customerRef } = req.body;

      // Check email unique
      const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
      if (existing) throw new AppError('Email already exists', 409, 'DUPLICATE_EMAIL');

      let passwordHash = null;
      if (role !== 'customer' && password) {
        passwordHash = await bcrypt.hash(password, 12);
      }

      const { data: user, error } = await supabase
        .from('users')
        .insert({
          email,
          full_name: fullName,
          role,
          phone: phone || null,
          password_hash: passwordHash,
          customer_ref: customerRef || null,
          is_active: true,
          email_verified: role !== 'customer',
          created_by: req.user.id,
        })
        .select('id, email, full_name, role, phone, customer_ref, created_at')
        .single();

      if (error) throw new AppError(error.message, 500, 'DB_ERROR');

      await writeAuditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        actorIp: req.ip,
        action: 'user_created',
        resourceType: 'user',
        resourceId: user.id,
        newValue: { email, role, fullName },
        requestId: req.requestId,
      });

      res.status(201).json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/users/:id — Get single user ───────────────────────────────
router.get('/:id',
  authorize('admin'),
  [param('id').isUUID().withMessage('Invalid user ID')],
  async (req, res, next) => {
  try {
    validate(req, next);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, phone, full_name, role, customer_ref, is_active, last_login_at, created_at')
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .single();

    if (error || !user) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/users/:id — Admin: update user ───────────────────────────
router.patch(
  '/:id',
  authorize('admin'),
  [
    param('id').isUUID().withMessage('Invalid user ID'),
    body('fullName').optional().notEmpty().trim(),
    body('phone').optional().isMobilePhone(),
    body('isActive').optional().isBoolean(),
    body('password')
      .optional()
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number'),
    body('role')
      .optional()
      .isIn(['admin', 'bank_member', 'customer'])
      .withMessage('Role must be admin, bank_member, or customer'),
  ],
  async (req, res, next) => {
    try {
      validate(req, next);
      const { fullName, phone, isActive, password, role } = req.body;

      // Prevent admin from demoting themselves
      if (role && req.params.id === req.user.id) {
        throw new AppError('You cannot change your own role', 400, 'SELF_ROLE_CHANGE');
      }

      // Fetch current user to get old role for audit
      const { data: currentUser } = await supabase
        .from('users')
        .select('id, role, full_name')
        .eq('id', req.params.id)
        .is('deleted_at', null)
        .single();

      if (!currentUser) throw new AppError('User not found', 404, 'NOT_FOUND');

      const updates = {};
      if (fullName !== undefined) updates.full_name = fullName;
      if (phone !== undefined) updates.phone = phone;
      if (isActive !== undefined) updates.is_active = isActive;
      if (password) updates.password_hash = await bcrypt.hash(password, 12);
      if (role !== undefined) updates.role = role;

      const { data: user, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', req.params.id)
        .is('deleted_at', null)
        .select('id, email, full_name, role, is_active')
        .single();

      if (error || !user) throw new AppError('User not found', 404, 'NOT_FOUND');

      await writeAuditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        actorIp: req.ip,
        action: role && role !== currentUser.role ? 'role_changed' : 'user_updated',
        resourceType: 'user',
        resourceId: user.id,
        oldValue: role ? { role: currentUser.role } : undefined,
        newValue: { ...updates, password_hash: undefined },
        requestId: req.requestId,
      });

      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  }
);


// ── DELETE /api/users/:id — Admin: soft delete ───────────────────────────
router.delete('/:id',
  authorize('admin'),
  [param('id').isUUID().withMessage('Invalid user ID')],
  async (req, res, next) => {
  try {
    validate(req, next);
    // Prevent self-deletion
    if (req.params.id === req.user.id) {
      throw new AppError('You cannot delete your own account', 400, 'SELF_DELETE');
    }

    const { error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', req.params.id);

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
