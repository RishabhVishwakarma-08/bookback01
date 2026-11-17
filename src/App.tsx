import { useCallback, useEffect, useState } from 'react';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdminPage } from './pages/AdminPage';
import { AuthPage } from './pages/AuthPage';
import { BookDetailPage } from './pages/BookDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { ListBookPage } from './pages/ListBookPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RequestsPage } from './pages/RequestsPage';
import { SetupPage } from './pages/SetupPage';

function AppShell() {
  const [locationUrl, setLocationUrl] = useState(
    () => window.location.pathname + window.location.search,
  );

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setLocationUrl(path);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setLocationUrl(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [pathname, search = ''] = locationUrl.split('?');
  const params = new URLSearchParams(search);

  let page = <MarketplacePage onNavigate={navigate} />;

  if (pathname === '/auth' || pathname === '/login' || pathname === '/register') {
    page = <AuthPage onNavigate={navigate} />;
  } else if (pathname === '/setup') {
    page = <SetupPage onNavigate={navigate} />;
  } else if (pathname === '/dashboard') {
    page = <DashboardPage onNavigate={navigate} />;
  } else if (pathname === '/list-book') {
    page = <ListBookPage onNavigate={navigate} />;
  } else if (pathname.startsWith('/edit-book/')) {
    const id = pathname.replace('/edit-book/', '');
    page = <ListBookPage editBookId={id} onNavigate={navigate} />;
  } else if (pathname.startsWith('/books/')) {
    const id = pathname.replace('/books/', '');
    page = <BookDetailPage bookId={id} onNavigate={navigate} />;
  } else if (pathname === '/requests') {
    page = <RequestsPage initialRequestId={params.get('id') || undefined} onNavigate={navigate} />;
  } else if (pathname === '/notifications') {
    page = <NotificationsPage onNavigate={navigate} />;
  } else if (pathname === '/profile') {
    page = <ProfilePage onNavigate={navigate} />;
  } else if (pathname.startsWith('/profile/')) {
    const id = pathname.replace('/profile/', '');
    page = <ProfilePage profileUserId={id} onNavigate={navigate} />;
  } else if (pathname === '/admin') {
    page = <AdminPage onNavigate={navigate} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      <Navbar currentPath={pathname} onNavigate={navigate} />
      <main className="flex-1">{page}</main>
      <Footer onNavigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
