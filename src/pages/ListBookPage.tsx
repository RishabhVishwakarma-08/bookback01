import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBook, imageFileToDataUrl, saveBook } from '../data/localStore';
import type { BookCondition, BookListing, OfferType } from '../types';

interface ListBookPageProps {
  editBookId?: string;
  onNavigate: (path: string) => void;
}

const BRANCHES = ['CSE', 'IT', 'ECE', 'EE', 'ME', 'CE', 'AI & DS', 'Other'];
const CONDITIONS: BookCondition[] = ['New', 'Like New', 'Good', 'Fair'];
const PRESET_COVERS = [
  {
    label: 'Algorithms & CS',
    url: '/assets/images/book_cover_algorithms_1794567285119.jpg',
  },
  {
    label: 'Circuits & Electronics',
    url: '/assets/images/book_cover_circuits_1794567285219.jpg',
  },
  {
    label: 'Mathematics & Calculus',
    url: '/assets/images/book_cover_calculus_1794567285441.jpg',
  },
  {
    label: 'Economics & Management',
    url: '/assets/images/book_cover_economics_1794567286864.jpg',
  },
];

export function ListBookPage({ editBookId, onNavigate }: ListBookPageProps) {
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [subject, setSubject] = useState('');
  const [course, setCourse] = useState('');
  const [isbn, setIsbn] = useState('');
  const [edition, setEdition] = useState('');
  const [branch, setBranch] = useState('CSE');
  const [semester, setSemester] = useState(4);
  const [condition, setCondition] = useState<BookCondition>('Like New');
  const [offerType, setOfferType] = useState<OfferType>('sell');
  const [price, setPrice] = useState('350');
  const [deposit, setDeposit] = useState('200');
  const [loanDurationDays, setLoanDurationDays] = useState('30');
  const [quantity, setQuantity] = useState('1');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(PRESET_COVERS[0].url);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdBook, setCreatedBook] = useState<BookListing | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('/auth');
    }
  }, [authLoading, user, onNavigate]);

  useEffect(() => {
    if (user && !editBookId) {
      setBranch(user.branch || 'CSE');
      setSemester(user.semester || 4);
    }
  }, [user, editBookId]);

  useEffect(() => {
    if (!editBookId) return;
    try {
      const { book } = getBook(editBookId, user?.id);
        setTitle(book.title);
        setAuthor(book.author);
        setSubject(book.subject);
        setCourse(book.course || '');
        setIsbn(book.isbn || '');
        setEdition(book.edition || '');
        setBranch(book.branch);
        setSemester(book.semester);
        setCondition(book.condition);
        setOfferType(book.offerType);
        setPrice(String(book.price));
        setDeposit(String(book.deposit || 0));
        setLoanDurationDays(String(book.loanDurationDays || 30));
        setQuantity(String(book.quantity || 1));
        setDescription(book.description);
        if (book.images?.[0]) setImageUrl(book.images[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load listing for editing.');
    }
  }, [editBookId, user?.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      setImageUrl(await imageFileToDataUrl(file));
    } catch (err: any) {
      setError(err.message || 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        author: author.trim(),
        subject: subject.trim(),
        course: course.trim(),
        isbn: isbn.trim(),
        edition: edition.trim(),
        branch,
        semester: Number(semester),
        condition,
        offerType,
        price: offerType === 'sell' ? Number(price) || 0 : 0,
        deposit: offerType === 'lend' ? Number(deposit) || 0 : 0,
        loanDurationDays: offerType === 'lend' ? Number(loanDurationDays) || 30 : 30,
        quantity: Math.max(1, Number(quantity) || 1),
        description: description.trim(),
        images: [imageUrl],
      };

      if (editBookId) {
        setCreatedBook(saveBook(payload, user!.id, editBookId));
      } else {
        setCreatedBook(saveBook(payload, user!.id));
      }
    } catch (err: any) {
      setError(err.message || 'Could not save book listing.');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdBook) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-5">
          <CheckCircle2 className="w-12 h-12 text-[#16A34A] dark:text-emerald-400 mx-auto" aria-hidden="true" />
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {editBookId ? 'Listing Updated' : 'Book Listed Successfully'}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-white">{createdBook.title}</strong> is saved in
              this browser and visible in the campus catalog.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate(`/books/${createdBook.id}`)}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] cursor-pointer"
            >
              View Book Listing
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <button
        type="button"
        onClick={() => onNavigate('/dashboard')}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to Dashboard</span>
      </button>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          {editBookId ? 'Edit Book Listing' : 'List an Academic Book'}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Provide accurate course, semester, condition, and offer terms so fellow students can find
          your book easily.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="book-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Book Title
              </label>
              <input
                id="book-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Database System Concepts"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="book-author" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Author(s)
              </label>
              <input
                id="book-author"
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Abraham Silberschatz, Henry Korth"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="book-subject" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Subject
              </label>
              <input
                id="book-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Database Management"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="book-course" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Course Code (optional)
              </label>
              <input
                id="book-course"
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="CS-401 DBMS"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="book-edition" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Edition (optional)
              </label>
              <input
                id="book-edition"
                type="text"
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
                placeholder="7th Edition"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div>
              <label htmlFor="book-branch" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Branch
              </label>
              <select
                id="book-branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="book-semester" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Semester
              </label>
              <select
                id="book-semester"
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="book-condition" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Condition
              </label>
              <select
                id="book-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as BookCondition)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="book-quantity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Copies
              </label>
              <input
                id="book-quantity"
                type="number"
                min={1}
                max={200}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="book-isbn" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ISBN (optional)
              </label>
              <input
                id="book-isbn"
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978-0078022159"
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Offer Type
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(
                [
                  { id: 'sell', label: 'Sell' },
                  { id: 'lend', label: 'Lend' },
                  { id: 'donate', label: 'Donate (Free)' },
                  { id: 'exchange', label: 'Exchange' },
                ] as { id: OfferType; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOfferType(opt.id)}
                  className={`px-3.5 py-2.5 text-sm font-semibold rounded-lg border transition-colors cursor-pointer ${
                    offerType === opt.id
                      ? 'bg-[#0F5132] dark:bg-emerald-600 text-white border-[#0F5132] dark:border-emerald-600'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {offerType === 'sell' && (
            <div className="max-w-xs">
              <label htmlFor="book-price" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Selling Price (₹ INR)
              </label>
              <input
                id="book-price"
                type="number"
                min={1}
                max={50000}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          )}

          {offerType === 'lend' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <div>
                <label htmlFor="book-deposit" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Refundable Deposit (₹ INR)
                </label>
                <input
                  id="book-deposit"
                  type="number"
                  min={0}
                  max={50000}
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="book-days" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Loan Duration (days)
                </label>
                <input
                  id="book-days"
                  type="number"
                  min={1}
                  max={365}
                  value={loanDurationDays}
                  onChange={(e) => setLoanDurationDays(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="book-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description & Handover Notes
            </label>
            <textarea
              id="book-desc"
              rows={3}
              required
              minLength={10}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe page condition, highlights, and preferred campus pickup area..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Book Cover Image</span>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#0F5132] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg cursor-pointer hover:bg-emerald-100">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{uploading ? 'Uploading...' : 'Upload Photo'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PRESET_COVERS.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => setImageUrl(preset.url)}
                  className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                    imageUrl === preset.url
                      ? 'border-[#0F5132] dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/40'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <img
                    src={preset.url}
                    alt={preset.label}
                    className="w-full aspect-[3/4] object-cover rounded mb-1.5"
                  />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {preset.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] disabled:opacity-60 cursor-pointer min-h-[44px]"
            >
              {submitting ? 'Saving...' : editBookId ? 'Save Changes' : 'Publish Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
