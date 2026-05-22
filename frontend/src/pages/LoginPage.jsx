import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Building, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { extractError } from '../lib/constants';
import ErrorMessage from '../components/ErrorMessage';
import LegalFooter from '../components/LegalFooter';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await api.post('/auth/login', data);
      const { user, accessToken } = res.data.data;
      login(user, accessToken);

      toast.success(`Welcome back, ${user.full_name}!`);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'bank_member') navigate('/bank');
      else navigate('/customer');
    } catch (err) {
      const msg = extractError(err);
      if (msg.includes('magic link') || msg.includes('secure link')) {
        setApiError('Customers must access their tracking view via the secure magic link sent by email.');
      } else {
        setApiError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <div className="flex flex-1">
      {/* Visual Left Branding Panel (Desktop Only) */}
      <div className="hidden lg:flex w-[42%] bg-slate-900 text-white flex-col justify-between p-12 relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        {/* Subtle glowing elements */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[100px]" />
        
        {/* TOP: Kripanidhi Legal Services Pvt Ltd */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 bg-white border border-slate-100/10 rounded-lg flex items-center justify-center shadow-md p-1.5 flex-shrink-0">
            <img src="/logo.jpg" alt="Logo" className="w-5.5 h-5.5 object-contain" />
          </div>
          <div>
            <p className="font-extrabold text-white text-sm tracking-tight leading-none">Kripanidhi Legal</p>
            <p className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">Services Pvt Ltd</p>
          </div>
        </div>

        {/* CENTER: Chitransh Law Chamber & File Tracking System */}
        <div className="relative z-10 my-auto text-center space-y-8 px-4 flex flex-col items-center">
          {/* Elegant Monogram Logo */}
          <img src="/logo.jpg" alt="Logo" className="w-16 h-16 object-contain rounded-full border-2 border-white/20 shadow-lg" />

          {/* <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center  mb-2 relative group">
            <div className="absolute inset-0.5 rounded-full bg-slate-950 flex items-center justify-center">
              <img src="/logo.jpg" alt="Logo" className="w-5.5 h-5.5 object-contain" />
            </div>
            <img src="/logo.jpg" alt="Logo" className="w-5.5 h-5.5 object-contain" />
          </div> */}

          <div className="space-y-3">
            <p className="text-[11px] text-blue-400 font-bold uppercase tracking-[0.25em] leading-none">Advocates & Legal Consultants</p>
            <h2 className="text-4xl font-extrabold tracking-tight text-white leading-tight font-sans drop-shadow-sm">
              Chitransh Law Chamber
            </h2>
          </div>

          {/* Elegant sleek divider */}
          <div className="flex items-center justify-center gap-3 w-40">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-slate-700" />
            <div className="w-2 h-2 rounded-full bg-blue-500/50" />
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-slate-700" />
          </div>

          <div className="space-y-3 max-w-sm">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-blue-300">
              <Building className="w-3.5 h-3.5 text-blue-400" />
              File Tracking System
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Verify workflows, check digital loan verification status, and collaborate directly with legal counsel.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-4">
          <p>© {new Date().getFullYear()} Kripanidhi Legal &amp; Chitransh Law Chamber</p>
          <span className="font-mono">v1.1.0</span>
        </div>
      </div>

      {/* Interactive Form Panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:px-20">
        {/* Mobile Header Branding */}
        <div className="lg:hidden flex items-center gap-3 mb-10 text-center">
          <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm p-1.5">
            <img src="/logo.jpg" alt="Logo" className="w-6 h-6 object-contain" />
          </div>
          <div className="text-left">
            <p className="font-bold text-slate-900 leading-tight">Kripanidhi Legal</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Partner Portal</p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-7">
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Sign in to your account</h1>
            <p className="text-sm text-slate-500">Access the secure loan verification tracking console</p>
          </div>

          {/* Premium API Error Display */}
          <ErrorMessage
            title="Authentication Failed"
            message={apiError}
            onRetry={apiError ? () => setApiError(null) : null}
          />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <label className="form-label">Email Address</label>
              <input
                {...register('email')}
                type="email"
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="you@kripanidhi.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="form-error">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="form-label">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input pr-10 ${errors.password ? 'error' : ''}`}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="form-error">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full btn-lg mt-2 justify-center font-bold tracking-wide"
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Verifying Credentials…' : 'Secure Login'}
            </button>
          </form>

          {/* SaaS Footer Sign Up Action */}
          <div className="border-t border-slate-100 pt-6 text-center space-y-4">
            <p className="text-sm text-slate-500">
              New here?{' '}
              <Link to="/signup" className="font-bold text-blue-600 hover:underline hover:text-blue-700 transition-colors">
                Create a tracking account
              </Link>
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Customers looking for direct file access can also use the secure link sent via email.
            </p>
          </div>
        </div>
      </div>
      </div>{/* end flex-1 row */}
      <LegalFooter />
    </div>
  );
}
