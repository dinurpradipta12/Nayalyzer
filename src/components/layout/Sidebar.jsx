import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BarChart2, FileText, Users, Lightbulb,
  BookOpen, Settings, LogOut, X, Sparkles, UserCircle, Crosshair, Search
} from 'lucide-react';
import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useApp } from '../../context/AppContext';
import { roleDisplayName } from '../../lib/permissions';

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard', feature: 'dashboard' },
  { to: '/analytics',   icon: BarChart2,        label: 'Account Analytics', feature: 'analytics' },
  { to: '/content',     icon: FileText,          label: 'Content Performance', feature: 'content' },
  { to: '/competitors', icon: Users,             label: 'Competitor Analysis', feature: 'competitors' },
  { to: '/hypothesis',              icon: Lightbulb,   label: 'AI Hypothesis', feature: 'hypothesis' },
  { to: '/competitor-intelligence', icon: Crosshair,   label: 'Competitor Intel', feature: 'competitor_intelligence' },
  { to: '/analyser',                icon: Search,      label: 'Analyser', feature: 'analyser' },
  { to: '/reports',                 icon: BookOpen,    label: 'Reports', feature: 'reports' },
];

const workspaceItems = [
  { to: '/team',               icon: UserCircle, label: 'Team Members', feature: 'team' },
  { to: '/settings',           icon: Settings,   label: 'Settings', feature: 'settings' },
];

export default function Sidebar() {
  const { signOut, profile }                              = useAuth();
  const { activeWorkspace, hasFeature }  = useWorkspace();
  const { sidebarOpen, setSidebarOpen } = useApp();
  const navigate = useNavigate();

  // Auto collapse: ciut secara default, expand saat hover, ciut lagi setelah cursor keluar
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef(null);
  const handleEnter = () => {
    clearTimeout(leaveTimer.current);
    setHovered(true);
  };
  const handleLeave = () => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHovered(false), 400);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const collapsed = !hovered; // hanya efektif di layar lg — expand otomatis saat hover

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
    ${collapsed ? 'lg:justify-center lg:px-2' : ''}
    ${isActive ? 'bg-gradient-to-r from-violet-500 to-purple-400 text-white shadow-purple' : 'text-gray-600 hover:bg-lavender-50 hover:text-violet-600'}`;

  const renderNav = ({ to, icon: Icon, label }) => (
    <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
      className={navLinkClass} title={collapsed ? label : undefined}>
      {({ isActive }) => (
        <>
          <Icon size={17} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-violet-500'}`} />
          <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={`
        sidebar-panel
        fixed top-0 left-0 h-full z-50
        bg-white border-r border-purple-100 flex flex-col
        transition-all duration-300 ease-in-out
        lg:translate-x-0
        w-64 ${collapsed ? 'lg:w-20' : 'lg:w-64 lg:shadow-2xl'}
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo + workspace */}
        <div className={`py-4 border-b border-purple-50 ${collapsed ? 'lg:px-2 px-4' : 'px-4'}`}>
          <div className={`flex items-center mb-3 ${collapsed ? 'lg:justify-center justify-between' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center shadow-purple flex-shrink-0">
                <Sparkles size={15} className="text-white" />
              </div>
              <span className={`font-bold text-lg gradient-text ${collapsed ? 'lg:hidden' : ''}`}>Nayalyzer</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded-lg hover:bg-purple-50 text-gray-400">
              <X size={18} />
            </button>
          </div>

        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
	          <p className={`text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2 ${collapsed ? 'lg:hidden' : ''}`}>Analitik</p>
	          {navItems.filter(item => hasFeature(item.feature)).map(renderNav)}

	          <p className={`text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2 mt-8 ${collapsed ? 'lg:hidden' : ''}`}>Workspace</p>
	          {collapsed && <div className="hidden lg:block border-t border-purple-50 my-3 mx-2" />}
	          {workspaceItems.filter(item => hasFeature(item.feature)).map(renderNav)}
        </nav>

        {/* Profile */}
        <div className={`border-t border-purple-50 ${collapsed ? 'lg:p-2 p-4' : 'p-4'}`}>
          <div className={`flex items-center gap-3 mb-3 ${collapsed ? 'lg:justify-center lg:px-0 px-2' : 'px-2'}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-300 flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              title={collapsed ? displayName : undefined}>
              {initials}
            </div>
            <div className={`flex-1 min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
              <p className="text-xs text-purple-400 font-medium">{roleDisplayName(activeWorkspace?.role)}</p>
            </div>
          </div>
          <button onClick={handleLogout} title={collapsed ? 'Keluar' : undefined}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors
              ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}>
            <LogOut size={15} className="flex-shrink-0" /> <span className={collapsed ? 'lg:hidden' : ''}>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
}
