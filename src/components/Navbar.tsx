import { useEffect, useState } from 'react';
import { Menu, Monitor, Moon, Sun, X } from 'lucide-react';
import { getPlatformInfo } from '../data/localStore';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ThemePreference } from '../types';
import { BookBackLogo } from './BookBackLogo';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Navbar({ currentPath, onNavigate }: NavbarProps) {
  const { user, unreadCount, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [maintenanceBanner, setMaintenanceBanner] = useState('');

  useEffect(() => {
    setMaintenanceBanner(getPlatformInfo().maintenanceBanner);
  }, [currentPath]);

  const navItems = [
    { label: 'Browse', path: '/' },
    ...(user
      ? [
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Requests', path: '/requests' },
          {
            label: unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications',
            path: '/notifications',
          },
          ...(isAdmin ? [{ label: 'Admin', path: '/admin' }] : []),
          { label: 'Profile', path: '/profile' },
        ]
      : [{ label: 'How It Works', path: '/#how-it-works' }]),
  ];

  const handleNav = (path: string) => {
    setMobileOpen(false);
    if (path.startsWith('/#')) {
      if (currentPath !== '/') {
        onNavigate('/');
        setTimeout(() => {
          document.getElementById(path.slice(2))?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        document.getElementById(path.slice(2))?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    onNavigate(path);
  };

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath.startsWith(path);
  };

  const themeOptions: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'dark', label: 'Dark', Icon: Moon },
    { value: 'system', label: 'System', Icon: Monitor },
  ];

  return (
    <>
      {maintenanceBanner && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center text-xs font-medium text-amber-900 dark:text-amber-200">
          {maintenanceBanner}
        </div>
      )}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => handleNav('/')}
            className="whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0F5132] rounded-lg"
          >
            <BookBackLogo />
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  isActive(item.path)
                    ? 'text-[#0F5132] dark:text-emerald-400 border-[#0F5132] dark:border-emerald-400'
                    : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Compact Light / Dark / System Switcher */}
            <div
              role="group"
              aria-label="Theme appearance"
              className="hidden sm:inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              {themeOptions.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value, true)}
                  aria-label={`${label} theme`}
                  title={`${label} theme`}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    theme === value
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>

            {user ? (
              <button
                type="button"
                onClick={() => handleNav('/list-book')}
                className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] dark:hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
              >
                List a Book
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNav('/auth')}
                className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] dark:hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
              >
                Sign In
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive(item.path)
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#0F5132] dark:text-emerald-300'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Theme</span>
              <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {themeOptions.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value, true)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
                      theme === value
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleNav(user ? '/list-book' : '/auth')}
                className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 hover:bg-[#0B3D26]"
              >
                {user ? 'List a Book' : 'Sign In'}
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
