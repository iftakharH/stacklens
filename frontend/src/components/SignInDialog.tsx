import { useEffect, useRef } from 'react';
import SignInMethods from './SignInMethods';
import { Registration } from './ui';

/** Returns focusable elements inside the dialog, in DOM order. */
const focusables = (root: HTMLElement): HTMLElement[] =>
  Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  );

/**
 * Modal sign-in available from every app page. Closes on Esc and on a backdrop
 * click, moves focus into the panel on open, keeps Tab cycling inside the
 * dialog while it is open, restores focus back to the trigger on close, and
 * restores page scrolling. The panel is a plate on the field, framed like the
 * card it interrupts.
 */
const SignInDialog: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && panel) {
        // Keep Tab cycling between the backdrop scrim and the panel's
        // controls — aria-modal is visual, browsers still Tab out of it.
        const stop = document.querySelector<HTMLElement>('.scrim');
        const cycle = stop ? [stop, ...focusables(panel)] : focusables(panel);
        if (cycle.length === 0) return;
        const first = cycle[0];
        const last = cycle[cycle.length - 1];
        const current = document.activeElement;
        if (e.shiftKey) {
          if (!current || current === first) {
            e.preventDefault();
            last.focus();
          }
        } else if (!cycle.includes(current as HTMLElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close sign-in"
        onClick={onClose}
        className="scrim absolute inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-dialog-title"
        className="plate relative w-full max-w-[420px] p-5 sm:p-7"
      >
        <Registration />
        <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
          <div>
            <p id="signin-dialog-title" className="rail text-muted">
              Account · sign in
            </p>
            <p className="display-tight mt-2 text-[1.05rem] text-ink">
              Keep the work you have already done.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center border border-transparent text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="h-3.5 w-3.5 fill-current"
            >
              <path d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          Save candidates, keep a history, and share reports. Analyzing never
          requires an account.
        </p>

        <div className="mt-5">
          <SignInMethods idPrefix="dialog" />
        </div>
      </div>
    </div>
  );
};

export default SignInDialog;
