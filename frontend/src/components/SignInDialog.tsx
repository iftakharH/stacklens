import { useEffect, useRef } from 'react';
import SignInMethods from './SignInMethods';

// Modal sign-in available from every app page. Closes on Esc and on a backdrop
// click, moves focus into the panel on open, and restores page scrolling.
const SignInDialog: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close sign-in"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-dialog-title"
        className="relative w-full max-w-[400px] rounded-[6px] border border-line bg-panel p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              id="signin-dialog-title"
              className="text-[14px] font-semibold text-ink"
            >
              Sign in
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Save candidates, keep a history, and share reports.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-muted transition-colors hover:text-ink"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="h-4 w-4 fill-current"
            >
              <path d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        <div className="mt-5">
          <SignInMethods idPrefix="dialog" />
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          Analyzing profiles never requires an account.
        </p>
      </div>
    </div>
  );
};

export default SignInDialog;
