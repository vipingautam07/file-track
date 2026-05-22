import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, UserPlus, Hash, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { extractError } from '../../lib/constants';

export default function CreateFilePage() {
  const navigate = useNavigate();
  const [loading, setLoading]       = useState(false);
  const [fileNumber, setFileNumber] = useState('');
  const [bankEmails, setBankEmails] = useState(['']);
  const [fileError, setFileError]   = useState('');

  // ── Bank email helpers ──────────────────────────────────────────
  const addEmail = () => setBankEmails((prev) => [...prev, '']);
  const removeEmail = (i) => setBankEmails((prev) => prev.filter((_, idx) => idx !== i));
  const updateEmail = (i, val) =>
    setBankEmails((prev) => prev.map((e, idx) => (idx === i ? val : e)));

  const validEmails = bankEmails.filter(
    (e) => e.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFileError('');

    if (!fileNumber.trim()) {
      setFileError('File number is required');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/files', {
        fileNumber: fileNumber.trim(),
        bankEmails: validEmails,
      });

      toast.success(
        validEmails.length > 0
          ? `File created — link sent to ${validEmails.length} recipient${validEmails.length > 1 ? 's' : ''}`
          : 'File created successfully'
      );
      navigate(`/admin/files/${res.data.data.file.id}`);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <button onClick={() => navigate('/admin/files')} className="btn btn-ghost btn-sm">
        <ArrowLeft className="w-4 h-4" />
        All Files
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Tracking File</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter the file number and send the tracking link to bank personnel
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── File Number ───────────────────────────────────────── */}
        <div className="card p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">File Number</h2>
          <div className="relative">
            <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              className={`form-input h-12 text-sm font-mono ${fileError ? 'error' : ''}`}
              style={{ paddingLeft: '2.5rem' }}
              placeholder="e.g. BANK-2024-KL-0042"
              value={fileNumber}
              onChange={(e) => { setFileNumber(e.target.value); setFileError(''); }}
              autoFocus
            />
          </div>
          {fileError && <p className="form-error">{fileError}</p>}
        </div>

        {/* ── Bank Personnel Emails ─────────────────────────────── */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Send Tracking Link To
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Bank personnel who will receive the tracking link by email
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm gap-1.5"
              onClick={addEmail}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          <div className="space-y-2.5">
            {bankEmails.map((email, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder={`Bank email address ${i + 1}`}
                    value={email}
                    onChange={(e) => updateEmail(i, e.target.value)}
                  />
                </div>
                {bankEmails.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                    onClick={() => removeEmail(i)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Status banner */}
          {validEmails.length > 0 ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 font-medium">
              ✉️ Tracking link will be sent to <strong>{validEmails.length}</strong> recipient{validEmails.length > 1 ? 's' : ''} on creation
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              No emails added — you can copy the tracking link from the file detail page later
            </p>
          )}
        </div>

        {/* ── Actions ───────────────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            type="submit"
            className="btn btn-primary btn-lg flex-1"
            disabled={loading || !fileNumber.trim()}
          >
            {loading ? <span className="spinner" /> : <Plus className="w-4 h-4" />}
            {loading ? 'Creating…' : 'Create File'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={() => navigate('/admin/files')}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
