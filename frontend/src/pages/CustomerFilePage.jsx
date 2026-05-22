import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, FileText, AlertCircle, ThumbsUp, XCircle,
  MessageSquare, Building2, History, Search, LogIn
} from 'lucide-react';
import { STATUS_LABELS, STATUS_BADGE_CLASS, formatDate, getInitials } from '../lib/constants';
import ErrorMessage from '../components/ErrorMessage';
import LegalFooter from '../components/LegalFooter';
import { useAuthStore } from '../stores/authStore';
import LogoutButton from '../components/LogoutButton';

const STATUS_ICONS = {
  documents_received: FileText,
  review_pending: Clock,
  additional_documents_required: AlertCircle,
  completed_proceed_signing: ThumbsUp,
  completed_approved: CheckCircle2,
  completed_rejected: XCircle,
};

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
                  <span className={`text-sm font-bold ${
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    {STATUS_LABELS[status]}
                  </span>
                  {isCurrent && (
                    <span className="badge badge-blue text-[10px] uppercase font-bold tracking-wider animate-pulse">
                      Current Stage
                    </span>
                  )}
                </div>
                {historyEntry && (
                  <div className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {formatDate(historyEntry.created_at)}
                    </span>
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

function CommentBubble({ comment }) {
  const isReply = comment.comment_type === 'customer_reply';

  return (
    <div className={`flex gap-3 items-start p-4 rounded-xl border transition-all duration-200 hover:shadow-sm ${
      isReply
        ? 'bg-slate-50/50 border-slate-100 ml-6 border-l-2 border-l-slate-300'
        : 'bg-white border-slate-100 shadow-xs'
    }`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        isReply ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-800'
      }`}>
        {getInitials(comment.author?.full_name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-bold text-slate-700">{comment.author?.full_name}</span>
          <span className="text-[10px] text-slate-400">{formatDate(comment.created_at)}</span>
          {isReply && <span className="badge badge-gray text-[9px] font-bold uppercase scale-90">Your Reply</span>}
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{comment.content}</p>
      </div>
    </div>
  );
}

export default function CustomerFilePage() {
  const { token } = useParams();
  const { user } = useAuthStore();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const loadFile = async () => {
    setLoading(true);
    setApiError(null);
    try {
      // Public endpoint — no auth token needed
      const res = await fetch(`/api/public/track/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'File not found');
      setFile(json.data.file);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFile(); }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-md animate-pulse p-1.5">
          <img src="/logo.jpg" alt="Logo" className="w-6 h-6 object-contain" />
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading your file…</p>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-1.5">
              <img src="/logo.jpg" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
            <p className="font-bold text-slate-900">Kripanidhi Legal Services</p>
          </div>
          <ErrorMessage
            title="Cannot load file"
            message={apiError}
            variant="page"
            onRetry={loadFile}
          />
        </div>
      </div>
    );
  }

  if (!file) return null;

  const publicComments = (file.comments || []).filter(
    (c) => c.comment_type === 'public_comment' || c.comment_type === 'customer_reply'
  );

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24 font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm p-1">
              <img src="/logo.jpg" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Kripanidhi Legal</p>
              <p className="text-sm font-extrabold text-slate-900 leading-tight">File Tracking Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* HDFC badge — hidden on mobile */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bank Partner</span>
            </div>
            {/* Logout — only shown when the customer is logged in */}
            {user && <LogoutButton variant="icon" />}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* File Identity Card */}
        <div className="card p-6 bg-white border border-slate-100 shadow-xs relative overflow-hidden fade-in">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 rounded-l-xl" />
          <div className="flex items-start justify-between gap-4 flex-wrap pl-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${STATUS_BADGE_CLASS[file.current_status]}`}>
                  {STATUS_LABELS[file.current_status]}
                </span>
                {file.is_closed ? (
                  <span className="badge badge-gray text-[10px] font-bold uppercase">Closed</span>
                ) : (
                  <span className="badge badge-green text-[10px] font-bold uppercase">Active</span>
                )}
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight font-mono">{file.file_number}</h1>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 flex-wrap">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold text-slate-600">
                  {file.loan_type || 'Loan File'}
                </span>
                <span>•</span>
                <span>Applicant: <strong className="text-slate-700">{file.applicant_name}</strong></span>
              </p>
            </div>
            <div className="text-right bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Received</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5">
                {formatDate(file.documents_received_at || file.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <StatusTimeline history={file.status_history || []} currentStatus={file.current_status} />

        {/* Comments */}
        <div className="card p-6 sm:p-8 bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                Messages from Legal Team
              </h3>
            </div>
            <span className="badge badge-gray text-[10px] font-bold">
              {publicComments.length}
            </span>
          </div>

          {publicComments.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              <p className="text-sm font-medium">No messages yet.</p>
              <p className="text-xs mt-1">Updates from the legal team will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {publicComments.map((c) => (
                <CommentBubble key={c.id} comment={c} />
              ))}
            </div>
          )}
        </div>

        {/* Info note */}
        <div className="card p-5 bg-blue-50/50 border border-blue-100 shadow-none">
          <p className="text-xs text-blue-700 leading-relaxed font-medium">
            <strong>📌 Bookmark this page</strong> — This unique link is the fastest way to check your file status. 
            Replies must be submitted via the Bank / Kripanidhi office for security reasons.
          </p>
        </div>
      </main>

      <LegalFooter className="mt-8" />

      {/* Sticky bottom CTA strip */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500 font-medium hidden sm:block">
            Need to check another file or access your dashboard?
          </p>
          <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
            <a
              href="/track"
              className="btn btn-secondary btn-sm"
              onClick={(e) => { e.preventDefault(); window.location.href = '/'; }}
            >
              <Search className="w-3.5 h-3.5" />
              Track Another File
            </a>
            <Link
              to="/login"
              className="btn btn-primary btn-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              Login as Bank Member
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
