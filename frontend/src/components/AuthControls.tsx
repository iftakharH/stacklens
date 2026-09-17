import { authClient } from '../api/auth';
import { useSignIn } from './signin-context';

const secondaryButtonClass =
  'inline-flex h-9 items-center justify-center rounded-[6px] border border-line px-3 text-[13px] font-semibold text-ink transition-colors hover:border-signal disabled:opacity-60';

// App-shell auth affordance: opens the sign-in dialog in place (any page can
// also open it via useSignIn), or shows the signed-in identity + sign-out.
function AuthControls() {
  const { data: session, isPending } = authClient.useSession();
  const { openSignIn } = useSignIn();

  if (isPending) return null;

  if (session?.user) {
    const user = session.user;
    return (
      <div className="flex items-center gap-2">
        {user.image ? (
          <img
            src={user.image}
            alt=""
            className="h-8 w-8 rounded-full border border-line object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-panel font-mono text-[12px] text-ink">
            {(user.name || user.email || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[140px] truncate text-[13px] font-medium text-ink sm:inline">
          {user.name || user.email}
        </span>
        <button
          type="button"
          onClick={() => {
            void authClient.signOut();
          }}
          className={secondaryButtonClass}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={openSignIn} className={secondaryButtonClass}>
      Sign in
    </button>
  );
}

export default AuthControls;
