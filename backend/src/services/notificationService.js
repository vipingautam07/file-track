'use strict';

const { Resend } = require('resend');
const logger = require('../config/logger');
const supabase = require('../config/supabase');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM
  ? `"${process.env.EMAIL_FROM_NAME || 'Kripanidhi Legal Services'}" <${process.env.EMAIL_FROM}>`
  : 'Kripanidhi Legal Services <onboarding@resend.dev>';

/* ─────────────────────────────────────────────────────────────────
Shared layout wrapper
───────────────────────────────────────────────────────────────── */
const layout = (body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kripanidhi Legal Services</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%);border-radius:16px 16px 0 0;padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-block;margin-bottom:12px;">
                      <img src="https://yiqyfyyxdnyqjbckiria.supabase.co/storage/v1/object/public/assests/logo.jpg" alt="Logo" width="40" height="40" style="display:block;border-radius:8px;" />
                    </div>
                    <h1 style="margin:0 0 2px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Kripanidhi Legal Services</h1>
                    <p style="margin:0 0 1px;color:#93c5fd;font-size:13px;font-weight:600;">&amp; Chitransh Law Services</p>
                    <p style="margin:0;color:#93c5fd;font-size:11px;font-weight:500;">Legal &amp; Banking Services</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
              ${body}

              <!-- Lawyers Strip -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Legal Representatives</p>
                    <table cellpadding="0" cellspacing="0" style="width:100%;">
                      <tr>
                        <td style="width:50%;padding:0 8px;border-right:1px solid #334155;vertical-align:top;">
                          <div style="display:inline-block;width:28px;height:28px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:50%;text-align:center;line-height:28px;font-size:11px;font-weight:900;color:#f59e0b;margin-bottom:6px;">PS</div>
                          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#ffffff;">Pankaj Shrivastava</p>
                          <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;">Advocate &amp; Legal Consultant</p>
                          <a href="tel:9826992948" style="font-size:11px;font-weight:600;color:#f59e0b;text-decoration:none;">📞9826992948</a>
                        </td>
                        <td style="width:50%;padding:0 8px;vertical-align:top;">
                          <div style="display:inline-block;width:28px;height:28px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:50%;text-align:center;line-height:28px;font-size:11px;font-weight:900;color:#f59e0b;margin-bottom:6px;">NK</div>
                          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#ffffff;">Nitin Katare</p>
                          <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;">Advocate &amp; Legal Consultant</p>
                          <a href="tel:8319954272" style="font-size:11px;font-weight:600;color:#f59e0b;text-decoration:none;">📞 8319954272</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:12px 0 0;font-size:10px;color:#64748b;">📍 Shop No. 8, GSM Tower, Opposite HP Petrol Pump, Beema Kunj, Bhopal</p>
                  </td>
                </tr>
              </table>
              <!-- Footer text -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">This is an automated message from Kripanidhi Legal Services Pvt Ltd.</p>
                    <p style="margin:0;color:#cbd5e1;font-size:11px;">If you did not expect this email, please ignore it. Do not reply to this message.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/* ─────────────────────────────────────────────────────────────────
   Status badge helper
───────────────────────────────────────────────────────────────── */
const statusBadge = (label) =>
  `<span style="display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:100px;padding:5px 14px;font-size:13px;font-weight:600;">${label}</span>`;

/* ─────────────────────────────────────────────────────────────────
   CTA button helper
───────────────────────────────────────────────────────────────── */
const ctaButton = (href, text) =>
  `<a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#1d4ed8 0%,#1e40af 100%);color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:0.2px;margin-top:20px;">${text} →</a>`;

