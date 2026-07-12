import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sparkles, TrendingUp, Users, BarChart2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const features = [
  { icon: TrendingUp, text: 'Growth follower real-time' },
  { icon: BarChart2, text: 'Analisis engagement mendalam' },
  { icon: Users, text: 'Competitor intelligence' },
  { icon: Sparkles, text: 'AI Hypothesis Engine' },
];

export default function SignIn() {
  const { signIn, supabaseEnabled } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Email dan password wajib diisi.'); return; }
    setError(''); setLoading(true);
    const { error: authErr } = await signIn({ email, password });
    setLoading(false);
    if (authErr) { setError(typeof authErr === 'string' ? authErr : authErr.message || 'Login gagal.'); return; }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left gradient panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-400 p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/10 rounded-full translate-y-40 -translate-x-40" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <span className="text-white font-bold text-xl">Nayalyzer</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Analitik sosial media<br />yang cerdas & intuitif.
          </h2>
          <p className="text-white/70 text-base leading-relaxed mb-10">
            Pantau performa Instagram, TikTok, dan Threads kamu dalam satu dashboard. Didukung AI untuk insight yang actionable.
          </p>
          <div className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                  <Icon size={15} className="text-white" />
                </div>
                <span className="text-white/90 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <p className="text-white/80 text-xs italic leading-relaxed">
              "Nayalyzer membantu kami memahami konten mana yang benar-benar bekerja. Engagement rate naik 40% dalam 3 bulan."
            </p>
            <p className="text-white/60 text-xs mt-2 font-medium">— Rania, Creative Director</p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-lavender-50">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2.5 mb-8 lg:hidden justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center">
              <Sparkles size={17} className="text-white" />
            </div>
            <span className="font-bold text-xl gradient-text">Nayalyzer</span>
          </div>

          <div className="bg-white rounded-3xl shadow-card border border-purple-50 p-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Selamat datang!</h1>
            <p className="text-gray-400 text-sm mb-7">Masuk ke dashboard analitik kamu.</p>

            {!supabaseEnabled && (
              <div className="mb-5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-xs text-amber-700 font-medium">
                  Mode Demo — gunakan email & password apa saja untuk masuk.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="hello@nayacreative.id"
                  className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all pr-11"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-gray-500 cursor-pointer">
                  <input type="checkbox" className="rounded accent-violet-500" /> Ingat saya
                </label>
                <button type="button" className="text-violet-500 hover:text-violet-700 font-medium">Lupa password?</button>
              </div>
              <button type="submit" disabled={loading} className="w-full purple-btn py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-70">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Masuk...</>
                ) : 'Masuk ke Dashboard'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Belum punya akun?{' '}
            <Link to="/signup" className="text-violet-500 font-semibold hover:underline">Daftar gratis</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
