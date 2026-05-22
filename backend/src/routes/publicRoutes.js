'use strict';

const express = require('express');
const supabase = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/public/track/:token
 * Fully public — no JWT required.
 * Customers click the link in their email and land here directly.
 */
router.get('/track/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const { data: file, error } = await supabase
      .from('loan_files')
      .select(
        `id, file_number, applicant_name, current_status, loan_type,
         bank_reference, documents_received_at, completed_at, created_at, updated_at,
         status_history(id, previous_status, new_status, notes, created_at),
         comments(id, comment_type, content, is_visible_to_customer, created_at, author_role,
           author:users!comments_author_id_fkey(id, full_name, role))`
      )
      .eq('secure_token', token)
      .is('deleted_at', null)
      .single();

    if (error || !file) throw new AppError('File not found or link is invalid', 404, 'FILE_NOT_FOUND');

    // Only expose customer-visible comments
    const comments = (file.comments || []).filter(
      (c) => c.is_visible_to_customer !== false && c.comment_type !== 'internal_note'
    );

    const history = (file.status_history || []).sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    res.json({
      success: true,
      data: {
        file: {
          ...file,
          comments,
          status_history: history,
          // secure_token intentionally not included
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
