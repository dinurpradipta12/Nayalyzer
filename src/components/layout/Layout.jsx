import { Menu, Bell, Sun, Moon, ChevronDown, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { SUPABASE_ENABLED } from '../../lib/supabase';

const pageTitles = {
  '/dashboard':   'Dashboard',
  '/analytics':   'Account Analytics',
  '/content':     'Content Performance',
  '/competitors': 'Competitor Analysis',
  '/hypothesis':  'AI Hypothesis',
  '/reports':     'Reports',
  '/analyser':    'Analyser',
  '/team':        'Team Members',
  '/settings':    'Settings',
};

function WorkspaceSwitcher() {
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!activeWorkspace) return null;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-lavender-50 rounded-xl hover:bg-lavender-100 transition-colors max-w-[180px]">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-300 to-purple-200 flex items-center justify-center text-violet-700 font-bold text-xs flex-shrink-0">
          {activeWorkspace.name?.[0]?.toUpperCase()}
        </div>
        <span className="text-xs font-semibold text-gray-700 truncate hidden sm:block">{activeWorkspace.name}</span>
        <ChevronDown size={13} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && workspaces?.length > 0 && (
        <div className="absolute right-0 top-full mt-1.5 z-30 bg-white border border-purple-100 rounded-xl shadow-soft overflow-hidden min-w-[200px]">
          {workspaces.map(ws => (
            <button key={ws.id} onClick={() => { switchWorkspace(ws); setOpen(false); }}
              className={`w-full text-left px-3 py-2.5 text-xs font-medium transition-colors flex items-center gap-2
                ${ws.id === activeWorkspace?.id ? 'bg-violet-50 text-violet-700' : 'text-gray-600 hover:bg-lavender-50'}`}>
              <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-200 to-purple-100 flex items-center justify-center text-violet-600 font-bold text-[10px]">
                {ws.name?.[0]?.toUpperCase()}
              </div>
              {ws.name}
            </button>
          ))}
          <div className="border-t border-purple-50 p-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/create-workspace?mode=new');
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-50">
                <Plus size={12} />
              </span>
              Tambah Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { setSidebarOpen, darkMode, toggleDarkMode } = useApp();
  const { profile }         = useAuth();
  const { activeWorkspace } = useWorkspace();
  const location            = useLocation();
  const title = pageTitles[location.pathname] || 'Nayalyzer';

  return (
    <div className="flex min-h-screen bg-lavender-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-20">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-purple-100 px-4 lg:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-lavender-50 text-gray-500">
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-800">{title}</h1>
              <p className="text-xs text-gray-400 hidden sm:block">
                {activeWorkspace?.name} · {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                {!SUPABASE_ENABLED && <span className="ml-2 text-amber-500">· Mode Demo</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <WorkspaceSwitcher />
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`relative flex items-center w-14 h-7 rounded-full transition-colors duration-300 flex-shrink-0
                ${darkMode ? 'bg-violet-600' : 'bg-lavender-200'}`}
            >
              <span className={`absolute flex items-center justify-center w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300
                ${darkMode ? 'translate-x-8' : 'translate-x-1'}`}>
                {darkMode
                  ? <Moon size={11} className="text-violet-600" />
                  : <Sun size={11} className="text-amber-500" />
                }
              </span>
            </button>

            <button className="relative p-2 rounded-xl hover:bg-lavender-50 text-gray-500 transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-500 rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-300 flex items-center justify-center text-white text-sm font-bold">
              {(profile?.full_name || 'U')[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-x-hidden">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
