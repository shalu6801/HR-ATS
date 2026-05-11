import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, FileText, Trophy, Brain,
  Mail, BarChart3, LogOut, ChevronLeft, ChevronRight, Moon, Sun,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/jobs', icon: Briefcase, label: 'Job Management' },
  { to: '/screening', icon: FileText, label: 'Resume Screening' },
  { to: '/ranking', icon: Trophy, label: 'Candidate Ranking' },
  { to: '/insights', icon: Brain, label: 'AI Insights' },
  { to: '/email', icon: Mail, label: 'Email Automation' },
  { to: '/reports', icon: BarChart3, label: 'Reports & Analytics' },
];

export default function AppSidebar() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Dark mode state — persist in localStorage
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [dark]);

  return (
    <aside className={cn(
      'flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shrink-0">
          HR
        </div>
        {!collapsed && <span className="font-semibold text-lg tracking-tight">TalentAI</span>}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
              location.pathname === to
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && user && (
          <div className="px-2 py-1 text-xs text-sidebar-foreground/50 truncate">
            {user.email}
          </div>
        )}

        {/* Dark Mode Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDark(d => !d)}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {dark
            ? <Sun className="w-4 h-4 mr-2" />
            : <Moon className="w-4 h-4 mr-2" />
          }
          {!collapsed && (dark ? 'Light Mode' : 'Dark Mode')}
        </Button>

        {/* Sign Out */}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {!collapsed && 'Sign Out'}
        </Button>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full text-sidebar-foreground/50 hover:text-sidebar-foreground"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </aside>
  );
}