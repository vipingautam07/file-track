import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { extractError } from '../../lib/constants';
import toast from 'react-hot-toast';
import LogoutButton from '../../components/LogoutButton';

export default function CustomerPortal() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const loadFile = async () => {
      try {
        const res = await api.get('/files?limit=1');
        const files = res.data.data.files;
        if (files && files.length > 0) {
          navigate(`/track/${files[0].secure_token}`, { replace: true });
        }
      } catch (err) {
        toast.error(extractError(err));
      }
    };
    loadFile();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-800 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Kripanidhi Legal</p>
              <p className="text-sm font-bold text-slate-900">File Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 hidden sm:inline">{user?.full_name}</span>
            <LogoutButton variant="icon" />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="card p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-slate-400" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-2">Welcome, {user?.full_name}</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            No files are currently linked to your account. Please contact{' '}
            <span className="font-medium text-slate-700">Kripanidhi Legal Services</span> for assistance.
          </p>
          <LogoutButton className="mt-6 mx-auto justify-center" />
        </div>
      </div>
    </div>
  );
}
