import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart2, FileText, Users, Lightbulb } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', feature: 'dashboard' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics', feature: 'analytics' },
  { to: '/content', icon: FileText, label: 'Konten', feature: 'content' },
  { to: '/competitors', icon: Users, label: 'Kompetitor', feature: 'competitors' },
  { to: '/hypothesis', icon: Lightbulb, label: 'AI', feature: 'hypothesis' },
];

export default function BottomNav() {
  const { hasFeature } = useWorkspace();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-purple-100 z-30 lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.filter(item => hasFeature(item.feature)).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-150 min-w-0
              ${isActive ? 'text-violet-600' : 'text-gray-400'}`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-lavender-100' : ''}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
