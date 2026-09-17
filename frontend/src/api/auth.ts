import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

// better-auth rejects a *relative* baseURL ("Invalid base URL: /api/auth") and
// throws while this module is being evaluated — before React mounts, which
// produced a blank page on the production build. The base URL therefore has to
// be absolute at runtime:
//
//   - explicit VITE_AUTH_BASE_URL wins (normalised to absolute below);
//   - dev talks straight to the backend (cookies are host-scoped, so localhost
//     cookies are shared across ports);
//   - every other build is same-origin: the SPA's own origin + /api/auth,
//     which production rewrites to api/index.js and `vite preview` proxies to
//     the local API.
const sameOriginBaseURL = `${window.location.origin}/api/auth`;

const resolveBaseURL = (): string => {
  const configured = (
    import.meta.env.VITE_AUTH_BASE_URL as string | undefined
  )?.trim();

  if (configured) {
    try {
      const url = new URL(configured, window.location.origin);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.href.replace(/\/+$/, '');
      }
    } catch {
      // Fall through to the safe defaults below.
    }
  }

  if (import.meta.env.DEV) return 'http://localhost:4000/api/auth';
  return sameOriginBaseURL;
};

const createClient = () => {
  try {
    return createAuthClient({
      baseURL: resolveBaseURL(),
      plugins: [magicLinkClient()],
    });
  } catch (err) {
    // A misconfiguration must never crash the app at module scope.
    console.error(
      'Failed to initialise the auth client; falling back to same-origin /api/auth.',
      err
    );
    return createAuthClient({
      baseURL: sameOriginBaseURL,
      plugins: [magicLinkClient()],
    });
  }
};

export const authClient = createClient();
