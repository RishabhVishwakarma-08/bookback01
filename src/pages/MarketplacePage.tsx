import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Flame, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { BookCard } from '../components/BookCard';
import { getBooks, getPlatformInfo } from '../data/localStore';
import { useAuth } from '../context/AuthContext';
import type { BookListing } from '../types';

interface MarketplacePageProps {
  onNavigate: (path: string) => void;
}

const BRANCHES = ['all', 'CSE', 'IT', 'ECE', 'EE', 'ME', 'CE', 'AI & DS', 'Other'];
const CONDITIONS = ['all', 'New', 'Like New', 'Good', 'Fair'];

export function MarketplacePage({ onNavigate }: MarketplacePageProps) {
  const { user, isAdmin } = useAuth();
  const [books, setBooks] = useState<BookListing[]>([]);
  const [popularBooks, setPopularBooks] = useState<BookListing[]>([]);
  const [campusName, setCampusName] = useState('MITS Gwalior');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [offerType, setOfferType] = useState('all');
  const [semester, setSemester] = useState('all');
  const [branch, setBranch] = useState('all');
  const [condition, setCondition] = useState('all');
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setCampusName(getPlatformInfo().campusName);
    setPopularBooks(getBooks({ sort: 'popular', limit: 3, status: 'available' }));
  }, []);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const results = getBooks({
        query,
        offerType,
        semester,
        branch,
        condition,
        sort,
        status: 'available',
      });
      setBooks(results);
      setTotal(results.length);
    } catch (err: any) {
      setError(err.message || 'Could not load textbook listings.');
    } finally {
      setLoading(false);
    }
  }, [query, offerType, semester, branch, condition, sort]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  const resetFilters = () => {
    setSearchInput('');
    setQuery('');
    setOfferType('all');
    setSemester('all');
    setBranch('all');
    setCondition('all');
    setSort('newest');
  };

  const hasActiveFilters = Boolean(
    query || offerType !== 'all' || semester !== 'all' || branch !== 'all' || condition !== 'all',
  );

  return (
    <div className="space-y-14">
      {/* SaaS Hero Section */}
      <section className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center">
              <p className="text-xs font-semibold text-[#0F5132] dark:text-emerald-400 tracking-wide">
                University Book Exchange · {campusName}
              </p>
              <h1
                className="mt-3 font-display font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.1]"
                style={{ fontSize: 'clamp(2.1rem, 4vw, 3.35rem)', textWrap: 'balance' }}
              >
                Pass required course books directly to the next semester.
              </h1>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                Buy, sell, borrow, exchange, or donate verified academic textbooks across branches
                and semesters—arranged safely with fellow students on campus.
              </p>

              {/* Hero Search */}
              <form onSubmit={handleSearchSubmit} className="mt-7 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search
                    className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      if (e.target.value === '') setQuery('');
                    }}
                    placeholder="Search by book title, author, subject, or ISBN..."
                    aria-label="Search books by title, author, subject, or ISBN"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F5132]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-xl hover:bg-[#0B3D26] dark:hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
                >
                  Search Catalog
                </button>
              </form>

              {/* Clear Hero CTAs */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate(user ? '/list-book' : '/auth')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0F5132] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                >
                  <span>{user ? 'List a Book' : 'Get Started as Student'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                {user && (
                  <button
                    type="button"
                    onClick={() => onNavigate(isAdmin ? '/admin' : '/dashboard')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    {isAdmin ? 'Open Admin Console' : 'My Student Dashboard'}
                  </button>
                )}
                <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">
                  <strong className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                    {total}
                  </strong>{' '}
                  active listings
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full min-h-[260px] lg:min-h-[360px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                <img
                  src="/assets/images/hero_campus_library_1794567284318.jpg"
                  alt="University students studying with stacked academic textbooks in a sunlit library"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Books Section (shown on default browse view) */}
      {!hasActiveFilters && popularBooks.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Flame className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Popular Books on Campus
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Most requested and viewed textbooks across semesters
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSort('popular')}
              className="text-xs font-semibold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Sort catalog by popularity
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {popularBooks.map((book) => (
              <BookCard
                key={`pop-${book.id}`}
                book={book}
                onOpen={(id) => onNavigate(`/books/${id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recently Added & Full Catalog Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-[#0F5132] dark:text-emerald-400" aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {hasActiveFilters ? 'Filtered Catalog Results' : 'Recently Added Books'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Filter by offer type, semester, branch, or condition
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          {/* Segmented Offer Type Filter */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
            {[
              { value: 'all', label: 'All Types' },
              { value: 'sell', label: 'Buy / Sell' },
              { value: 'lend', label: 'Borrow / Lend' },
              { value: 'donate', label: 'Donate' },
              { value: 'exchange', label: 'Exchange' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setOfferType(tab.value)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  offerType === tab.value
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer min-h-[40px]"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showFilters ? 'Hide Filters' : 'Filter by Semester & Branch'}</span>
            </button>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort listings"
              className="px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F5132] min-h-[40px]"
            >
              <option value="newest">Recently Added</option>
              <option value="popular">Most Popular</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="semester_asc">Semester: 1 to 8</option>
            </select>
          </div>
        </div>

        {/* Expanded Filter Row */}
        {showFilters && (
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="filter-semester" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Semester
              </label>
              <select
                id="filter-semester"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F5132]"
              >
                <option value="all">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={String(s)}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-branch" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Branch / Department
              </label>
              <select
                id="filter-branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F5132]"
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b === 'all' ? 'All Branches' : b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-condition" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Book Condition
              </label>
              <select
                id="filter-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F5132]"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c === 'all' ? 'Any Condition' : c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                type="button"
                onClick={resetFilters}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer min-h-[40px]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
                <span>Clear Filters</span>
              </button>
            </div>
          </div>
        )}

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400">
            <p>
              Showing <span className="font-mono font-semibold text-slate-900 dark:text-white">{books.length}</span>{' '}
              matching {books.length === 1 ? 'listing' : 'listings'}
              {query ? ` for "${query}"` : ''}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}

        <div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-[3/4] bg-slate-200 dark:bg-slate-800" />
                  <div className="p-4 space-y-2.5">
                    <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-5 w-4/5 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-8 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-xl text-center">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
              <button
                type="button"
                onClick={loadBooks}
                className="mt-3 px-4 py-2 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : books.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                No books found
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                No available listings matched your search or semester filters. Try clearing filters
                or check back as students list books after exams.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 px-4 py-2 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] cursor-pointer"
              >
                View All Available Books
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onOpen={(id) => onNavigate(`/books/${id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works Editorial Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10">
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            How Campus Book Sharing Works
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Every listing and conversation stays inside the verified campus workflow without exposing
            personal phone numbers or private student emails publicly.
          </p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <p className="font-mono text-xs font-semibold text-[#0F5132] dark:text-emerald-400">
                01. List or Discover
              </p>
              <h3 className="mt-2 font-display text-base font-semibold text-slate-900 dark:text-white">
                Search by Course, Branch & Semester
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Filter textbooks by semester, edition, condition, copy count, and offer type—sell,
                lend, exchange, or donate.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs font-semibold text-[#0F5132] dark:text-emerald-400">
                02. Request & Message
              </p>
              <h3 className="mt-2 font-display text-base font-semibold text-slate-900 dark:text-white">
                Private Request Conversations
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Send a structured request to the book owner. Only the requester and owner can view
                messages to coordinate campus handover.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs font-semibold text-[#0F5132] dark:text-emerald-400">
                03. Complete & Review
              </p>
              <h3 className="mt-2 font-display text-base font-semibold text-slate-900 dark:text-white">
                Track Handover & Return Dates
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Accepted requests create a transaction record with lending due dates, completion
                tracking, and verified student reviews.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
