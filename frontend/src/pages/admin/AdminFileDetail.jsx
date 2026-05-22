import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Clock, CheckCircle2, AlertCircle,
  XCircle, ThumbsUp, MessageSquare, History, RefreshCw,
  Lock, Unlock, Send, User, Building2, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import ConfirmModal from '../../components/ConfirmModal';
import {
  STATUS_LABELS, STATUS_BADGE_CLASS, STATUS_COLORS, formatDate,
  COMMENT_TYPE_LABELS, getInitials, extractError
} from '../../lib/constants';

const STATUS_OPTIONS = [
  { value: 'documents_received', label: 'Documents Received & Seen' },
  { value: 'review_pending', label: 'Processing' },
  { value: 'additional_documents_required', label: 'Additional Documents Required' },
  { value: 'completed_proceed_signing', label: 'Proceed for Signing' },
  { value: 'completed_approved', label: 'Approved' },
  { value: 'completed_rejected', label: 'Rejected' },
];

const STATUS_ICONS = {
  documents_received: FileText,
  review_pending: Clock,
  additional_documents_required: AlertCircle,
  completed_proceed_signing: ThumbsUp,
  completed_approved: CheckCircle2,
  completed_rejected: XCircle,
};

function TimelineItem({ entry, isLast }) {
  const Icon = STATUS_ICONS[entry.new_status] || CheckCircle2;
  const color = STATUS_COLORS[entry.new_status] || '#94a3b8';

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0"
          style={{ background: color }}
        >
          <Icon className="w-4 h-4" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-slate-100 my-1" />}
      </div>
      <div className="pb-5 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${STATUS_BADGE_CLASS[entry.new_status]}`}>
            {STATUS_LABELS[entry.new_status]}
          </span>
          {entry.changed_by?.full_name && (
            <span className="text-xs text-slate-400">by {entry.changed_by.full_name}</span>
          )}
        </div>
        {entry.notes && (
          <p className="text-sm text-slate-600 mt-1 bg-slate-50 rounded px-3 py-2 border border-slate-100">
            {entry.notes}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-1">{formatDate(entry.created_at)}</p>
      </div>
    </div>
  );
}

function CommentItem({ comment, isAdmin }) {
  const colorMap = {
    internal_note: 'bg-amber-50 border-amber-100',
    public_comment: 'bg-blue-50 border-blue-100',
    customer_reply: 'bg-slate-50 border-slate-200',
  };
  const labelMap = {
    internal_note: <span className="badge badge-yellow text-xs">Internal</span>,
    public_comment: <span className="badge badge-blue text-xs">Public</span>,
    customer_reply: <span className="badge badge-gray text-xs">Customer Reply</span>,
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[comment.comment_type] || 'bg-slate-50 border-slate-100'}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="w-7 h-7 bg-white rounded-full border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
          {getInitials(comment.author?.full_name)}
        </div>
        <span className="text-sm font-semibold text-slate-700">{comment.author?.full_name}</span>
        {labelMap[comment.comment_type]}
        <span className="text-xs text-slate-400 ml-auto">{formatDate(comment.created_at)}</span>
      </div>
      <p className="text-sm text-slate-800 leading-relaxed">{comment.content}</p>
    </div>
  );
}

