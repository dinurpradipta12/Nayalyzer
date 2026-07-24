import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Sparkles } from 'lucide-react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const PENDING_INVITE_KEY = 'naya_pending_workspace_invite';

function savePendingInvite(invite, token, otp) {
  localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({
    token,
    otp,
    email: invite.email,
    role: invite.role,
    workspace_id: invite.workspace_id,
    workspace_name: invite.workspace_name,
    saved_at: new Date().toISOString(),
  }));
}

export default function JoinWorkspace() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const token = useMemo(() => params.get('token') || '', [params]);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!token) { setError('Link undangan tidak valid.'); return; }
    if (otp.trim().length < 4) { setError('Masukkan kode OTP undangan.'); return; }
    if (!isAuthenticated && password.length < 8) { setError('Password minimal 8 karakter.'); return; }
    if (!isAuthenticated && password !== confirmPassword) { setError('Konfirmasi password tidak sama.'); return; }

    setLoading(true);
    try {
      if (!SUPABASE_ENABLED) {
        localStorage.setItem('naya_auth', JSON.stringify({
          user: { id: 'demo-invited', email: 'invited@nayalyzer.id' },
          profile: { full_name: 'Invited User', email: 'invited@nayalyzer.id' },
          email: 'invited@nayalyzer.id',
        }));
        navigate('/dashboard', { replace: true });
        return;
      }

      const { data: invite, error: verifyError } = await supabase.rpc('verify_invitation_otp', {
        p_token: token,
        p_otp: otp.trim(),
      });
      if (verifyError || !invite?.success) {
        throw new Error(invite?.error || verifyError?.message || 'OTP tidak cocok atau undangan sudah tidak aktif.');
      }
      savePendingInvite(invite, token, otp.trim());

      if (isAuthenticated) {
        navigate('/create-workspace', { replace: true });
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            full_name: invite.email?.split('@')[0],
            invited_workspace_id: invite.workspace_id,
          },
        },
      });
      if (signUpError) throw signUpError;

      if (!signUpData.session) {
        setSuccess(`Akun dibuat. Login dengan email ${invite.email}, lalu kamu akan melihat undangan workspace ${invite.workspace_name}.`);
        return;
      }

      navigate('/create-workspace', { replace: true });
    } catch (err) {
      setError(err.message || 'Gagal menerima undangan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-lavender-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center shadow-purple">
            <Sparkles size={17} className="text-white" />
          </div>
          <span className="font-bold text-xl gradient-text">Nayalyzer</span>
        </div>

        <div className="bg-white rounded-2xl shadow-card border border-purple-50 p-6">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4">
            <LockKeyhole size={21} />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Terima Undangan Workspace</h1>
          <p className="text-sm text-gray-400 mt-1 mb-6">
            {isAuthenticated
              ? 'Masukkan OTP dari admin untuk membuka undangan workspace.'
              : 'Masukkan OTP dari admin, lalu set password untuk login berikutnya.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Kode OTP</label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 digit OTP"
                  inputMode="numeric"
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                />
              </div>
            </div>

            {!isAuthenticated && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password Baru</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all pr-11"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {!isAuthenticated && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Konfirmasi Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password"
                  className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                />
              </div>
            )}

            {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            {success && (
              <div className="text-green-700 text-xs bg-green-50 px-3 py-2 rounded-lg">
                <div className="flex gap-2">
                  <CheckCircle2 size={14} className="flex-shrink-0" /> {success}
                </div>
                <button type="button" onClick={() => navigate('/')}
                  className="mt-2 text-xs font-semibold text-green-700 underline">
                  Login sekarang
                </button>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full purple-btn py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-70">
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Memproses...</>
                : isAuthenticated ? 'Lanjutkan ke Undangan' : 'Aktifkan Akun'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
