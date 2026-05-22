// Utility: Ownership check for customer
async function enforceCustomerOwnsFile(req, res, next) {
  const fileId = req.params.id || req.params.fileId;
  if (!fileId) return next();
  const { data: file, error } = await supabase
    .from('loan_files')
    .select('id, customer_id')
    .eq('id', fileId)
    .is('deleted_at', null)
    .single();
  if (error || !file) return next(new AppError('File not found', 404, 'FILE_NOT_FOUND'));
  if (req.user.role === 'customer' && file.customer_id !== req.user.id) {
    return next(new AppError('Access denied', 403, 'FORBIDDEN'));
  }
  next();
}
const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { rateLimit } = require('express-rate-limit');

const supabase = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');
const { sensitiveAccess } = require('../middleware/sensitiveAccess');
const { writeAuditLog } = require('../services/auditService');
const { queueNotification, templates } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate);

// Rate limiter for mutating file operations
const fileMutateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many file operations, slow down', code: 'RATE_LIMITED' } },
});

const validate = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
};

const STATUS_LABELS = {
  documents_received: 'Documents Received & Seen',
  review_pending: 'Processing',
  additional_documents_required: 'Additional Documents Required',
  completed_proceed_signing: 'Proceed for Signing',
  completed_approved: 'Approved',
  completed_rejected: 'Rejected',
};

