import { useEffect, useMemo } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

export default function OAuthComplete() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const connected = params.get('connected');
  const error = params.get('error');
  const platform = connected || params.get('platform') || 'platform';

  useEffect(() => {
    const payload = {
      source: 'nayalyzer-oauth',
      connected,
      error,
      platform,
    };

    window.opener?.postMessage(payload, window.location.origin);
    const timer = window.setTimeout(() => window.close(), 500);
    return () => window.clearTimeout(timer);
  }, [connected, error, platform]);

  const isSuccess = !!connected && !error;

  return (
    <div className="min-h-screen bg-lavender-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl border border-purple-50 bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50">
          {error ? (
            <XCircle size={25} className="text-red-500" />
          ) : isSuccess ? (
            <CheckCircle2 size={25} className="text-green-600" />
          ) : (
            <Loader2 size={25} className="animate-spin text-violet-600" />
          )}
        </div>
        <h1 className="text-lg font-bold text-gray-800">
          {error ? 'Login gagal' : isSuccess ? `${platform} terhubung` : 'Menyelesaikan login'}
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          {error ? `OAuth error: ${error}` : 'Jendela ini akan tertutup otomatis.'}
        </p>
      </div>
    </div>
  );
}
