import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { BookListing } from '../types';

interface BookCardProps {
  book: BookListing;
  onOpen: (id: string) => void;
}

const OFFER_LABELS: Record<string, string> = {
  sell: 'Sell',
  lend: 'Lend',
  donate: 'Donate',
  exchange: 'Exchange',
};

export function formatOfferPrice(book: BookListing): string {
  if (book.offerType === 'sell') {
    return `₹${book.price.toLocaleString('en-IN')}`;
  }
  if (book.offerType === 'lend') {
    return book.deposit > 0 ? `Free · ₹${book.deposit} deposit` : 'Free to borrow';
  }
  if (book.offerType === 'donate') {
    return 'Free donation';
  }
  return 'Book exchange';
}

export function BookCard({ book, onOpen }: BookCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const coverUrl = book.images?.[0];
  const avail = typeof book.availableQuantity === 'number' ? book.availableQuantity : 1;

  return (
    <article
      onClick={() => onOpen(book.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(book.id);
        }
      }}
      className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:border-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5132] flex flex-col"
    >
      <div className="relative aspect-[3/4] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden border-b border-slate-100 dark:border-slate-800">
        {coverUrl && !imgFailed ? (
          <img
            src={coverUrl}
            alt={`${book.title} cover`}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 text-slate-600 dark:text-slate-300">
            <BookOpen className="w-9 h-9 mb-3 text-[#0F5132] dark:text-emerald-400" aria-hidden="true" />
            <p className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-3">
              {book.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{book.author}</p>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            <span>Sem {book.semester}</span>
            <span aria-hidden="true"> · </span>
            <span>{book.branch}</span>
            <span aria-hidden="true"> · </span>
            <span>{book.condition}</span>
            <span aria-hidden="true"> · </span>
            <span className="text-[#0F5132] dark:text-emerald-400 font-medium">
              {OFFER_LABELS[book.offerType]}
            </span>
            {avail > 1 && (
              <>
                <span aria-hidden="true"> · </span>
                <span>{avail} copies</span>
              </>
            )}
          </p>

          <h3 className="mt-1.5 font-display text-base font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">
            {book.title}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 truncate">{book.author}</p>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatOfferPrice(book)}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {book.owner?.name || 'Student'}
            {book.owner?.verified ? ' · Verified' : ''}
          </span>
        </div>
      </div>
    </article>
  );
}
