import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Check, X, Building, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { extractError } from '../lib/constants';
import ErrorMessage from '../components/ErrorMessage';
import LegalFooter from '../components/LegalFooter';

const schema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Name is too long')
      .regex(/^[a-zA-Z\s.'-]+$/, 'Name should contain letters and spaces only'),
    email: z.string().email('Please enter a valid email address'),
    phone: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^(\+91[\-\s]?)?[6-9]\d{9}$/.test(v),
        'Enter a valid 10-digit Indian mobile number'
      ),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must have at least one uppercase letter')
      .regex(/[0-9]/, 'Must have at least one number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

function PasswordRule({ met, label }) {
  return (
    <span
      className="flex items-center gap-1.5 text-xs transition-colors duration-200"
      style={{ color: met ? '#10b981' : '#94a3b8' }}
    >
      {met ? (
        <span className="w-4 h-4 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
          <Check className="w-2.5 h-2.5" />
        </span>
      ) : (
        <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
          <X className="w-2.5 h-2.5" />
        </span>
      )}
      {label}
    </span>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), mode: 'onChange' });

  const passwordVal = watch('password') || '';
  const rules = {
    length: passwordVal.length >= 8,
    uppercase: /[A-Z]/.test(passwordVal),
    number: /[0-9]/.test(passwordVal),
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setApiError(null);
    try {
      await api.post('/auth/signup', {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || undefined,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      toast.success('Account created successfully! You can now sign in.');
      navigate('/login');
    } catch (err) {
      setApiError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <div className="flex flex-1">
      {/* Left Branding Side Panel (Desktop only) */}
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
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.25)] border border-blue-400/20 mb-2 relative group">
            <div className="absolute inset-0.5 rounded-full bg-slate-950 flex items-center justify-center">
              <span className="font-serif text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-blue-200 tracking-wider">CLC</span>
            </div>
          </div>

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
              Register an account to follow real-time verification timelines, chat with administrators, and view complete step statuses.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-4">
          <p>© {new Date().getFullYear()} Kripanidhi Legal &amp; Chitransh Law Chamber</p>
          <span className="font-mono">v1.1.0</span>
        </div>
      </div>

      {/* Interactive Signup Form Panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-10 lg:px-20 overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm p-1.5">
            <img src="/logo.jpg" alt="Logo" className="w-6 h-6 object-contain" />
          </div>
          <div className="text-left">
            <p className="font-bold text-slate-900 leading-tight">Kripanidhi Legal</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Partner Portal</p>
          </div>
        </div>

        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Create tracking account</h1>
            <p className="text-sm text-slate-500">Register to follow your legal document validation process</p>
          </div>

          {/* SaaS-Grade Error Message Card */}
          <ErrorMessage
            title="Registration Failed"
            message={apiError}
            onRetry={apiError ? () => setApiError(null) : null}
          />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label className="form-label">Full Name</label>
              <input
                {...register('fullName')}
                type="text"
                autoComplete="name"
                placeholder="Rahul Sharma"
                className={`form-input ${errors.fullName ? 'error' : ''}`}
              />
              {errors.fullName && (
                <p className="form-error">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="form-label">Email Address</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`form-input ${errors.email ? 'error' : ''}`}
              />
              {errors.email && (
                <p className="form-error">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="form-label">
                Mobile Number
                <span className="text-slate-400 font-normal normal-case ml-1">(optional)</span>
              </label>
              <div className="flex">
                <div
                  className="flex items-center gap-1.5 px-3.5 border border-r-0 rounded-l-lg bg-slate-50 text-sm text-slate-500 font-bold flex-shrink-0"
                  style={{ borderColor: 'rgba(226, 232, 240, 0.9)' }}
                >
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  {...register('phone')}
                  type="tel"
                  placeholder="98765 43210"
                  className={`form-input rounded-l-none ${errors.phone ? 'error' : ''}`}
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                />
              </div>
              {errors.phone && (
                <p className="form-error">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="form-label">Password</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min 8 chars"
                    className={`form-input pr-10 ${errors.password ? 'error' : ''}`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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

              <div className="space-y-1.5">
                <label className="form-label">Confirm Password</label>
                <div className="relative">
                  <input
                    {...register('confirmPassword')}
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Match password"
                    className={`form-input pr-10 ${errors.confirmPassword ? 'error' : ''}`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="form-error">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            {/* Password Indicator rules */}
            {passwordVal.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password Strength</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  <PasswordRule met={rules.length} label="8+ Characters" />
                  <PasswordRule met={rules.uppercase} label="Uppercase Letter" />
                  <PasswordRule met={rules.number} label="One Number" />
                </div>
              </div>
            )}

            {/* Info notice */}
            <div className="rounded-xl px-4 py-3 flex gap-3 items-start bg-blue-50/55 border border-blue-100/50">
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-extrabold text-white">
                i
              </div>
              <p className="text-xs leading-relaxed text-blue-700 font-medium">
                New registers default to a <strong>Customer</strong> role. Administrators can change roles to bank officials or admins.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full btn-lg justify-center font-bold tracking-wide mt-2"
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Creating account…
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 pt-3">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-blue-600 hover:underline hover:text-blue-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      </div>{/* end flex-1 row */}
      <LegalFooter />
    </div>
  );
}
