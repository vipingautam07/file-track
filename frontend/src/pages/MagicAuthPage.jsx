import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export default function MagicAuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('Invalid link. Please request a new one.');
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get(`/auth/magic-verify?token=${token}`);
        const { user, accessToken } = res.data.data;
        login(user, accessToken);
        setStatus('success');
        setTimeout(() => navigate('/customer'), 1500);
      } catch (err) {
        setStatus('error');
        setError(err?.response?.data?.error?.message || 'Invalid or expired link. Please request a new one from Kripanidhi Legal.');
      }
    };

    verify();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="card p-10 max-w-sm w-full text-center fade-in">
        {status === 'loading' && (
          <>
            <Loader className="w-10 h-10 text-blue-800 mx-auto animate-spin mb-4" />
            <h2 className="text-lg font-semibold text-slate-900">Verifying your access…</h2>
            <p className="text-sm text-slate-500 mt-2">Please wait a moment</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900">Access Granted</h2>
            <p className="text-sm text-slate-500 mt-2">Redirecting to your file…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900">Access Failed</h2>
            <p className="text-sm text-slate-500 mt-2">{error}</p>
            <a href="/" className="btn btn-primary mt-6">Back to Home</a>
          </>
        )}
      </div>
    </div>
  );
}
