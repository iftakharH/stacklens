// Shared presentational primitives, extracted as-is from the original
// App.tsx report rendering so every page reuses the same look.

export const Card: React.FC<{
  title?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className = '' }) => (
  <section
    className={`rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm transition dark:border-slate-700/80 dark:bg-slate-800/80 sm:p-5 md:p-6 ${className} fade-in`}
  >
    {title && (
      <header className="mb-3 sm:mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-sm">
          {title}
        </h2>
      </header>
    )}
    {children}
  </section>
);

export const SkeletonPulse: React.FC<{ label?: string }> = ({ label = 'Analyzing GitHub profile…' }) => (
  <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
    <span className="h-3 w-3 animate-pulse rounded-full bg-primary-soft" />
    <span className="font-medium text-slate-600 dark:text-slate-300">
      {label}
    </span>
  </div>
);

export const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-800/80">
    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100 sm:text-xl">
      {value}
    </p>
  </div>
);

export const ScoreRow: React.FC<{ label: string; score: number }> = ({ label, score }) => {
  const percentage = (score / 10) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">
          {score.toFixed(1)} / 10
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-soft to-emerald-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Friendly gate shown when a signed-in-only page is viewed without a session
// (or when accounts are not configured on the server).
export const SignInRequiredCard: React.FC<{ message: string }> = ({ message }) => (
  <Card>
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-primary-soft">
        Members only
      </p>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 sm:text-xl">
        {message}
      </h2>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
        Use the sign-in controls at the top right of this page. Analyzing
        profiles always works without an account.
      </p>
    </div>
  </Card>
);
