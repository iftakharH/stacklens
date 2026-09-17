// Shared presentational primitives. Styled with the landing-page token system
// (paper / panel / ink / muted / line / signal) so the app shell and the
// public landing page read as one product in both themes.

export const Card: React.FC<{
  title?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className = '' }) => (
  <section
    className={`rounded-[6px] border border-line bg-panel p-4 transition sm:p-5 md:p-6 ${className} fade-in`}
  >
    {title && (
      <header className="mb-3 sm:mb-4">
        <h2 className="text-[13px] font-semibold text-ink sm:text-[14px]">
          {title}
        </h2>
      </header>
    )}
    {children}
  </section>
);

export const SkeletonPulse: React.FC<{ label?: string }> = ({ label = 'Analyzing GitHub profile…' }) => (
  <div className="flex items-center gap-3 rounded-[6px] border border-line bg-panel px-4 py-2.5 text-[13px]">
    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-signal" />
    <span className="font-medium text-muted">{label}</span>
  </div>
);

export const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="rounded-[6px] border border-line bg-panel p-3">
    <p className="text-[11px] font-medium text-muted">{label}</p>
    <p className="mt-1 font-mono text-[16px] font-semibold tabular-nums text-ink">
      {value}
    </p>
  </div>
);

export const ScoreRow: React.FC<{ label: string; score: number }> = ({ label, score }) => {
  const percentage = (score / 10) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[13px] text-muted">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-ink">
          {score.toFixed(1)} / 10
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-signal"
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
      <p className="text-[13px] font-semibold text-ink">Members only</p>
      <h2 className="text-lg font-semibold text-ink sm:text-xl">{message}</h2>
      <p className="max-w-sm text-[13px] leading-relaxed text-muted">
        Use the Sign in button above to open the account panel on the landing
        page. Analyzing profiles always works without an account.
      </p>
    </div>
  </Card>
);
