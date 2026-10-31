import type { PostHog } from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export type EventName =
  | 'landing_view'
  | 'play_click'
  | 'login_success'
  | 'round_start'
  | 'shot'
  | 'round_end'
  | 'result_view'
  | 'play_again_click'
  | 'share_click'
  | 'cta_click'
  | 'reward_issued'
  | 'coupon_copy'
  | 'error';

let client: Promise<PostHog | null> | undefined;

function posthog(): Promise<PostHog | null> {
  client ??= POSTHOG_KEY
    ? import('posthog-js').then(({ default: ph }) => {
        ph.init(POSTHOG_KEY, { api_host: POSTHOG_HOST, autocapture: false });
        return ph;
      })
    : Promise.resolve(null);
  return client;
}

/** Fire and forget. Analytics must never break the game. */
export function track(name: EventName, props?: Record<string, unknown>): void {
  posthog()
    .then((ph) => ph?.capture(name, props))
    .catch(() => {});
}

export function startMonitoring(): void {
  const report = (message: string) => track('error', { message });
  window.addEventListener('error', (e) => report(e.message));
  window.addEventListener('unhandledrejection', (e) => report(String(e.reason)));
  if (SENTRY_DSN) {
    void import('@sentry/react').then((Sentry) =>
      Sentry.init({ dsn: SENTRY_DSN, release: import.meta.env.VITE_RELEASE as string | undefined }),
    );
  }
}
