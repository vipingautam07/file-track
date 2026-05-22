export const STATUS_LABELS = {
  documents_received: 'Documents Received & Seen',
  review_pending: 'Processing',
  additional_documents_required: 'Additional Documents Required',
  completed_proceed_signing: 'Proceed for Signing',
  completed_approved: 'Approved',
  completed_rejected: 'Rejected',
};

export const STATUS_ORDER = [
  'documents_received',
  'review_pending',
  'additional_documents_required',
  'completed_proceed_signing',
  'completed_approved',
  'completed_rejected',
];

export const STATUS_BADGE_CLASS = {
  documents_received: 'badge-blue',
  review_pending: 'badge-yellow',
  additional_documents_required: 'badge-orange',
  completed_proceed_signing: 'badge-purple',
  completed_approved: 'badge-green',
  completed_rejected: 'badge-red',
};

export const STATUS_COLORS = {
  documents_received: '#3b82f6',
  review_pending: '#f59e0b',
  additional_documents_required: '#f97316',
  completed_proceed_signing: '#8b5cf6',
  completed_approved: '#10b981',
  completed_rejected: '#ef4444',
};

export const COMMENT_TYPE_LABELS = {
  internal_note: 'Internal Note',
  public_comment: 'Public Comment',
  customer_reply: 'Customer Reply',
};

export const ROLE_LABELS = {
  admin: 'Admin',
  bank_member: 'Bank Member',
  customer: 'Customer',
};

export const formatDate = (dateStr, opts = {}) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  });
};

export const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

export const extractError = (err) => {
  return err?.response?.data?.error?.message || err?.message || 'Something went wrong';
};
