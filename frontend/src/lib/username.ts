// Mirrors lib/validation.js's server-side extraction. Kept in one shared
// module so the URL prefill key in App and the analyzer's own extraction
// never drift apart.
const extractUsername = (raw: string): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('http') && !trimmed.includes('/')) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.pathname.split('/').filter(Boolean)[0] || null;
  } catch {
    // Scheme-less paste: "github.com/<x>" slices past the host;
    // "owner/repo" resolves to the OWNER (the profile, not the repository).
    const parts = trimmed.split('/').filter(Boolean);
    if (parts[0]?.toLowerCase() === 'github.com') return parts[1] || null;
    return parts[0] || null;
  }
};

export default extractUsername;
