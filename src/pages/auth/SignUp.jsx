import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sparkles, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function SignUp() {
  const { signUp, supabaseEnabled } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]         = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [step, setStep]         = useState('form'); // 'form' | 'otp'
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const otpRefs = useRef([]);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  // ── Submit signup form ──────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password) { setError('Semua field wajib diisi.'); return; }
    if (form.password !== form.confirm) { setError('Password tidak sama.'); return; }
    if (form.password.length < 8) { setError('Password minimal 8 karakter.'); return; }
    setError(''); setLoading(true);

    const result = await signUp({ email: form.email, password: form.password, fullName: form.fullName });
    setLoading(false);

    if (result?.error) {
      const raw = result.error;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || '');
      setError(msg || 'Pendaftaran tidak diizinkan. Pastikan "Enable sign ups" sudah aktif di Supabase → Authentication → Sign In / Providers → Email.');
      return;
    }

    // Langsung dapat session (email confirmation OFF) → navigasi
    if (result?.data?.session) {
      navigate('/create-workspace');
      return;
    }

    // Email confirmation ON → tampilkan OTP screen
    setStep('otp');
    startResendCountdown();
  };

  // ── OTP input handlers ──────────────────────────────────
  const handleOtpChange = (i, val) => {
    const cleaned = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = cleaned;
    setOtp(next);
    if (cleaned && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...otp];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // ── Verify OTP ──────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const token = otp.join('');
    if (token.length < 6) { setError('Masukkan 6 digit kode OTP.'); return; }
    setError(''); setOtpLoading(true);

    const { data, error: verifyErr } = await supabase.auth.verifyOtp({
      email: form.email,
      token,
      type: 'signup',
    });

    setOtpLoading(false);

    if (verifyErr) {
      setError(verifyErr.message || 'Kode OTP tidak valid atau sudah kedaluwarsa.');
      return;
    }

    if (data?.session) {
      navigate('/create-workspace');
    } else {
      navigate('/');
    }
  };

  // ── Resend OTP ──────────────────────────────────────────
  const startResendCountdown = () => {
    setResendCountdown(60);
    const interval = setInterval(() => {
      setResendCountdown(c => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setError('');
    const { error: resendErr } = await supabase.auth.resend({
      type: 'signup',
      email: form.email,
    });
    if (resendErr) {
      setError(resendErr.message || 'Gagal mengirim ulang kode.');
    } else {
      startResendCountdown();
    }
  };

  // ── OTP Screen ──────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lavender-50 p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center">
              <Sparkles size={17} className="text-white" />
            </div>
            <span className="font-bold text-xl gradient-text">Nayalyzer</span>
          </div>

          <div className="bg-white rounded-3xl shadow-card border border-purple-50 p-8 text-center">
            <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail size={26} className="text-violet-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-1">Cek email kamu</h1>
            <p className="text-gray-400 text-sm mb-1">Kami mengirim kode 6 digit ke</p>
            <p className="text-violet-600 font-semibold text-sm mb-6">{form.email}</p>

            <form onSubmit={handleVerifyOtp}>
              <div className="flex gap-2 justify-center mb-5" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className="w-11 h-13 text-center text-xl font-bold border-2 border-purple-100 rounded-xl focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all text-gray-800"
                    style={{ height: '52px' }}
                  />
                ))}
              </div>

              {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}

              <button type="submit" disabled={otpLoading || otp.join('').length < 6}
                className="w-full purple-btn py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60 mb-4">
                {otpLoading
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Memverifikasi...</>
                  : 'Verifikasi & Masuk'}
              </button>
            </form>

            <p className="text-xs text-gray-400">
              Tidak menerima kode?{' '}
              {resendCountdown > 0
                ? <span className="text-gray-400">Kirim ulang dalam {resendCountdown}s</span>
                : <button onClick={handleResend} className="text-violet-500 font-semibold hover:underline">Kirim ulang</button>
              }
            </p>

            <button onClick={() => { setStep('form'); setOtp(['','','','','','']); setError(''); }}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 hover:underline block mx-auto">
              Ganti email
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Signup Form ─────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-lavender-50 p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center">
            <Sparkles size={17} className="text-white" />
          </div>
          <span className="font-bold text-xl gradient-text">Nayalyzer</span>
        </div>

        <div className="bg-white rounded-3xl shadow-card border border-purple-50 p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Buat akun baru</h1>
          <p className="text-gray-400 text-sm mb-7">Mulai analitik sosial media kamu secara gratis.</p>

          {!supabaseEnabled && (
            <div className="mb-5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-xs text-amber-700 font-medium">Mode Demo — akun tidak disimpan ke server.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nama Lengkap</label>
              <input type="text" value={form.fullName} onChange={set('fullName')} placeholder="Rania Pratiwi"
                className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="hello@brandmu.id"
                className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Min. 8 karakter"
                  className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all pr-11" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Konfirmasi Password</label>
              <input type="password" value={form.confirm} onChange={set('confirm')} placeholder="Ulangi password"
                className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
            </div>
            {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading} className="w-full purple-btn py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-70">
              {loading ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Mendaftar...</> : 'Buat Akun Gratis'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Sudah punya akun?{' '}
          <Link to="/" className="text-violet-500 font-semibold hover:underline">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
