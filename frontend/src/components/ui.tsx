/* Shared presentational primitives for the Signal Calibration world.
 *
 * One rule holds the whole page together: nothing is boxed. Hierarchy comes
 * from the field, the graticule, tick scales, brightness and measured type —
 * never from a bordered container. `Field` is a section with a scale for a
 * header, not a card.
 */

const REG_MARK = (
  <svg viewBox="0 0 14 14" aria-hidden="true" className="h-3.5 w-3.5">
    <circle
      cx="7"
      cy="7"
      r="4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    />
    <path
      d="M7 0v3M7 11v3M0 7h3M11 7h3"
      stroke="currentColor"
      strokeWidth="1"
      fill="none"
    />
  </svg>
);

/** Four corner registration marks. Purely optical: the page is in register. */
export const Registration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <div
    aria-hidden="true"
    className={`reg-mark pointer-events-none absolute inset-0 ${className}`}
  >
    <span className="absolute left-2 top-2">{REG_MARK}</span>
    <span className="absolute right-2 top-2">{REG_MARK}</span>
    <span className="absolute bottom-2 left-2">{REG_MARK}</span>
    <span className="absolute bottom-2 right-2">{REG_MARK}</span>
  </div>
);

/** A hairline that is also a scale, with an optional label set in the margin. */
export const TickRule: React.FC<{ label?: string; right?: string }> = ({
  label,
  right,
}) => (
  <div className="tick-rule mt-0">
    {(label || right) && (
      <div className="mb-2 flex items-baseline justify-between gap-4">
        {label ? <span className="rail text-muted">{label}</span> : <span />}
        {right ? <span className="rail-sm text-muted">{right}</span> : null}
      </div>
    )}
  </div>
);

/** A content field. A scale header, hairline structure, no enclosure. */
export const Field: React.FC<{
  title?: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}> = ({ title, meta, children, className = '', id }) => (
  <section id={id} className={`pt-4 sm:pt-5 ${className}`}>
    {title && (
      <header className="mb-4 border-t border-line-strong pt-3">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 className="display-tight text-[clamp(0.95rem,1.5vw,1.15rem)] text-ink">
            {title}
          </h2>
          {meta ? (
            <span className="rail-sm hidden shrink-0 text-muted sm:block">{meta}</span>
          ) : null}
        </div>
        <div className="ticks-x-subtle" aria-hidden="true" />
      </header>
    )}
    {children}
  </section>
);

/** Backwards-compatible alias for the old card shell. */
export const Card = Field;

/** A single measured value, label in the margin, numeral set on the field.
 *  Renders a `dt`/`dd` pair so callers must supply the wrapping `<div>` inside
 *  a `<dl>` (the only child shape axe accepts there). */
export const Readout: React.FC<{
  label: string;
  value: React.ReactNode;
  note?: string;
  /** `lg` for the identity field's headline numbers. */
  size?: 'sm' | 'lg';
}> = ({ label, value, note, size = 'sm' }) => (
  <>
    <dt className="rail-sm text-muted">{label}</dt>
    <dd
      className={`num mt-1.5 text-ink ${
        size === 'lg'
          ? 'text-[clamp(1.15rem,2.2vw,1.6rem)] font-semibold'
          : 'text-[0.9375rem] font-medium'
      }`}
    >
      {value}
      {note ? <span className="mt-1 block text-[11px] text-muted">{note}</span> : null}
    </dd>
  </>
);

type Band = { at: number; label: string };

/**
 * A calibrated scale. The value is read as a position between printed band
 * boundaries, so a score shows where it sits — not just what it is. Graduations
 * and boundaries are drawn; the needle arrives damped, never snapped.
 */
export const Scale: React.FC<{
  value: number;
  max?: number;
  bands?: Band[];
  /** Accessible description of what the scale reads. */
  label: string;
  compact?: boolean;
}> = ({ value, max = 10, bands, label, compact = false }) => {
  const clamped = Math.min(Math.max(value, 0), max);
  const at = (clamped / max) * 100;
  const steps = Array.from({ length: max + 1 }, (_, i) => i);

  return (
    <div>
      <div
        className="scale"
        style={{ height: compact ? '1.5rem' : '2.25rem' }}
        role="img"
        aria-label={`${label}: ${clamped.toFixed(1)} of ${max}`}
      >
        <div className="scale-track" aria-hidden="true" />
        {steps.map((step) => (
          <span
            key={step}
            aria-hidden="true"
            className="scale-graduation"
            style={{
              left: `${(step / max) * 100}%`,
              height: step % 5 === 0 ? '7px' : '4px',
            }}
          />
        ))}
        {bands?.map((band) => (
          <span
            key={band.label}
            aria-hidden="true"
            className="scale-band"
            style={{ left: `${(band.at / max) * 100}%` }}
          />
        ))}
        <span className="needle" aria-hidden="true" style={{ left: `${at}%` }} />
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between">
          <span className="rail-sm text-muted">0</span>
          <span className="rail-sm text-muted">{max}</span>
        </div>
      )}
    </div>
  );
};

/** One sub-score: name, calibrated scale, and the number it resolved to. */
export const Gauge: React.FC<{ label: string; score: number }> = ({
  label,
  score,
}) => (
  <div>
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[13px] text-ink2">{label}</span>
      <span className="num text-[12px] text-ink">{score.toFixed(1)} / 10</span>
    </div>
    <div className="mt-1.5">
      <Scale value={score} label={label} compact />
    </div>
  </div>
);

/** Acquisition indicator. The card is taking a reading. */
export const SkeletonPulse: React.FC<{ label?: string }> = ({
  label = 'Acquiring reading',
}) => (
  <div
    className="flex items-center gap-3 border border-line px-3 py-2"
    role="status"
    aria-live="polite"
  >
    <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
      <span className="w-[2px] animate-pulse bg-signal" style={{ height: '40%' }} />
      <span
        className="w-[2px] animate-pulse bg-signal"
        style={{ height: '100%', animationDelay: '120ms' }}
      />
      <span
        className="w-[2px] animate-pulse bg-signal"
        style={{ height: '65%', animationDelay: '240ms' }}
      />
    </span>
    <span className="rail text-muted">{label}</span>
    <span className="ml-auto rail-sm text-muted">—</span>
  </div>
);

/** Empty / gated state: a field with its reading absent. */
export const EmptyField: React.FC<{
  kicker: string;
  heading: string;
  body: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ kicker, heading, body, action, children }) => (
  <div className="relative border border-dashed border-line-strong px-5 py-12 text-center sm:py-16">
    <Registration />
    <p className="rail text-muted">{kicker}</p>
    <h2 className="display-tight mt-3 text-[clamp(1.05rem,2vw,1.4rem)] text-ink">
      {heading}
    </h2>
    <p className="mx-auto mt-3 max-w-[52ch] text-[13px] leading-relaxed text-muted">
      {body}
    </p>
    {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    {children}
  </div>
);

export const SignInRequiredCard: React.FC<{ message: string }> = ({
  message,
}) => (
  <EmptyField
    kicker="Reading withheld"
    heading={message}
    body="Use Sign in to open the account panel. Analyzing profiles always works without an account."
  />
);
