import { authClient } from '../api/auth';
import { useSignIn } from './signin-context';

/**
 * App-shell auth affordance: opens the sign-in panel in place, or shows the
 * signed-in identity with an exit. The avatar is set square on the field, the
 * way every other reading on the page is set.
 */
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
            className="h-8 w-8 border border-line-strong object-cover"
          />
        ) : (
          <span className="num flex h-8 w-8 items-center justify-center border border-line-strong text-[12px] text-ink">
            {(user.name || user.email || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[150px] truncate text-[12px] text-ink2 sm:inline">
          {user.name || user.email}
        </span>
        <button
          type="button"
          onClick={() => {
            void authClient.signOut();
          }}
          className="btn btn-sm"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={openSignIn} className="btn btn-sm">
      Sign in
    </button>
  );
}

export default AuthControls;