/* ─────────────────────────────────────────────────────────────────
   Email Templates
───────────────────────────────────────────────────────────────── */
const templates = {

  /** Sent to customer when admin creates a new tracking file */
  fileCreated: ({ applicantName, fileNumber, fileToken, loanType, frontendUrl }) => ({
    subject: `Your Legal File Is Ready — ${fileNumber}`,
    html: layout(`
      <p style="margin:0 0 8px;color:#0f172a;font-size:16px;font-weight:600;">Hello, ${applicantName} 👋</p>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
        Your loan verification file has been created and is now being actively tracked by our legal team at Kripanidhi Legal Services.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <tr><td style="padding:6px 0;">
          <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">File Number</span>
          <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#1e3a8a;font-family:monospace;">${fileNumber}</p>
        </td></tr>
        ${loanType ? `<tr><td style="padding:6px 0;border-top:1px solid #e2e8f0;">
          <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Loan Type</span>
          <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#334155;">${loanType}</p>
        </td></tr>` : ''}
        <tr><td style="padding:6px 0;border-top:1px solid #e2e8f0;">
          <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Current Status</span>
          <p style="margin:8px 0 0;">${statusBadge('Documents Received')}</p>
        </td></tr>
      </table>

      <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6;">
        Use the secure link below to track your file's progress, view status updates, and communicate with our legal team in real-time.
      </p>

      ${ctaButton(`${frontendUrl}/track/${fileToken}`, 'Track My File')}

      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;">
        🔒 This link is unique to your file. Bookmark it for future reference.
      </p>
    `),
  }),

  /** Sent when file status changes */
  statusChanged: ({ applicantName, fileNumber, previousStatus, newStatus, newStatusKey, notes, fileToken, frontendUrl }) => {
    // Dictionary to support dynamic subject line mapping if newStatusKey is not provided
    const statusLabels = {
      documents_received: 'Documents Received & Seen',
      review_pending: 'Review Pending',
      additional_documents_required: 'Additional Documents Required',
      completed_proceed_signing: 'Completed & Proceed for Signing',
      completed_approved: 'Completed: Approved',
      completed_rejected: 'Completed: Rejected',
    };

    // Determine step-specific custom HTML & styles
    let stepTitle = 'File Status Updated';
    let stepDescription = `There's a new update on your loan verification file <strong style="color:#1e3a8a;">${fileNumber}</strong>.`;
    let statusBadgeBg = '#eff6ff';
    let statusBadgeBorder = '#bfdbfe';
    let statusBadgeTextColor = '#1d4ed8';
    let customStepHtml = '';

    switch (newStatusKey) {
      case 'documents_received':
        stepTitle = '📂 Documents Successfully Received';
        stepDescription = `We have successfully received all initial documents for your loan verification file <strong style="color:#1e3a8a;">${fileNumber}</strong>. Our team is initiating the preliminary check.`;
        statusBadgeBg = '#f0fdfa';
        statusBadgeBorder = '#ccfbf1';
        statusBadgeTextColor = '#115e59';
        customStepHtml = `
          <div style="margin-top:16px;padding:14px;background:#f0fdfa;border-left:4px solid #0d9488;border-radius:8px;color:#115e59;font-size:13px;line-height:1.5;">
            <strong>Next Step:</strong> Our legal team will verify the authenticity of all submitted papers. No action is required from your side at this moment.
          </div>
        `;
        break;

      case 'review_pending':
        stepTitle = '⚖️ Verification Review in Progress';
        stepDescription = `Your loan verification file <strong style="color:#1e3a8a;">${fileNumber}</strong> is currently being reviewed by our legal panel experts.`;
        statusBadgeBg = '#eff6ff';
        statusBadgeBorder = '#bfdbfe';
        statusBadgeTextColor = '#1d4ed8';
        customStepHtml = `
          <div style="margin-top:16px;padding:14px;background:#eff6ff;border-left:4px solid #2563eb;border-radius:8px;color:#1e40af;font-size:13px;line-height:1.5;">
            <strong>In Progress:</strong> A detailed assessment of all property or loan-related profiles is underway to ensure quick clearance.
          </div>
        `;
        break;

      case 'additional_documents_required':
        stepTitle = '⚠️ Action Required: Additional Documents Requested';
        stepDescription = `Our verification team requires additional documents for your file <strong style="color:#1e3a8a;">${fileNumber}</strong> before we can proceed further.`;
        statusBadgeBg = '#fffbeb';
        statusBadgeBorder = '#fde68a';
        statusBadgeTextColor = '#b45309';
        customStepHtml = `
          <div style="margin-top:16px;padding:14px;background:#fffbeb;border-left:4px solid #d97706;border-radius:8px;color:#b45309;font-size:13px;line-height:1.5;">
            <strong>⚠️ Critical Action Required:</strong> Please check your customer portal immediately using the link below to view the list of requested documents and upload them to avoid delays.
          </div>
        `;
        break;

      case 'completed_proceed_signing':
        stepTitle = '🖋️ Ready for Signature & Signing';
        stepDescription = `Congratulations! The legal review for file <strong style="color:#1e3a8a;">${fileNumber}</strong> is complete, and the file is now ready for signing!`;
        statusBadgeBg = '#f5f3ff';
        statusBadgeBorder = '#ddd6fe';
        statusBadgeTextColor = '#6d28d9';
        customStepHtml = `
          <div style="margin-top:16px;padding:14px;background:#f5f3ff;border-left:4px solid #8b5cf6;border-radius:8px;color:#6d28d9;font-size:13px;line-height:1.5;">
            <strong>🖋️ Execution Phase:</strong> Please arrange to complete the signature process as directed. Feel free to contact our coordinator if you have any questions.
          </div>
        `;
        break;

      case 'completed_approved':
        stepTitle = '✅ File Approved & Cleared';
        stepDescription = `Fantastic news! Your loan file <strong style="color:#1e3a8a;">${fileNumber}</strong> has been officially approved and legally verified!`;
        statusBadgeBg = '#f0fdf4';
        statusBadgeBorder = '#bbf7d0';
        statusBadgeTextColor = '#15803d';
        customStepHtml = `
          <div style="margin-top:16px;padding:14px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:8px;color:#15803d;font-size:13px;line-height:1.5;">
            <strong>🎉 Verification Complete:</strong> The legal approval report has been dispatched to your bank partner. Your verification file is successfully closed as approved!
          </div>
        `;
        break;

      case 'completed_rejected':
        stepTitle = '❌ Review Rejected & Closed';
        stepDescription = `The legal verification check for file <strong style="color:#1e3a8a;">${fileNumber}</strong> has been completed and the file has been rejected.`;
        statusBadgeBg = '#fef2f2';
        statusBadgeBorder = '#fecaca';
        statusBadgeTextColor = '#b91c1c';
        customStepHtml = `
          <div style="margin-top:16px;padding:14px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:8px;color:#b91c1c;font-size:13px;line-height:1.5;">
            <strong>Notification:</strong> The documents submitted did not meet the criteria. Please check the feedback/notes section below or contact support for detailed information.
          </div>
        `;
        break;
    }

    return {
      subject: `File Update: ${fileNumber} — ${statusLabels[newStatusKey] || newStatus}`,
      html: layout(`
        <p style="margin:0 0 8px;color:#0f172a;font-size:16px;font-weight:600;">Hello, ${applicantName}</p>
        <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
          ${stepDescription}
        </p>

        <h2 style="margin:24px 0 12px;color:#0f172a;font-size:18px;font-weight:700;letter-spacing:-0.01em;">${stepTitle}</h2>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
          ${previousStatus ? `<tr><td style="padding:6px 0;">
            <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Previous Status</span>
            <p style="margin:6px 0 0;">${statusBadge(previousStatus)}</p>
          </td></tr>` : ''}
          <tr><td style="padding:6px 0;${previousStatus ? 'border-top:1px solid #e2e8f0;' : ''}">
            <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">New Status</span>
            <p style="margin:6px 0 0;"><span style="display:inline-block;background:${statusBadgeBg};color:${statusBadgeTextColor};border:1px solid ${statusBadgeBorder};border-radius:100px;padding:5px 14px;font-size:13px;font-weight:700;">${newStatus}</span></p>
          </td></tr>
          ${notes ? `<tr><td style="padding:12px 0;border-top:1px solid #e2e8f0;">
            <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Note from Legal Team</span>
            <p style="margin:6px 0 0;color:#334155;font-size:14px;line-height:1.5;font-style:italic;">"${notes}"</p>
          </td></tr>` : ''}
        </table>

        ${customStepHtml}

        <div style="margin-top:24px;margin-bottom:24px;">
          ${ctaButton(`${frontendUrl}/track/${fileToken}`, 'View Full Status')}
        </div>
      `),
    };
  },

  /** Sent when admin posts a public comment */
  publicComment: ({ applicantName, fileNumber, commentContent, fileToken, frontendUrl }) => ({
    subject: `New Message on Your File — ${fileNumber}`,
    html: layout(`
      <p style="margin:0 0 8px;color:#0f172a;font-size:16px;font-weight:600;">Hello, ${applicantName}</p>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
        Our legal team has posted a message regarding your file <strong style="color:#1e3a8a;">${fileNumber}</strong>:
      </p>

      <div style="background:#f8fafc;border-left:4px solid #1d4ed8;border-radius:0 12px 12px 0;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;">${commentContent}</p>
      </div>

      <p style="margin:0 0 4px;color:#475569;font-size:14px;">You can reply to this message directly from your tracking portal.</p>
      ${ctaButton(`${frontendUrl}/track/${fileToken}`, 'Reply Now')}
    `),
  }),

  /** Magic link for customers without password */
  magicLink: ({ applicantName, magicUrl, fileNumber }) => ({
    subject: `Secure Access Link — File ${fileNumber}`,
    html: layout(`
      <p style="margin:0 0 8px;color:#0f172a;font-size:16px;font-weight:600;">Hello, ${applicantName}</p>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
        Here is your one-time secure access link for file <strong style="color:#1e3a8a;">${fileNumber}</strong>.
        This link will expire in <strong>2 months</strong>.
      </p>

      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#92400e;font-weight:600;">⚠️ Single-use link — do not share with anyone</p>
      </div>

      ${ctaButton(magicUrl, 'Access My File Securely')}

      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;">
        Didn't request this? You can safely ignore this email.
      </p>
    `),
  }),

  /** Password reset OTP */
  passwordResetOtp: ({ applicantName, otp }) => ({
    subject: `Your Password Reset OTP — Kripanidhi Legal`,
    html: layout(`
      <p style="margin:0 0 8px;color:#0f172a;font-size:16px;font-weight:600;">Hello, ${applicantName}</p>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
        We received a request to reset your password. Use the OTP below to proceed.
        This code is valid for <strong>10 minutes</strong>.
      </p>

      <div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;">Your OTP Code</p>
        <p style="margin:0;font-size:40px;font-weight:900;color:#1e3a8a;letter-spacing:12px;font-family:monospace;">${otp}</p>
      </div>

      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#92400e;font-weight:600;">⚠️ Do not share this OTP with anyone. It expires in 10 minutes.</p>
      </div>

      <p style="margin:0;color:#94a3b8;font-size:12px;">
        Didn't request this? Your account is safe — you can ignore this email.
      </p>
    `),
  }),
};

