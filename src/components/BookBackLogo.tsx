export function BookBackLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 40 40"
        fill="none"
        className="w-8 h-8 shrink-0"
        aria-hidden="true"
      >
        <rect width="40" height="40" rx="10" className="fill-[#0F5132] dark:fill-emerald-600" />
        <path
          d="M9.5 13C9.5 11.8954 10.3954 11 11.5 11H17.8C19.015 11 20 11.985 20 13.2V28.5C20 27.3954 19.1046 26.5 18 26.5H11.5C10.3954 26.5 9.5 25.6046 9.5 24.5V13Z"
          fill="#ECFDF5"
        />
        <path
          d="M30.5 13C30.5 11.8954 29.6046 11 28.5 11H22.2C20.985 11 20 11.985 20 13.2V28.5C20 27.3954 20.8954 26.5 22 26.5H28.5C29.6046 26.5 30.5 25.6046 30.5 24.5V13Z"
          fill="#D1FAE5"
        />
        <path
          d="M14 17H16.8M14 20.2H16.8M23.2 17H26M23.2 20.2H26"
          stroke="#0F5132"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M14.5 31C17.8 33.2 22.2 33.2 25.5 31"
          stroke="#F59E0B"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M24.2 29.2L26.5 30.9L24.7 33.1"
          stroke="#F59E0B"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && (
        <span className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Book<span className="text-[#0F5132] dark:text-emerald-400">Back</span>
        </span>
      )}
    </span>
  );
}
