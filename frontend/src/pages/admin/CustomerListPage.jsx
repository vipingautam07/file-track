import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search, Plus, Mail, ChevronLeft, ChevronRight,
  ShieldCheck, User, Building, Check, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { ROLE_LABELS, formatDate, getInitials, extractError } from '../../lib/constants';
import CreateUserModal from '../../components/CreateUserModal';
import ConfirmModal from '../../components/ConfirmModal';

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Customer', icon: User, badgeClass: 'badge-gray' },
  { value: 'admin', label: 'Admin', icon: ShieldCheck, badgeClass: 'badge-purple' },
  { value: 'bank_member', label: 'Bank Member', icon: Building, badgeClass: 'badge-blue' },
];

function RoleSelector({ user, onChanged }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const btnRef = useRef(null);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // If less than 180px below the button to bottom of viewport, open upward
      setOpenUpward(window.innerHeight - rect.bottom < 180);
    }
    setOpen((v) => !v);
  };

  const handleChange = async (newRole) => {
    if (newRole === user.role) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      await api.patch(`/users/${user.id}`, { role: newRole });
      toast.success(`Role updated to ${ROLE_LABELS[newRole]}`);
      onChanged();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const current = ROLE_OPTIONS.find((r) => r.value === user.role);

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        className={`badge ${current?.badgeClass || 'badge-gray'} cursor-pointer hover:opacity-80 transition-opacity select-none gap-1.5`}
        onClick={handleToggle}
        disabled={saving}
      >
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : null}
        {ROLE_LABELS[user.role]}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ opacity: 0.6 }}>
          <path d="M4 5L1 2h6z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-20 overflow-hidden ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}>
            <p className="text-xs text-slate-400 font-semibold px-3 pt-3 pb-1.5 uppercase tracking-wider">
              Change Role
            </p>
            {ROLE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = opt.value === user.role;
              return (
                <button
                  key={opt.value}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 transition-colors"
                  onClick={() => handleChange(opt.value)}
                >
                  <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700 flex-1">{opt.label}</span>
                  {isActive && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function CustomerListPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const limit = 20;

  // Confirm Modal & Cooldown Rate Limit State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [cooldowns, setCooldowns] = useState({});

  const COOLDOWN_TIME = 60 * 1000; // 60 seconds

  useEffect(() => {
    const updatedCooldowns = {};
    let hasUpdates = false;
    users.forEach((u) => {
      const lastSent = localStorage.getItem(`magic_link_sent_${u.id}`);
      if (lastSent) {
        const elapsed = Date.now() - parseInt(lastSent, 10);
        if (elapsed < COOLDOWN_TIME) {
          updatedCooldowns[u.id] = Math.ceil((COOLDOWN_TIME - elapsed) / 1000);
          hasUpdates = true;
        }
      }
    });
    if (hasUpdates) {
      setCooldowns(updatedCooldowns);
    }
  }, [users]);

  useEffect(() => {
    const activeIds = Object.keys(cooldowns).filter((id) => cooldowns[id] > 0);
    if (activeIds.length === 0) return;

    const timer = setInterval(() => {
      setCooldowns((prev) => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach((id) => {
          if (next[id] > 0) {
            next[id] -= 1;
            changed = true;
            if (next[id] === 0) {
              delete next[id];
            }
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldowns]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const res = await api.get(`/users?${params}`);
      setUsers(res.data.data.users);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSendMagicLink = async () => {
    if (!selectedUser) return;
    setSendingLink(true);
    try {
      await api.post('/auth/magic-link', { customerId: selectedUser.id });
      localStorage.setItem(`magic_link_sent_${selectedUser.id}`, Date.now().toString());
      setCooldowns((prev) => ({ ...prev, [selectedUser.id]: 60 }));
      toast.success('Secure access link sent');
      setShowConfirmModal(false);
      setSelectedUser(null);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSendingLink(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} {total === 1 ? 'user' : 'users'} registered
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="form-input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="form-input form-select w-full sm:w-44"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Roles</option>
          <option value="customer">Customers</option>
          <option value="admin">Admins</option>
          <option value="bank_member">Bank Members</option>
        </select>
      </div>

      {/* Tip banner */}
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
      >
        <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: '#16a34a' }} />
        <p className="text-xs" style={{ color: '#15803d' }}>
          <strong>Role management:</strong> Click any user's role badge to instantly change it between Customer, Admin, and Bank Member.
        </p>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper border-0 rounded-lg">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((__, j) => (
                      <td key={j}>
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <User className="w-8 h-8 text-slate-200" />
                      <p className="text-slate-400 text-sm">No users found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    {/* User info */}
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            background: u.role === 'admin' ? '#f3e8ff' : u.role === 'bank_member' ? '#dbeafe' : '#f1f5f9',
                            color: u.role === 'admin' ? '#7c3aed' : u.role === 'bank_member' ? '#1d4ed8' : '#475569',
                          }}
                        >
                          {getInitials(u.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{u.full_name}</p>
                          <p className="text-xs text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Inline role selector */}
                    <td>
                      <RoleSelector user={u} onChanged={load} />
                    </td>

                    <td className="text-sm text-slate-500">{u.phone || '—'}</td>

                    <td>
                      <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(u.created_at, { hour: undefined, minute: undefined }) || '—'}
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="flex gap-1.5">
                        {/* Send magic link — for customer role only */}
                        {u.role === 'customer' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Send secure file access link"
                            onClick={() => {
                              if (cooldowns[u.id] > 0) return;
                              setSelectedUser(u);
                              setShowConfirmModal(true);
                            }}
                            disabled={cooldowns[u.id] > 0 || sendingLink}
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-xs">
                              {cooldowns[u.id] > 0 ? `Resend in ${cooldowns[u.id]}s` : 'Send Link'}
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Page {page} of {totalPages} · {total} users
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <CreateUserModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}

      {showConfirmModal && selectedUser && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setSelectedUser(null);
          }}
          onConfirm={handleSendMagicLink}
          loading={sendingLink}
          title="Send Access Link"
          message={`Are you sure you want to send a secure file access link to ${selectedUser.full_name} (${selectedUser.email})? This will send them an email containing a secure one-time login link.`}
          confirmText="Send Link"
          icon={Mail}
        />
      )}
    </div>
  );
}
