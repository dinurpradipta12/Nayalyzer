import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { AppProvider } from './context/AppContext';

import Layout from './components/layout/Layout';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import CreateWorkspace from './pages/CreateWorkspace';
import Dashboard from './pages/Dashboard';
import AccountAnalytics from './pages/AccountAnalytics';
import ContentPerformance from './pages/ContentPerformance';
import CompetitorAnalysis from './pages/CompetitorAnalysis';
import AIHypothesis from './pages/AIHypothesis';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import TeamMembers from './pages/TeamMembers';
import DataSources             from './pages/DataSources';
import ConnectedAccounts        from './pages/ConnectedAccounts';
import CompetitorIntelligence   from './pages/CompetitorIntelligence';
import Analyser                 from './pages/Analyser';
import { FEATURE_BY_ROUTE } from './lib/permissions';
import JoinWorkspace            from './pages/JoinWorkspace';
import OAuthComplete            from './pages/OAuthComplete';

// ── Full-screen loading spinner ─────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-lavender-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-3 border-violet-200 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" style={{ borderWidth: '3px' }} />
        <p className="text-sm text-gray-400 font-medium">Memuat Nayalyzer...</p>
      </div>
    </div>
  );
}

// ── Guards ──────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

function RequireWorkspace({ children }) {
  const { hasWorkspace, loading, error } = useWorkspace();
  if (loading) return <LoadingScreen />;
  if (error === 'DB_PENDING') return <DBPendingScreen />;
  return hasWorkspace ? children : <Navigate to="/create-workspace" replace />;
}

function PermissionDeniedScreen() {
  return (
    <div className="min-h-[55vh] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-card border border-purple-50 p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-amber-600">
          <span className="text-xl">!</span>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Akses fitur belum diizinkan</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Minta admin workspace untuk mengaktifkan fitur ini di halaman Team Members.
        </p>
      </div>
    </div>
  );
}

function RequireFeature({ children }) {
  const location = useLocation();
  const { hasFeature } = useWorkspace();
  const featureKey = FEATURE_BY_ROUTE[location.pathname];
  if (!featureKey || hasFeature(featureKey)) return children;
  return <PermissionDeniedScreen />;
}

function DBPendingScreen() {
  return (
    <div className="min-h-screen bg-lavender-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-card border border-purple-50 p-10 max-w-lg w-full text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
          🗄️
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Database belum disiapkan</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Kamu sudah berhasil login! Tapi tabel database Nayalyzer belum dibuat di Supabase.
          Jalankan SQL migration dulu agar app bisa berjalan.
        </p>
        <div className="bg-gray-50 rounded-2xl p-4 text-left mb-6 space-y-2">
          <p className="text-xs font-semibold text-gray-600">Langkah setup:</p>
          <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
            <li>Buka <span className="font-semibold text-violet-600">supabase.com/dashboard</span> → proyek kamu</li>
            <li>Klik <span className="font-semibold">SQL Editor</span> di sidebar kiri</li>
            <li>Klik <span className="font-semibold">New query</span></li>
            <li>Copy-paste SQL dari file <span className="font-semibold">supabase/FULL_MIGRATION.sql</span></li>
            <li>Klik <span className="font-semibold">Run</span> → tunggu sampai selesai</li>
            <li>Kembali ke sini dan refresh halaman</li>
          </ol>
        </div>
        <button onClick={() => window.location.reload()}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-400 text-white text-sm font-semibold hover:opacity-90">
          Refresh Setelah Menjalankan SQL
        </button>
      </div>
    </div>
  );
}

function RedirectIfAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

// ── Page wrapper ────────────────────────────────────────────────
function AppPage({ children }) {
  return (
    <RequireAuth>
      <RequireWorkspace>
        <Layout>
          <RequireFeature>{children}</RequireFeature>
        </Layout>
      </RequireWorkspace>
    </RequireAuth>
  );
}

// ── Routes ──────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
	      {/* Public / auth */}
	      <Route path="/" element={<RedirectIfAuth><SignIn /></RedirectIfAuth>} />
	      <Route path="/signup" element={<RedirectIfAuth><SignUp /></RedirectIfAuth>} />
	      <Route path="/join-workspace" element={<JoinWorkspace />} />
	      <Route path="/oauth-complete" element={<OAuthComplete />} />

      {/* Workspace creation (authenticated but no workspace yet) */}
      <Route path="/create-workspace" element={
        <RequireAuth><CreateWorkspace /></RequireAuth>
      } />

      {/* Protected app pages */}
      <Route path="/dashboard"   element={<AppPage><Dashboard /></AppPage>} />
      <Route path="/analytics"   element={<AppPage><AccountAnalytics /></AppPage>} />
      <Route path="/content"     element={<AppPage><ContentPerformance /></AppPage>} />
      <Route path="/competitors" element={<AppPage><CompetitorAnalysis /></AppPage>} />
      <Route path="/competitor-intelligence" element={<AppPage><CompetitorIntelligence /></AppPage>} />
      <Route path="/analyser" element={<AppPage><Analyser /></AppPage>} />
      <Route path="/hypothesis"  element={<AppPage><AIHypothesis /></AppPage>} />
      <Route path="/reports"     element={<AppPage><Reports /></AppPage>} />
      <Route path="/connected-accounts" element={<AppPage><ConnectedAccounts /></AppPage>} />
      <Route path="/data-sources"       element={<AppPage><DataSources /></AppPage>} />
      <Route path="/team"        element={<AppPage><TeamMembers /></AppPage>} />
      <Route path="/settings"    element={<AppPage><Settings /></AppPage>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <AppProvider>
            <AppRoutes />
          </AppProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
