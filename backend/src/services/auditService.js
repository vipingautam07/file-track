const supabase = require('../config/supabase');
const logger = require('../config/logger');

/**
 * Append-only audit log writer.
 * Never throws — audit failures should not break business logic.
 */
const writeAuditLog = async ({
  actorId,
  actorEmail,
  actorRole,
  actorIp,
  action,
  resourceType,
  resourceId,
  oldValue,
  newValue,
  requestId,
  userAgent,
}) => {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      actor_id: actorId || null,
      actor_email: actorEmail || null,
      actor_role: actorRole || null,
      actor_ip: actorIp || null,
      action,
      resource_type: resourceType,
      resource_id: resourceId || null,
      old_value: oldValue || null,
      new_value: newValue || null,
      request_id: requestId || null,
      user_agent: userAgent || null,
    });

    if (error) {
      logger.error({ message: 'Failed to write audit log', error: error.message, action });
    }
  } catch (err) {
    logger.error({ message: 'Audit log exception', error: err.message, action });
  }
};

module.exports = { writeAuditLog };
