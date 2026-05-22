import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

/**
 * Reusable logout button.
 * variant: 'icon' | 'full' (default 'full' shows icon + text)
 */
export default function LogoutButton({ variant = 'full', className = '' }) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      // Cookie is sent automatically via withCredentials — no body needed
      await api.post('/auth/logout');
    } catch {
      // Proceed even if server call fails
    }
    logout();
    navigate('/login');
    toast.success('Signed out successfully');
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleLogout}
        title="Sign out"
        className={`flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors ${className}`}
      >
        <LogOut className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      className={`flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-red-50 ${className}`}
    >
      <LogOut className="w-4 h-4" />
      Sign out
    </button>
  );
}
