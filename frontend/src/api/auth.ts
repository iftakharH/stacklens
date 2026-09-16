import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

// Dev talks straight to the backend (cookies are host-scoped, so localhost
// cookies are shared across ports). Prod uses the same-origin /api rewrite.
const baseURL = import.meta.env.DEV
  ? 'http://localhost:4000/api/auth'
  : '/api/auth';

export const authClient = createAuthClient({
  baseURL,
  plugins: [magicLinkClient()],
});
