import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Files, Clock, CheckCircle2, AlertCircle, TrendingUp,
  Users, Plus, ArrowRight, RefreshCw, BarChart2, Zap
} from 'lucide-react';
import api from '../../lib/api';
import { STATUS_LABELS, STATUS_BADGE_CLASS, formatDate, extractError } from '../../lib/constants';
import toast from 'react-hot-toast';
import ErrorMessage from '../../components/ErrorMessage';

function StatCard({ icon: Icon, label, value, colorClass, sub, pct }) {
  return (
    <div className="card p-6 flex flex-col justify-between hover:-translate-y-0.5 relative overflow-hidden group">
      {/* Glow highlight */}
      <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors duration-300" />
      
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{value ?? '—'}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      {sub && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">{sub}</span>
          {pct !== undefined && (
            <span className="font-bold text-slate-700">{pct}%</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const load = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [statsRes, filesRes] = await Promise.all([
        api.get('/files/analytics/summary'),
        api.get('/files?limit=8&sortOrder=desc'),
      ]);
      setStats(statsRes.data.data);
      setRecentFiles(filesRes.data.data.files || []);
    } catch (err) {
      setApiError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Overview of all active files</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary btn-sm gap-1.5" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link to="/admin/files/new" className="btn btn-primary btn-sm gap-1.5 shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            New Tracking File
          </Link>
        </div>
      </div>

      {/* Beautiful SaaS Errors */}
      <ErrorMessage
        title="Unable to load dashboard details"
        message={apiError}
        onRetry={load}
      />

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6 h-28 animate-pulse bg-slate-100/50 border border-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 fade-in">
          <StatCard
            icon={Files}
            label="Total Registry Files"
            value={stats?.total}
            colorClass="bg-blue-50 text-blue-600 border border-blue-100"
            sub="Registered overall"
            pct={100}
          />
          <StatCard
            icon={Clock}
            label="Open Review files"
            value={stats?.open}
            colorClass="bg-amber-50 text-amber-600 border border-amber-100"
            sub="Under verification"
            pct={stats?.total > 0 ? Math.round((stats.open / stats.total) * 100) : 0}
          />
          <StatCard
            icon={CheckCircle2}
            label="Completed Milestones"
            value={(stats?.byStatus?.completed_approved || 0) + (stats?.byStatus?.completed_rejected || 0)}
            colorClass="bg-emerald-50 text-emerald-600 border border-emerald-100"
            sub="Finished verification"
            pct={stats?.total > 0 ? Math.round((((stats?.byStatus?.completed_approved || 0) + (stats?.byStatus?.completed_rejected || 0)) / stats.total) * 100) : 0}
          />
          <StatCard
            icon={AlertCircle}
            label="Documents Awaiting"
            value={stats?.byStatus?.additional_documents_required || 0}
            colorClass="bg-orange-50 text-orange-600 border border-orange-100"
            sub="Awaiting customer action"
            pct={stats?.total > 0 ? Math.round(((stats?.byStatus?.additional_documents_required || 0) / stats.total) * 100) : 0}
          />
        </div>
      )}

      {/* Main Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status breakdown progress bars */}
        {stats && (
          <div className="card p-6 lg:col-span-1 bg-white border border-slate-100/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                <BarChart2 className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                  Status Milestones
                </h2>
              </div>
              <div className="space-y-4">
                {Object.entries(stats.byStatus || {}).map(([status, count]) => {
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className={`badge ${STATUS_BADGE_CLASS[status]} text-[10px]`}>
                          {STATUS_LABELS[status]}
                        </span>
                        <span className="font-bold text-slate-600">{count} files ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100/80 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 mt-6 text-xs text-slate-500 leading-relaxed">
              💡 <strong>SLA Note:</strong> Documents received must be marked as review pending within 24 hours of mail extraction.
            </div>
          </div>
        )}

        {/* Recent files list */}
        <div className={`card lg:col-span-2 overflow-hidden bg-white border border-slate-100/90`}>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600 animate-pulse" />
              <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Recent Registry Cases</h2>
            </div>
            <Link to="/admin/files" className="btn btn-ghost btn-sm text-blue-600 hover:text-blue-700 font-semibold gap-1">
              Registry <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="table-wrapper rounded-none border-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="bg-slate-50/50">File Number</th>
                  <th className="bg-slate-50/50">Applicant Details</th>
                  <th className="bg-slate-50/50">Current Status</th>
                  <th className="bg-slate-50/50">Assigned Partner</th>
                  <th className="bg-slate-50/50"></th>
                </tr>
              </thead>
              <tbody>
                {recentFiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-400 py-12">
                      <Files className="w-8 h-8 mx-auto text-slate-200 mb-2" />
                      <p className="text-sm font-medium text-slate-500">No recent legal cases mapped.</p>
                    </td>
                  </tr>
                ) : (
                  recentFiles.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50/60 border border-blue-100/50 px-2 py-1 rounded">
                          {f.file_number}
                        </span>
                      </td>
                      <td className="min-w-[150px]">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{f.applicant_name}</p>
                          <p className="text-xs text-slate-400 truncate">{f.applicant_email}</p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={`badge ${STATUS_BADGE_CLASS[f.current_status]} text-[10px]`}>
                          {STATUS_LABELS[f.current_status]}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">
                        {f.assigned_admin?.full_name || 'Unassigned'}
                      </td>
                      <td>
                        <Link to={`/admin/files/${f.id}`} className="btn btn-ghost btn-sm p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg">
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
