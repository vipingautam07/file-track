import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, Eye, EyeOff, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { extractError } from '../lib/constants';
import LegalFooter from '../components/LegalFooter';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = email, 2 = OTP + new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ── Step 1: Send OTP ──────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('OTP sent! Check your email inbox.');
      setStep(2);
      startResendCooldown();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP cooldown (60s) ────────────────────────────────────
  const startResendCooldown = () => {
    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('A new OTP has been sent.');
      startResendCooldown();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP + Reset ───────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      toast.success('Password updated successfully!');
      navigate('/login');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm p-1.5">
              <img src="/logo.jpg" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="font-bold text-slate-900 leading-tight">Kripanidhi Legal</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Account Recovery</p>
            </div>
          </div>

          <div className="card p-8 bg-white border border-slate-100 shadow-sm space-y-6">

            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>1</div>
              <div className={`flex-1 h-0.5 transition-all ${step >= 2 ? 'bg-blue-600' : 'bg-slate-100'}`} />
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</div>
            </div>

            {/* ── Step 1 ── */}
            {step === 1 && (
              <>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Forgot your password?</h1>
                  <p className="text-sm text-slate-500 mt-1">Enter your registered email address and we'll send a 6-digit OTP.</p>
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="form-label">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        className="form-input"
                        style={{ paddingLeft: '2.5rem' }}
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary w-full btn-lg justify-center font-bold" disabled={loading}>
                    {loading ? <><span className="spinner" /> Sending OTP…</> : 'Send OTP'}
                  </button>
                </form>

                <p className="text-center text-sm text-slate-500">
                  Remember your password?{' '}
                  <Link to="/login" className="font-bold text-blue-600 hover:underline">Sign in</Link>
                </p>
              </>
            )}

            {/* ── Step 2 ── */}
            {step === 2 && (
              <>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Enter OTP & new password</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    We sent a 6-digit code to <strong className="text-slate-700">{email}</strong>. It expires in 10 minutes.
                  </p>
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  {/* OTP */}
                  <div>
                    <label className="form-label">6-Digit OTP</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        className="form-input font-mono tracking-widest text-center text-lg"
                        style={{ paddingLeft: '2.5rem' }}
                        placeholder="• • • • • •"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                      />
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="form-label">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-input pr-10"
                        placeholder="Min 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                      <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowPassword((v) => !v)}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="form-label">Confirm New Password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <button type="submit" className="btn btn-primary w-full btn-lg justify-center font-bold" disabled={loading || otp.length < 6}>
                    {loading ? <><span className="spinner" /> Verifying…</> : <><CheckCircle2 className="w-4 h-4" /> Reset Password</>}
                  </button>
                </form>

                {/* Resend & back */}
                <div className="flex items-center justify-between text-sm text-slate-500 pt-1">
                  <button onClick={() => { setStep(1); setError(null); }} className="flex items-center gap-1 hover:text-slate-700 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Change email
                  </button>
                  <button
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="flex items-center gap-1 text-blue-600 font-semibold hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