/* ─────────────────────────────────────────────────────────────────
   Per-recipient throttle check
   Returns true if a notification was already sent to this recipient
   within the last NOTIFICATION_THROTTLE_MINUTES (default: 2 min).
   Prevents email floods when multiple events fire in quick succession.
──────────────────────────────────────────────────────────────── */
const isThrottled = async (recipientId, channel) => {
  const throttleMinutes = parseInt(process.env.NOTIFICATION_THROTTLE_MINUTES || '2', 10);
  const since = new Date(Date.now() - throttleMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .eq('recipient_id', recipientId)
    .eq('channel', channel)
    .eq('status', 'sent')
    .gte('sent_at', since)
    .limit(1);

  if (error) {
    logger.warn({ message: 'Throttle check DB error', error: error.message });
    return false; // fail open — allow send on DB error
  }

  return data && data.length > 0;
};

/* ─────────────────────────────────────────────────────────────────
   Core send function
──────────────────────────────────────────────────────────────── */
const sendEmail = async ({ to, subject, html, notificationId }) => {
  try {
    // ── Resend sandbox guard ──────────────────────────────────────────
    // Resend free-tier only delivers to the verified owner address.
    // RESEND_SANDBOX_EMAIL in .env redirects all dev mail there.
    const sandboxEmail = process.env.RESEND_SANDBOX_EMAIL;
    const inDev = process.env.NODE_ENV !== 'production';
    const recipient = Array.isArray(to) ? to : [to];
    const actualTo = (inDev && sandboxEmail) ? [sandboxEmail] : recipient;
    const actualSubject = (inDev && sandboxEmail)
      ? `[DEV → ${recipient.join(', ')}] ${subject}`
      : subject;

    const { error } = await resend.emails.send({
      from: FROM,
      to: actualTo,
      subject: actualSubject,
      html,
    });

    if (error) throw new Error(error.message);

    if (notificationId) {
      await supabase
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notificationId);
    }

    logger.info({ message: 'Email sent via Resend', to: actualTo, subject: actualSubject });
    return true;
  } catch (err) {
    logger.error({ message: 'Resend email failed', error: err.message, to, notificationId });

    if (notificationId) {
      await supabase
        .from('notifications')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: err.message,
        })
        .eq('id', notificationId);
    }
    return false;
  }
};

