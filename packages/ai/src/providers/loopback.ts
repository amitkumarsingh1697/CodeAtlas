/**
 * True when a URL points at this machine (127.0.0.0/8, ::1 or the name `localhost`).
 * Anything else, including private network addresses and 0.0.0.0, counts as remote:
 * sending source context there needs the user's explicit consent.
 */
export function isLoopbackUrl(raw: string): boolean {
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === 'localhost') return true;
  if (host === '[::1]' || host === '::1') return true;
  return /^127(\.\d{1,3}){3}$/.test(host);
}
