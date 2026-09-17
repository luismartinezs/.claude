/**
 * Fire a custom Umami analytics event.
 * No-ops silently when Umami isn't loaded (dev, ad-blockers, missing env var).
 */
export function trackEvent(
  name: string,
  data?: Record<string, string>,
): void {
  if (typeof window === 'undefined') return;
  const u = (window as unknown as { umami?: { track: (name: string, data?: Record<string, string>) => void } }).umami;
  if (u) u.track(name, data);
}