// ── GET /api/files — List files ────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, assignedTo, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const search = typeof req.query.search === 'string'
      ? req.query.search.trim().slice(0, 100)
      : undefined;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // ── Bank members must provide a search query — no browsing all files ──
    if (req.user.role === 'bank_member' && !search) {
      return res.json({
        success: true,
        data: { files: [], total: 0, page: 1, limit: parseInt(limit) },
      });
    }

    // Select fewer fields for bank_member — no customer PII
    const selectFields = req.user.role === 'bank_member'
      ? `id, file_number, applicant_name, current_status, loan_type,
         bank_reference, is_closed, created_at, updated_at,
         assigned_admin:users!loan_files_assigned_admin_id_fkey(id, full_name)`
      : `id, file_number, secure_token, applicant_name, applicant_email, applicant_phone,
         current_status, loan_type, bank_reference, is_closed, created_at, updated_at,
         assigned_admin:users!loan_files_assigned_admin_id_fkey(id, full_name, email),
         customer:users!loan_files_customer_id_fkey(id, full_name, email)`;

    let queryBuilder = supabase
      .from('loan_files')
      .select(selectFields, { count: 'exact' })
      .is('deleted_at', null)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    // Role-based filtering
    if (req.user.role === 'customer') {
      queryBuilder = queryBuilder.eq('customer_id', req.user.id);
    }
    // admin sees all; bank_member sees all (but only after search)

    if (status) queryBuilder = queryBuilder.eq('current_status', status);
    if (assignedTo) queryBuilder = queryBuilder.eq('assigned_admin_id', assignedTo);
    if (search) {
      // Bank members can search by file_number or applicant_email only
      if (req.user.role === 'bank_member') {
        queryBuilder = queryBuilder.or(
          `file_number.ilike.%${search}%,applicant_email.ilike.%${search}%`
        );
      } else {
        queryBuilder = queryBuilder.or(
          `file_number.ilike.%${search}%,applicant_name.ilike.%${search}%,applicant_email.ilike.%${search}%,bank_reference.ilike.%${search}%`
        );
      }
    }

    const { data: files, error, count } = await queryBuilder;
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    // secure_token is only for admin
    const sanitized = files.map((f) => {
      if (req.user.role !== 'admin') {
        const { secure_token, ...rest } = f;
        return rest;
      }
      return f;
    });

    res.json({
      success: true,
      data: { files: sanitized, total: count, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/files — Admin: create file ─────────────────────────
router.post(
  '/',
  authorize('admin'),
  fileMutateLimiter,
  [
    body('fileNumber').notEmpty().trim().withMessage('File number required'),
    body('bankEmails').optional().isArray().withMessage('bankEmails must be an array'),
    body('bankEmails.*').optional().isEmail().normalizeEmail().withMessage('Each bank email must be valid'),
  ],
  async (req, res, next) => {
    try {
      validate(req);
      const { fileNumber, bankEmails } = req.body;

      // Deduplicate and validate recipient list
      const recipients = Array.isArray(bankEmails)
        ? [...new Set(bankEmails.filter((e) => typeof e === 'string' && e.includes('@')))]
        : [];

      // Check file number is unique
      const { data: existing } = await supabase
        .from('loan_files').select('id').eq('file_number', fileNumber).single();
      if (existing) throw new AppError('File number already exists', 409, 'DUPLICATE_FILE_NUMBER');

      const { data: file, error } = await supabase
        .from('loan_files')
        .insert({
          file_number: fileNumber,
          current_status: 'documents_received',
          documents_received_at: new Date().toISOString(),
          assigned_admin_id: req.user.id,
          // Persist the bank recipient list so future notifications know who to email
          bank_recipient_emails: recipients,
        })
        .select()
        .single();

      if (error) throw new AppError(error.message, 500, 'DB_ERROR');

      // Create initial status history
      await supabase.from('status_history').insert({
        file_id: file.id,
        previous_status: null,
        new_status: 'documents_received',
        changed_by: req.user.id,
        changed_by_role: req.user.role,
        notes: 'File created',
      });

      await writeAuditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        actorIp: req.ip,
        action: 'file_created',
        resourceType: 'loan_file',
        resourceId: file.id,
        newValue: { fileNumber, recipientCount: recipients.length },
        requestId: req.requestId,
      });

      // Send branded tracking link email to every bank recipient
      if (recipients.length > 0) {
        const trackUrl = `${process.env.FRONTEND_URL}/track/${file.secure_token}`;
        const tmpl = templates.fileCreated({
          applicantName: 'Team',          // no applicant name — addressed to bank
          fileNumber: file.file_number,
          fileToken: file.secure_token,
          loanType: null,
          frontendUrl: process.env.FRONTEND_URL,
        });
        await Promise.allSettled(
          recipients.map((email) =>
            queueNotification({
              recipientId: null,          // bank personnel are not system users
              recipientEmail: email,
              fileId: file.id,
              triggeredBy: req.user.id,
              channel: 'email',
              subject: tmpl.subject,
              body: `Tracking file ${file.file_number} is ready. Link: ${trackUrl}`,
              html: tmpl.html,
            })
          )
        );
      }

      res.status(201).json({ success: true, data: { file } });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/files/track/:token — Public tracking by secure token ─
router.get('/track/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const { data: file, error } = await supabase
      .from('loan_files')
      .select(
        `id, file_number, secure_token, applicant_name, current_status, loan_type,
         bank_reference, documents_received_at, completed_at, created_at, updated_at,
         customer_id,
         status_history(id, previous_status, new_status, notes, created_at),
         comments(id, comment_type, content, is_visible_to_customer, created_at, author_role,
           author:users!comments_author_id_fkey(id, full_name, role))
        `
      )
      .eq('secure_token', token)
      .is('deleted_at', null)
      .single();

    if (error || !file) throw new AppError('File not found', 404, 'FILE_NOT_FOUND');

    // Access control
    if (req.user.role === 'customer' && file.customer_id !== req.user.id) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Filter comments based on role
    let filteredComments = file.comments || [];
    if (req.user.role === 'customer') {
      filteredComments = filteredComments.filter((c) => c.is_visible_to_customer !== false && c.comment_type !== 'internal_note');
    }

    // Sort status history
    const history = (file.status_history || []).sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    res.json({
      success: true,
      data: {
        file: {
          ...file,
          status_history: history,
          comments: filteredComments,
          customer_id: undefined, // don't expose
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/files/:id — Get file detail ──────────────────────────────
router.get('/:id',
  [param('id').isUUID().withMessage('Invalid file ID')],
  enforceCustomerOwnsFile,
  sensitiveAccess('file_detail'),
  async (req, res, next) => {
  try {
    validate(req);
    const { data: file, error } = await supabase
      .from('loan_files')
      .select(
        `*, 
         customer:users!loan_files_customer_id_fkey(id, full_name, email, phone, customer_ref),
         assigned_admin:users!loan_files_assigned_admin_id_fkey(id, full_name, email),
         status_history(id, previous_status, new_status, changed_by_role, notes, created_at,
           changed_by:users!status_history_changed_by_fkey(id, full_name)),
         comments(id, comment_type, content, is_visible_to_customer, created_at, parent_id,
           author:users!comments_author_id_fkey(id, full_name, role))
        `
      )
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .single();

    if (error || !file) throw new AppError('File not found', 404, 'FILE_NOT_FOUND');

    // Customer can only access their own file
    if (req.user.role === 'customer' && file.customer_id !== req.user.id) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Filter internal notes for customers and bank members
    let comments = file.comments || [];
    if (req.user.role !== 'admin') {
      comments = comments.filter((c) => c.comment_type !== 'internal_note');
    }

    // Strip customer PII for bank members — they get case info but not personal data
    let fileData = { ...file, comments, status_history: (file.status_history || []).sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    )};
    if (req.user.role === 'bank_member') {
      const { applicant_email, applicant_phone, customer, secure_token, customer_id, ...rest } = fileData;
      fileData = rest;
    }

    res.json({ success: true, data: { file: fileData } });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/files/:id/status — Admin: update status ───────────────────
router.patch(
  '/:id/status',
  authorize('admin'),
  fileMutateLimiter,
  [
    param('id').isUUID().withMessage('Invalid file ID'),
    body('status').isIn(Object.keys(STATUS_LABELS)).withMessage('Invalid status'),
    body('notes').optional().trim(),
    body('notify').optional().isBoolean(),
  ],
  enforceCustomerOwnsFile,
  async (req, res, next) => {
    try {
      validate(req);
      const { status, notes, notify = true } = req.body;

      const { data: file, error: fetchErr } = await supabase
        .from('loan_files')
        .select('id, file_number, secure_token, current_status, is_closed, bank_recipient_emails')
        .eq('id', req.params.id)
        .is('deleted_at', null)
        .single();

      if (fetchErr || !file) throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
      if (file.is_closed) throw new AppError('Cannot update status of a closed file', 400, 'FILE_CLOSED');

      const previousStatus = file.current_status;
      if (previousStatus === status) throw new AppError('File already has this status', 400, 'SAME_STATUS');

      const updates = { current_status: status };
      if (status === 'completed_approved' || status === 'completed_rejected') {
        updates.completed_at = new Date().toISOString();
        updates.is_closed = true;
        updates.closed_at = new Date().toISOString();
        updates.closed_by = req.user.id;
      }

      const { error: updateErr } = await supabase
        .from('loan_files')
        .update(updates)
        .eq('id', req.params.id);

      if (updateErr) throw new AppError(updateErr.message, 500, 'DB_ERROR');

      // Immutable status history
      await supabase.from('status_history').insert({
        file_id: file.id,
        previous_status: previousStatus,
        new_status: status,
        changed_by: req.user.id,
        changed_by_role: req.user.role,
        notes: notes || null,
      });

      await writeAuditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        actorIp: req.ip,
        action: 'status_changed',
        resourceType: 'loan_file',
        resourceId: file.id,
        oldValue: { status: previousStatus },
        newValue: { status },
        requestId: req.requestId,
      });

      // Emit realtime event
      req.app.get('io')?.to(`file:${file.id}`).emit('status_changed', {
        fileId: file.id,
        previousStatus,
        newStatus: status,
        changedAt: new Date().toISOString(),
      });

      // Notify bank recipients on every status change
      let emailQueued = false;
      if (notify) {
        const bankEmails = Array.isArray(file.bank_recipient_emails)
          ? file.bank_recipient_emails.filter(Boolean)
          : [];

        if (bankEmails.length > 0) {
          const tmpl = templates.statusChanged({
            fileNumber: file.file_number,
            applicantName: 'Team',
            previousStatus: STATUS_LABELS[previousStatus] || null,
            newStatus: STATUS_LABELS[status],
            newStatusKey: status,
            notes: notes || null,
            fileToken: file.secure_token,
            frontendUrl: process.env.FRONTEND_URL,
          });
          const results = await Promise.allSettled(
            bankEmails.map((email) =>
              queueNotification({
                recipientId: null,
                recipientEmail: email,
                fileId: file.id,
                triggeredBy: req.user.id,
                channel: 'email',
                subject: tmpl.subject,
                body: `Status updated to: ${STATUS_LABELS[status]}`,
                html: tmpl.html,
              })
            )
          );
          emailQueued = results.some((r) => r.status === 'fulfilled' && r.value === true);
        }
      }

      res.json({ success: true, data: { status, previousStatus, emailQueued } });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/files/:id/resend-link — Admin: resend tracking link to all bank recipients ──
router.post(
  '/:id/resend-link',
  authorize('admin'),
  fileMutateLimiter,
  [param('id').isUUID().withMessage('Invalid file ID')],
  async (req, res, next) => {
    try {
      validate(req);
      const { data: file, error } = await supabase
        .from('loan_files')
        .select('id, file_number, secure_token, bank_recipient_emails')
        .eq('id', req.params.id)
        .is('deleted_at', null)
        .single();

      if (error || !file) throw new AppError('File not found', 404, 'FILE_NOT_FOUND');

      const recipients = Array.isArray(file.bank_recipient_emails)
        ? file.bank_recipient_emails.filter(Boolean)
        : [];

      if (recipients.length === 0) {
        throw new AppError('No bank recipients configured for this file', 400, 'NO_RECIPIENTS');
      }

      const trackUrl = `${process.env.FRONTEND_URL}/track/${file.secure_token}`;
      const tmpl = templates.fileCreated({
        applicantName: 'Team',
        fileNumber: file.file_number,
        fileToken: file.secure_token,
        loanType: null,
        frontendUrl: process.env.FRONTEND_URL,
      });

      const results = await Promise.allSettled(
        recipients.map((email) =>
          queueNotification({
            recipientId: null,
            recipientEmail: email,
            fileId: file.id,
            triggeredBy: req.user.id,
            channel: 'email',
            subject: tmpl.subject,
            body: `Tracking link for file ${file.file_number}: ${trackUrl}`,
            html: tmpl.html,
          })
        )
      );

      const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;

      await writeAuditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        actorIp: req.ip,
        action: 'tracking_link_resent',
        resourceType: 'loan_file',
        resourceId: file.id,
        newValue: { recipientCount: recipients.length, sent },
        requestId: req.requestId,
      });

      res.json({ success: true, data: { sent, total: recipients.length } });
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/files/:id — Admin: update file details ────────────────────
router.patch(
  '/:id',
  authorize('admin'),
  fileMutateLimiter,
  [
    param('id').isUUID().withMessage('Invalid file ID'),
    body('assignedAdminId').optional().isUUID(),
    body('bankReference').optional().trim(),
    body('loanAmount').optional().isNumeric(),
    body('targetCompletionDate').optional().isDate(),
    body('propertyAddress').optional().trim(),
  ],
  enforceCustomerOwnsFile,
  async (req, res, next) => {
    try {
      validate(req);
      const { assignedAdminId, bankReference, loanAmount, targetCompletionDate, propertyAddress } = req.body;

      const updates = {};
      if (assignedAdminId !== undefined) updates.assigned_admin_id = assignedAdminId;
      if (bankReference !== undefined) updates.bank_reference = bankReference;
      if (loanAmount !== undefined) updates.loan_amount = loanAmount;
      if (targetCompletionDate !== undefined) updates.target_completion_date = targetCompletionDate;
      if (propertyAddress !== undefined) updates.property_address = propertyAddress;

      const { data: file, error } = await supabase
        .from('loan_files')
        .update(updates)
        .eq('id', req.params.id)
        .is('deleted_at', null)
        .select()
        .single();

      if (error || !file) throw new AppError('File not found', 404, 'FILE_NOT_FOUND');

      await writeAuditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        actorIp: req.ip,
        action: 'file_updated',
        resourceType: 'loan_file',
        resourceId: file.id,
        newValue: updates,
        requestId: req.requestId,
      });

      res.json({ success: true, data: { file } });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/files/:id/reopen — Admin: reopen closed file ────────────────
router.post('/:id/reopen',
  authorize('admin'),
  [param('id').isUUID().withMessage('Invalid file ID')],
  fileMutateLimiter,
  enforceCustomerOwnsFile,
  async (req, res, next) => {
  try {
    validate(req);
    const { data: file, error: fetchErr } = await supabase
      .from('loan_files')
      .select('id, is_closed, current_status, file_number, secure_token, customer:users!loan_files_customer_id_fkey(id, email, full_name)')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !file) throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
    if (!file.is_closed) throw new AppError('File is not closed', 400, 'FILE_NOT_CLOSED');

    await supabase
      .from('loan_files')
      .update({ is_closed: false, closed_at: null, closed_by: null, current_status: 'review_pending' })
      .eq('id', req.params.id);

    await supabase.from('status_history').insert({
      file_id: file.id,
      previous_status: file.current_status,
      new_status: 'review_pending',
      changed_by: req.user.id,
      changed_by_role: req.user.role,
      notes: 'File reopened by admin',
    });

    await writeAuditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'file_reopened',
      resourceType: 'loan_file',
      resourceId: file.id,
      requestId: req.requestId,
    });

    // Notify customer that file is reopened (status changed to review_pending)
    let emailQueued = false;
    if (file.customer) {
      const tmpl = templates.statusChanged({
        fileNumber: file.file_number,
        applicantName: file.customer.full_name,
        previousStatus: STATUS_LABELS[file.current_status] || 'Closed',
        newStatus: STATUS_LABELS['review_pending'],
        newStatusKey: 'review_pending',
        notes: 'File reopened by admin',
        fileToken: file.secure_token,
        frontendUrl: process.env.FRONTEND_URL,
      });
      emailQueued = await queueNotification({
        recipientId: file.customer.id,
        recipientEmail: file.customer.email,
        fileId: file.id,
        triggeredBy: req.user.id,
        channel: 'email',
        subject: tmpl.subject,
        body: `Status updated: Review Pending`,
        html: tmpl.html,
      });
    }

    res.json({ success: true, message: 'File reopened', data: { emailQueued } });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/files/:id — Admin: soft delete ────────────────────────────
router.delete('/:id',
  authorize('admin'),
  [param('id').isUUID().withMessage('Invalid file ID')],
  fileMutateLimiter,
  async (req, res, next) => {
  try {
    validate(req);
    const { error } = await supabase
      .from('loan_files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    await writeAuditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'file_updated',
      resourceType: 'loan_file',
      resourceId: req.params.id,
      newValue: { deleted: true },
      requestId: req.requestId,
    });

    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/files/:id/audit — Get audit history ──────────────────────────
router.get('/:id/audit',
  authorize('admin', 'bank_member'),
  [param('id').isUUID().withMessage('Invalid file ID')],
  async (req, res, next) => {
  try {
    validate(req);
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('resource_id', req.params.id)
      .eq('resource_type', 'loan_file')
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    res.json({ success: true, data: { logs } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/files/analytics/summary — Dashboard stats ───────────
router.get('/analytics/summary', authorize('admin', 'bank_member'), async (req, res, next) => {
  try {
    const statuses = [
      'documents_received', 'review_pending', 'additional_documents_required',
      'completed_proceed_signing', 'completed_approved', 'completed_rejected',
    ];

    const counts = {};
    for (const s of statuses) {
      const { count } = await supabase
        .from('loan_files')
        .select('id', { count: 'exact', head: true })
        .eq('current_status', s)
        .is('deleted_at', null);
      counts[s] = count || 0;
    }

    const { count: total } = await supabase
      .from('loan_files')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null);

    const { count: openFiles } = await supabase
      .from('loan_files')
      .select('id', { count: 'exact', head: true })
      .eq('is_closed', false)
      .is('deleted_at', null);

    res.json({
      success: true,
      data: {
        total: total || 0,
        open: openFiles || 0,
        closed: (total || 0) - (openFiles || 0),
        byStatus: counts,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
