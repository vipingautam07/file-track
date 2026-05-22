import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Files, Users, BarChart3,
  Menu, X, Search, Building2,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { getInitials, ROLE_LABELS } from '../lib/constants';
import LogoutButton from '../components/LogoutButton';
import LegalFooter from '../components/LegalFooter';

const adminNavItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/admin/files', icon: Files, label: 'All Files' },
  { to: '/admin/customers', icon: Users, label: 'Customers' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
];

// ── Bank Member Layout — clean top-bar only, no sidebar ──────────────
function BankMemberLayout({ user }) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm p-1">
              <img src="/logo.jpg" alt="Logo" className="w-4 h-4 object-contain" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-tight">Kripanidhi Legal</p>
              <p className="text-[10px] text-slate-500 leading-tight font-semibold">& Chitransh Law Services</p>
              <p className="text-[9px] text-slate-400 leading-tight">Legal & Banking Partner</p>
            </div>
          </div>

          {/* Search link */}
          <NavLink
            to="/admin/files"
            className={({ isActive }) =>
              `flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Search className="w-4 h-4" />
            File Search
          </NavLink>

          {/* User + logout */}
          <div className="flex items-center gap-2.5 ml-auto">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-800">
                {getInitials(user?.full_name)}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-slate-900 leading-tight">{user?.full_name}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{ROLE_LABELS[user?.role]}</p>
              </div>
            </div>
            <LogoutButton variant="icon" />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
      <LegalFooter />
    </div>
  );
}

// ── Admin Layout — full sidebar ───────────────────────────────────────
export default function AdminLayout() {
  const { user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Bank members get a clean top-nav only layout
  if (user?.role === 'bank_member') {
    return <BankMemberLayout user={user} />;
  }

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm p-1">
            <img src="/logo.jpg" alt="Logo" className="w-5 h-5 object-contain" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">Kripanidhi Legal</p>
            <p className="text-[10px] text-slate-500 font-semibold leading-tight">& Chitransh Law Services</p>
            <p className="text-xs text-slate-400">Legal & Banking Partner</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-3">Navigation</p>
        {adminNavItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-800">
            {getInitials(user?.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[user?.role]}</p>
          </div>
          <LogoutButton variant="icon" />
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="sidebar hidden lg:flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute top-4 right-4">
          <button className="btn btn-ghost p-2" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button className="btn btn-ghost p-2" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Logo" className="w-5 h-5 object-contain" />
            <span className="font-bold text-slate-900 text-sm">Kripanidhi Legal</span>
          </div>
          <div className="ml-auto">
            <LogoutButton variant="icon" />
          </div>
        </div>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}
