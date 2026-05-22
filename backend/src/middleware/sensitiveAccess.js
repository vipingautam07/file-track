'use strict';

/**
 * Sensitive Data Access Logger
 *
 * Logs every access to sensitive routes — file details, user records,
 * audit logs, and customer PII — to both Winston and the audit_logs table.
 * This satisfies "log all access to sensitive data" compliance requirements.
 *
 * Usage:
 *   router.get('/:id', sensitiveAccess('file_detail'), handler);
 */

const logger = require('../config/logger');
const { writeAuditLog } = require('../services/auditService');

/**
 * @param {string} dataType - Human-readable label for what data is being accessed
 * @returns Express middleware
 */
function sensitiveAccess(dataType) {
  return async (req, res, next) => {
    const user = req.user;
    const resourceId = req.params.id || req.params.fileId || req.params.userId || null;

    // Structured log immediately (sync — doesn't delay request)
    logger.info({
      message: 'Sensitive data accessed',
      dataType,
      resourceId,
      userId: user?.id || user?.sub,
      userRole: user?.role,
      ip: req.ip,
      method: req.method,
      path: req.path,
      requestId: req.requestId,
    });

    // Write to persistent audit log asynchronously (don't await — non-blocking)
    writeAuditLog({
      actorId: user?.id || user?.sub,
      actorEmail: user?.email,
      actorRole: user?.role,
      actorIp: req.ip,
      action: `read_${dataType}`,
      resourceType: dataType,
      resourceId,
      requestId: req.requestId,
      userAgent: req.headers['user-agent'],
    }).catch((err) => {
      logger.error({ message: 'sensitiveAccess audit log write failed', error: err.message });
    });

    next();
  };
}

module.exports = { sensitiveAccess };