/* ─────────────────────────────────────────────────────────────────
   Queue + send helper (logs to notifications table)
──────────────────────────────────────────────────────────────── */
const queueNotification = async ({
  recipientId,
  recipientEmail,
  fileId,
  triggeredBy,
  channel = 'email',
  subject,
  body,
  html,
}) => {
  try {
    // ── Throttle: skip if a notification was recently sent to this recipient ──
    if (recipientId) {
      const throttled = await isThrottled(recipientId, channel);
      if (throttled) {
        logger.warn({
          message: 'Notification throttled — skipping duplicate send',
          recipientId,
          recipientEmail,
          channel,
          subject,
          fileId: fileId || null,
        });
        return true; // treated as success — no error from caller's perspective
      }
    }

    // ── Log to notifications table ────────────────────────────────────
    const { data: notif, error } = await supabase
      .from('notifications')
      .insert({
        recipient_id: recipientId,
        recipient_email: recipientEmail,
        file_id: fileId || null,
        triggered_by: triggeredBy || null,
        channel,
        subject: subject || null,
        body: body || subject || '',
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    logger.info({
      message: 'Notification queued',
      notificationId: notif.id,
      recipientId,
      recipientEmail,
      channel,
      subject,
      fileId: fileId || null,
      triggeredBy: triggeredBy || null,
    });

    // ── Send ────────────────────────────────────────────────────
    if (channel === 'email') {
      const emailSent = await sendEmail({
        to: recipientEmail,
        subject,
        html: html || `<p>${body}</p>`,
        notificationId: notif.id,
      });

      logger.info({
        message: emailSent ? 'Notification sent' : 'Notification send failed',
        notificationId: notif.id,
        recipientId,
        channel,
        success: emailSent,
      });

      return emailSent;
    }

    return true;
  } catch (err) {
    logger.error({
      message: 'Failed to queue notification',
      error: err.message,
      recipientId,
      recipientEmail,
      channel,
      fileId: fileId || null,
    });
    return false;
  }
};

module.exports = { sendEmail, queueNotification, templates };

