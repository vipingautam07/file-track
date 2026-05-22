import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Plus, ArrowRight, ChevronLeft, ChevronRight,
  Files, Hash, Mail, X,
} from 'lucide-react';
import api from '../../lib/api';
import { STATUS_LABELS, STATUS_BADGE_CLASS, formatDate, extractError } from '../../lib/constants';
import { useAuthStore } from '../../stores/authStore';
import ErrorMessage from '../../components/ErrorMessage';

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'documents_received', label: 'Documents Received & Seen' },
  { value: 'review_pending', label: 'Processing' },
  { value: 'additional_documents_required', label: 'Additional Documents Required' },
  { value: 'completed_proceed_signing', label: 'Proceed for Signing' },
  { value: 'completed_approved', label: 'Approved' },
  { value: 'completed_rejected', label: 'Rejected' },
];

export default function AdminFileList() {
  const { user } = useAuthStore();
  const isBankMember = user?.role === 'bank_member';

  const [files, setFiles]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);  // bank member: has user searched yet?
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(1);
  const [apiError, setApiError] = useState(null);
  const limit = 15;

  const loadFiles = useCallback(async (overrideSearch) => {
    const q = overrideSearch !== undefined ? overrideSearch : search;

    // Bank members must provide a search term
    if (isBankMember && !q.trim()) return;

    setLoading(true);
    setApiError(null);
    try {
      const params = new URLSearchParams({ page, limit, sortOrder: 'desc' });
      if (q) params.set('search', q);
      if (status) params.set('status', status);
      const res = await api.get(`/files?${params}`);
      setFiles(res.data.data.files);
      setTotal(res.data.data.total);
      setSearched(true);
    } catch (err) {
      setApiError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, status, isBankMember]);

  const totalPages = Math.ceil(total / limit);

  // ── Search handlers ────────────────────────────────────────────
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
    if (!isBankMember) loadFiles(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadFiles(search);
  };

  const clearSearch = () => {
    setSearch('');
    setPage(1);
    setFiles([]);
    setTotal(0);
    setSearched(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            {isBankMember ? 'File Search' : 'Loan Cases'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isBankMember
              ? 'Search by file number or email address'
              : `${total} active documents mapped`}
          </p>
        </div>
        {!isBankMember && (
          <Link to="/admin/files/new" className="btn btn-primary gap-1.5 btn-sm shadow-sm">
            <Plus className="w-4 h-4" />
            New File
          </Link>
        )}
      </div>

      <ErrorMessage title="Could not retrieve files" message={apiError} onRetry={() => loadFiles()} />

      {/* ── Bank Member: prominent search-first UI ── */}
      {isBankMember ? (
        <form onSubmit={handleSearchSubmit} className="card p-6 space-y-4 bg-white border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search Files</p>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* File number hint */}
            <div className="relative flex-1">
              <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="form-input h-11 text-sm"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="File number e.g. HDFC-2024-KL-0042"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary h-11 px-6 gap-2 shrink-0"
              disabled={!search.trim() || loading}
            >
              {loading ? <span className="spinner" /> : <Search className="w-4 h-4" />}
              Search
            </button>
            {searched && (
              <button
                type="button"
                className="btn btn-secondary h-11 px-4 gap-1.5 shrink-0"
                onClick={clearSearch}
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" /> File number
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Applicant email
            </span>
          </div>
        </form>
      ) : (
        /* ── Admin: filters bar ── */
        <div className="card p-4.5 flex flex-col sm:flex-row gap-3 bg-white border border-slate-100 shadow-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="form-input h-10 text-sm"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search by file #, applicant name, email…"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <div className="relative w-full sm:w-56">
            <select
              className="form-input form-select h-10 text-sm"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); loadFiles(); }}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Bank member: prompt before search ── */}
      {isBankMember && !searched && (
        <div className="card p-12 text-center bg-white border border-slate-100 shadow-sm">
          <Search className="w-10 h-10 mx-auto text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-500">Enter a file number or email to search</p>
          <p className="text-xs text-slate-400 mt-1">Results appear here</p>
        </div>
      )}

      {/* ── Results table ── */}
      {(!isBankMember || searched) && (
        <div className="card overflow-hidden bg-white border border-slate-100 shadow-sm">
          <div className="table-wrapper border-0 rounded-none overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="bg-slate-50/50">File Number</th>
                  <th className="bg-slate-50/50">Applicant Name</th>
                  <th className="bg-slate-50/50">Loan Type</th>
                  <th className="bg-slate-50/50">Current Status</th>
                  <th className="bg-slate-50/50">Assigned Partner</th>
                  <th className="bg-slate-50/50">Last Update</th>
                  <th className="bg-slate-50/50"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((__, j) => (
                        <td key={j} className="py-4">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : files.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-400 py-16">
                      <Files className="w-9 h-9 mx-auto text-slate-200 mb-2" />
                      <p className="text-sm font-medium text-slate-500 mb-1">
                        {isBankMember ? 'No files found for that search.' : 'No loan files match the query.'}
                      </p>
                      {!isBankMember && (
                        <Link to="/admin/files/new" className="text-xs text-blue-600 underline font-semibold">
                          Add a new file
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  files.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50/50 border border-blue-100/50 px-2 py-0.5 rounded">
                            {f.file_number}
                          </span>
                          {f.is_closed && (
                            <span className="badge badge-gray text-[9px] scale-95 font-bold uppercase tracking-wider">
                              Closed
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {/* Bank members: name only, no email */}
                        <p className="text-sm font-bold text-slate-900 leading-tight">{f.applicant_name}</p>
                        {!isBankMember && f.applicant_email && (
                          <p className="text-xs text-slate-400">{f.applicant_email}</p>
                        )}
                      </td>
                      <td className="text-sm text-slate-500 whitespace-nowrap">{f.loan_type || '—'}</td>
                      <td className="whitespace-nowrap">
                        <span className={`badge ${STATUS_BADGE_CLASS[f.current_status]} text-[10px]`}>
                          {STATUS_LABELS[f.current_status]}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">
                        {f.assigned_admin?.full_name || 'Unassigned'}
                      </td>
                      <td className="text-xs text-slate-400 whitespace-nowrap">{formatDate(f.updated_at)}</td>
                      <td>
                        <Link
                          to={`/admin/files/${f.id}`}
                          className="btn btn-ghost btn-sm p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <p className="text-xs text-slate-400 font-medium">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary btn-sm h-8 px-2 rounded-lg"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="btn btn-secondary btn-sm h-8 px-2 rounded-lg"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
