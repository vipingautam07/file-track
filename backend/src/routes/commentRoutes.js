const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { rateLimit } = require('express-rate-limit');

const supabase = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');
const { writeAuditLog } = require('../services/auditService');
const { queueNotification, templates } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate);

/** Strip HTML tags from user-supplied content to prevent XSS */
function stripHtml(str) {
  return typeof str === 'string' ? str.replace(/<[^>]*>/g, '').trim() : str;
}

/** Rate limit: 20 new comments per 15 minutes per IP */
const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many comment submissions', code: 'RATE_LIMITED' } },
});

const validate = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
};

// ── GET /api/comments/:fileId — Get comments for a file ───────────────
router.get('/:fileId',
  [param('fileId').isUUID().withMessage('Invalid file ID')],
  async (req, res, next) => {
  try {
    validate(req);
    const { fileId } = req.params;

    // Verify file access
    const { data: file } = await supabase
      .from('loan_files')
      .select('id, customer_id, secure_token, file_number, applicant_email, applicant_name')
      .eq('id', fileId)
      .is('deleted_at', null)
      .single();

    if (!file) throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
    if (req.user.role === 'customer' && file.customer_id !== req.user.id) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    let queryBuilder = supabase
      .from('comments')
      .select(
        `id, comment_type, content, is_visible_to_customer, parent_id, created_at, updated_at,
         author:users!comments_author_id_fkey(id, full_name, role)`
      )
      .eq('file_id', fileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    // Filter internal notes for non-admins
    if (req.user.role !== 'admin') {
      queryBuilder = queryBuilder.neq('comment_type', 'internal_note');
    }

    const { data: comments, error } = await queryBuilder;
    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.json({ success: true, data: { comments } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/comments/:fileId — Add a comment ───────────────────
// Ownership check for comments
async function enforceCustomerOwnsFile(req, res, next) {
  const fileId = req.params.fileId;
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

router.post(
  '/:fileId',
  commentLimiter,
  [
    param('fileId').isUUID().withMessage('Invalid file ID'),
    body('content').notEmpty().trim().isLength({ max: 5000 }).withMessage('Comment content required (max 5000 chars)'),
    body('commentType')
      .isIn(['internal_note', 'public_comment', 'customer_reply'])
      .withMessage('Invalid comment type'),
    body('parentId').optional().isUUID(),
  ],
  enforceCustomerOwnsFile,
  async (req, res, next) => {
    try {
      validate(req);
      const { fileId } = req.params;
      // Strip HTML from content before storing
      const content = stripHtml(req.body.content);
      const { commentType, parentId } = req.body;

      // Fetch file
      const { data: file } = await supabase
        .from('loan_files')
        .select('id, customer_id, secure_token, file_number, applicant_email, applicant_name, customer:users!loan_files_customer_id_fkey(id, email, full_name)')
        .eq('id', fileId)
        .is('deleted_at', null)
        .single();

      if (!file) throw new AppError('File not found', 404, 'FILE_NOT_FOUND');

      // Authorization rules for comment types
      const { role } = req.user;
      if (commentType === 'internal_note' && role !== 'admin') {
        throw new AppError('Only admins can add internal notes', 403, 'FORBIDDEN');
      }
      if (commentType === 'public_comment' && role === 'customer') {
        throw new AppError('Customers must use customer_reply type', 403, 'FORBIDDEN');
      }
      if (commentType === 'customer_reply') {
        if (role !== 'customer') {
          throw new AppError('Only customers can add replies', 403, 'FORBIDDEN');
        }
        if (file.customer_id !== req.user.id) {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        }
        // Must have a parent public comment
        if (!parentId) {
          throw new AppError('Customer replies must reference a parent comment', 400, 'PARENT_REQUIRED');
        }
        const { data: parent } = await supabase
          .from('comments').select('id, comment_type').eq('id', parentId).single();
        if (!parent || parent.comment_type !== 'public_comment') {
          throw new AppError('Parent must be a public comment', 400, 'INVALID_PARENT');
        }
      }

      // bank_member can only post public_comment (already enforced above)

      const { data: comment, error } = await supabase
        .from('comments')
        .insert({
          file_id: fileId,
          author_id: req.user.id,
          author_role: role,
          comment_type: commentType,
          parent_id: parentId || null,
          content,
        })
        .select(`id, comment_type, content, is_visible_to_customer, parent_id, created_at,
                  author:users!comments_author_id_fkey(id, full_name, role)`)
        .single();

      if (error) throw new AppError(error.message, 500, 'DB_ERROR');

      await writeAuditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: role,
        actorIp: req.ip,
        action: commentType === 'internal_note' ? 'note_added' : commentType === 'customer_reply' ? 'customer_reply_added' : 'comment_added',
        resourceType: 'comment',
        resourceId: comment.id,
        newValue: { fileId, commentType },
        requestId: req.requestId,
      });

      // Emit realtime
      req.app.get('io')?.to(`file:${fileId}`).emit('comment_added', { comment });

      // Notify customer for public comments
      if (commentType === 'public_comment' && file.customer) {
        const tmpl = templates.publicComment({
          applicantName: file.customer.full_name,
          fileNumber: file.file_number,
          commentContent: content,
          fileToken: file.secure_token,
          frontendUrl: process.env.FRONTEND_URL,
        });
        await queueNotification({
          recipientId: file.customer.id,
          recipientEmail: file.customer.email,
          fileId: file.id,
          triggeredBy: req.user.id,
          channel: 'email',
          subject: tmpl.subject,
          body: content,
          html: tmpl.html,
        });
      }

      // Notify admin of customer reply (in-app)
      if (commentType === 'customer_reply') {
        await supabase.from('in_app_notifications').insert({
          user_id: file.assigned_admin_id || req.user.id,
          file_id: fileId,
          title: 'Customer Reply',
          message: `${req.user.full_name} replied on file ${file.file_number}`,
          action_url: `/admin/files/${fileId}`,
        });
      }

      res.status(201).json({ success: true, data: { comment } });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/comments/:fileId/:commentId — Admin soft delete ────────────
router.delete('/:fileId/:commentId',
  authorize('admin'),
  [
    param('fileId').isUUID().withMessage('Invalid file ID'),
    param('commentId').isUUID().withMessage('Invalid comment ID'),
  ],
  async (req, res, next) => {
  try {
    validate(req);
    const { error } = await supabase
      .from('comments')
      .update({ deleted_at: new Date().toISOString(), deleted_by: req.user.id })
      .eq('id', req.params.commentId)
      .eq('file_id', req.params.fileId);

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