export default function AdminFileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isBankMember = user?.role === 'bank_member';
  const canComment = isAdmin || isBankMember;

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');

  // Status update
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  // Comments
  const [commentText, setCommentText] = useState('');
  const [commentType, setCommentType] = useState('public_comment');
  const [addingComment, setAddingComment] = useState(false);

  // Resend tracking link — cooldown keyed on file id
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const COOLDOWN_TIME = 60 * 1000; // 60 seconds

  useEffect(() => {
    if (!file?.id) return;
    const lastSent = localStorage.getItem(`resend_link_${file.id}`);
    if (lastSent) {
      const elapsed = Date.now() - parseInt(lastSent, 10);
      if (elapsed < COOLDOWN_TIME) setCooldown(Math.ceil((COOLDOWN_TIME - elapsed) / 1000));
    }
  }, [file?.id]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const loadFile = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/files/${id}`);
      setFile(res.data.data.file);
      setNewStatus(res.data.data.file.current_status);
    } catch (err) {
      toast.error(extractError(err));
      navigate('/admin/files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFile(); }, [id]);

  const handleStatusUpdate = async () => {
    if (newStatus === file.current_status) return;
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/files/${id}/status`, { status: newStatus, notes: statusNotes, notify: notifyCustomer });
      const { emailQueued } = res.data.data;
      setStatusNotes('');
      await loadFile();
      if (notifyCustomer) {
        if (emailQueued) {
          toast.success('Status updated — bank recipients notified');
        } else {
          toast.success('Status updated (no bank recipients configured — add emails at creation)');
        }
      } else {
        toast.success('Status updated successfully');
      }
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReopen = async () => {
    try {
      const res = await api.post(`/files/${id}/reopen`);
      const { emailQueued } = res.data.data;
      await loadFile();
      if (emailQueued) {
        toast.success('File reopened and customer notified');
      } else {
        toast.error('File reopened but email dispatch failed');
      }
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  const handleResendLink = async () => {
    setSendingLink(true);
    try {
      const res = await api.post(`/files/${id}/resend-link`);
      const { sent, total } = res.data.data;
      localStorage.setItem(`resend_link_${id}`, Date.now().toString());
      setCooldown(60);
      toast.success(`Tracking link sent to ${sent} of ${total} recipient${total > 1 ? 's' : ''}`);
      setShowConfirmModal(false);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSendingLink(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setAddingComment(true);
    try {
      await api.post(`/comments/${id}`, {
        content: commentText.trim(),
        commentType,
      });
      setCommentText('');
      await loadFile();
      toast.success('Comment added');
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setAddingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

const ALL_STATUSES = [
  'documents_received',
  'review_pending',
  'additional_documents_required',
  'completed_proceed_signing',
  'completed_approved',
  'completed_rejected',
];

function StatusTimeline({ history = [], currentStatus }) {
  const completedSet = new Set(history.map((h) => h.new_status));
  return (
    <div className="card p-6 sm:p-8 bg-white border border-slate-100/90 shadow-sm">
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
        <History className="w-4 h-4 text-blue-600" />
        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">File Timeline</h3>
      </div>
      <div className="relative">
        {ALL_STATUSES.map((status, idx) => {
          const Icon = STATUS_ICONS[status];
          const isCompleted = completedSet.has(status);
          const isCurrent = currentStatus === status;
          const historyEntry = history.filter((h) => h.new_status === status).at(-1);
          const isLast = idx === ALL_STATUSES.length - 1;
          return (
            <div key={status} className={`timeline-step ${isLast ? 'pb-0' : ''}`}>
              <div className={`timeline-icon ${isCurrent ? 'active' : isCompleted ? 'completed' : 'pending'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 pt-1.5 min-w-0 pb-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className={`text-sm font-bold ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  {isCurrent && (
                    <span className="badge badge-blue text-[10px] uppercase font-bold tracking-wider animate-pulse">Current Stage</span>
                  )}
                </div>
                {historyEntry && (
                  <div className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{formatDate(historyEntry.created_at)}</span>
                    {historyEntry.notes || 'Status updated by legal team.'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

  if (!file) return null;

  // Bank members get a clean tracking-page-style view (same as CustomerFilePage)
  if (isBankMember) {
    const publicComments = (file.comments || []).filter(
      (c) => c.comment_type === 'public_comment' || c.comment_type === 'customer_reply'
    );
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <button onClick={() => navigate('/admin/files')} className="btn btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Search
        </button>

        {/* File identity card */}
        <div className="card p-6 bg-white border border-slate-100 shadow-xs relative overflow-hidden fade-in">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 rounded-l-xl" />
          <div className="flex items-start justify-between gap-4 flex-wrap pl-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${STATUS_BADGE_CLASS[file.current_status]}`}>{STATUS_LABELS[file.current_status]}</span>
                {file.is_closed
                  ? <span className="badge badge-gray text-[10px] font-bold uppercase">Closed</span>
                  : <span className="badge badge-green text-[10px] font-bold uppercase">Active</span>
                }
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight font-mono">{file.file_number}</h1>
              <p className="text-sm text-slate-500">{file.loan_type || 'Loan File'}</p>
            </div>
            <div className="text-right bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Received</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5">{formatDate(file.documents_received_at || file.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Full step-by-step timeline */}
        <StatusTimeline history={file.status_history || []} currentStatus={file.current_status} />

        {/* Comments */}
        <div className="card p-6 sm:p-8 bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Messages &amp; Comments</h3>
            </div>
            <span className="badge badge-gray text-[10px] font-bold">{publicComments.length}</span>
          </div>
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 mb-5">
            <p className="text-xs font-semibold text-slate-500 mb-2">&#x1F4AC; Post a Public Comment</p>
            <textarea
              className="form-input form-textarea text-sm w-full"
              rows={3}
              placeholder="Add a comment visible on the tracking page…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm mt-3"
              onClick={handleAddComment}
              disabled={addingComment || !commentText.trim()}
            >
              {addingComment ? <span className="spinner" /> : <Send className="w-3.5 h-3.5" />}
              {addingComment ? 'Adding…' : 'Post Comment'}
            </button>
          </div>
          {publicComments.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              <p className="text-sm font-medium">No messages yet.</p>
              <p className="text-xs mt-1">Legal team updates will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {publicComments.map((c) => (
                <div key={c.id} className={`flex gap-3 items-start p-4 rounded-xl border ${
                  c.comment_type === 'customer_reply'
                    ? 'bg-slate-50/50 border-slate-100 ml-6 border-l-2 border-l-slate-300'
                    : 'bg-white border-slate-100 shadow-xs'
                }`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    c.comment_type === 'customer_reply' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {getInitials(c.author?.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-slate-700">{c.author?.full_name}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5 bg-blue-50/50 border border-blue-100 shadow-none">
          <p className="text-xs text-blue-700 leading-relaxed font-medium">
            <strong>&#x1F4CC; File Reference:</strong> Share the tracking link with the applicant or colleagues via the admin panel.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'timeline', label: 'Timeline', icon: History },
    { id: 'comments', label: 'Comments', icon: MessageSquare },
    ...(isAdmin ? [{ id: 'details', label: 'Details', icon: FileText }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back nav */}
      <button onClick={() => navigate('/admin/files')} className="btn btn-ghost btn-sm">
        <ArrowLeft className="w-4 h-4" />
        All Files
      </button>

      {/* File header */}
      <div className="card-elevated p-6 fade-in">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`badge ${STATUS_BADGE_CLASS[file.current_status]}`}>
                {STATUS_LABELS[file.current_status]}
              </span>
              {file.is_closed && <span className="badge badge-gray">Closed</span>}
              {file.bank_reference && (
                <span className="badge badge-purple">{file.bank_reference}</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{file.file_number}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {file.loan_type || 'Loan File'} • Opened {formatDate(file.created_at)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isAdmin && !file.is_closed && (
              <button
                onClick={cooldown > 0 ? null : () => setShowConfirmModal(true)}
                disabled={cooldown > 0 || sendingLink}
                className="btn btn-secondary btn-sm"
              >
                <Send className="w-3.5 h-3.5" />
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Tracking Link'}
              </button>
            )}
            {isAdmin && file.is_closed && (
              <button onClick={handleReopen} className="btn btn-secondary btn-sm">
                <Unlock className="w-3.5 h-3.5" />
                Reopen
              </button>
            )}
            <button onClick={loadFile} className="btn btn-ghost btn-sm">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Key info row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400">Applicant</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">{file.applicant_name}</p>
          </div>
          {isAdmin && (
            <>
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-sm text-slate-700 mt-0.5 break-all">{file.applicant_email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Phone</p>
                <p className="text-sm text-slate-700 mt-0.5">{file.applicant_phone || '—'}</p>
              </div>
            </>
          )}
          <div>
            <p className="text-xs text-slate-400">Assigned To</p>
            <p className="text-sm text-slate-700 mt-0.5">{file.assigned_admin?.full_name || '—'}</p>
          </div>
        </div>
      </div>

      {/* Status update panel — Admin only */}
      {isAdmin && !file.is_closed && (
        <div className="card p-5 fade-in">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Update Status</h3>
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                className="form-input form-select flex-1"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <input
                className="form-input flex-1"
                placeholder="Optional note for this change…"
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={handleStatusUpdate}
                disabled={updatingStatus || newStatus === file.current_status}
              >
                {updatingStatus ? <span className="spinner" /> : null}
                {updatingStatus ? 'Updating…' : 'Update Status'}
              </button>
            </div>
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                id="notifyCustomer"
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                checked={notifyCustomer}
                onChange={(e) => setNotifyCustomer(e.target.checked)}
              />
              <label htmlFor="notifyCustomer" className="text-xs font-semibold text-slate-500 select-none cursor-pointer">
                Notify customer about this update by email
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-slate-100">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab(id)}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Timeline tab */}
          {activeTab === 'timeline' && (
            <div>
              {(file.status_history || []).length === 0 ? (
                <p className="text-sm text-slate-400">No status history</p>
              ) : (
                <div>
                  {file.status_history.map((entry, i) => (
                    <TimelineItem
                      key={entry.id}
                      entry={entry}
                      isLast={i === file.status_history.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comments tab */}
          {activeTab === 'comments' && (
            <div className="space-y-5">
              {/* Add comment — Admin and Bank Member */}
              {canComment && (
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50">
                  <div className="flex gap-3 mb-3 flex-wrap">
                    {/* Admin gets both types; bank_member gets public_comment only */}
                    {isAdmin && ['internal_note', 'public_comment'].map((type) => (
                      <button
                        key={type}
                        className={`btn btn-sm ${commentType === type ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCommentType(type)}
                      >
                        {type === 'internal_note' ? '🔒 Internal Note' : '💬 Public Comment'}
                      </button>
                    ))}
                    {isBankMember && (
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        💬 Public Comment
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    {commentType === 'internal_note'
                      ? 'Only visible to admins. Customers will NOT see this.'
                      : 'Visible to the customer on their tracking page.'}
                  </p>
                  <textarea
                    className="form-input form-textarea text-sm"
                    rows={3}
                    placeholder={commentType === 'internal_note' ? 'Add internal note…' : 'Add a comment visible to the customer…'}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button
                    className="btn btn-primary btn-sm mt-3"
                    onClick={handleAddComment}
                    disabled={addingComment || !commentText.trim()}
                  >
                    {addingComment ? <span className="spinner" /> : <Send className="w-3.5 h-3.5" />}
                    {addingComment ? 'Adding…' : 'Add Comment'}
                  </button>
                </div>
              )}

              {/* Comments list */}
              {(file.comments || []).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No comments yet</p>
              ) : (
                <div className="space-y-3">
                  {file.comments.map((c) => (
                    <CommentItem key={c.id} comment={c} isAdmin={isAdmin} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Details tab */}
          {activeTab === 'details' && (
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Applicant Details</h4>
                {[
                  ['Full Name', file.applicant_name],
                  // Email and phone only visible to admins
                  ...(isAdmin ? [
                    ['Email', file.applicant_email],
                    ['Phone', file.applicant_phone],
                    ['Address', file.applicant_address],
                  ] : []),
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm font-medium text-slate-800">{val || '—'}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loan Details</h4>
                {[
                  ['Loan Type', file.loan_type],
                  ['Reference', file.bank_reference],
                  ['Loan Amount', file.loan_amount ? `₹${Number(file.loan_amount).toLocaleString('en-IN')}` : null],
                  ['Property Address', file.property_address],
                  ['Co-Applicant', file.co_applicant_name],
                  ['Target Date', file.target_completion_date],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm font-medium text-slate-800">{val || '—'}</p>
                  </div>
                ))}
              </div>

              {/* Tracking URL */}
              {file.secure_token && (
                <div className="sm:col-span-2 bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-700 mb-1">Customer Tracking URL</p>
                  <p className="text-xs font-mono text-blue-800 break-all">
                    {window.location.origin}/track/{file.secure_token}
                  </p>
                  <button
                    className="btn btn-sm btn-primary mt-2"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/track/${file.secure_token}`);
                      toast.success('URL copied');
                    }}
                  >
                    Copy URL
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleResendLink}
        loading={sendingLink}
        title="Resend Tracking Link"
        message={`Send the tracking link for file ${file.file_number} to all ${Array.isArray(file.bank_recipient_emails) ? file.bank_recipient_emails.length : 0} configured bank recipient(s) by email?`}
        confirmText="Send Link"
        icon={Send}
      />
    </div>
  );
}
