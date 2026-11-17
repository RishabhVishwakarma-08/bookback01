import { useEffect, useState } from 'react';
import { getPlatformInfo } from '../data/localStore';
import { BookBackLogo } from './BookBackLogo';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const [campusName, setCampusName] = useState('University Book Exchange');

  useEffect(() => {
    setCampusName(getPlatformInfo().campusName);
  }, []);

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-16 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-sm text-slate-600 dark:text-slate-400">
        <div className="space-y-1.5">
          <BookBackLogo />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Student-to-student academic textbook marketplace · {campusName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Browse Books
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/list-book')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            List a Book
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Student Dashboard
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/auth')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </div>
    </footer>
  );
}
