# 10 Heads. 30 Seconds.

A 30-second portrait archery mini-game for a movie-ticket campaign. Vite, React 18, Tailwind and Phaser 3 on Vercel, with Supabase for auth, data and anti-cheat.

The score that counts comes from the server. `supabase/functions/_shared/sim.ts` is a pure simulation that the phone and the Edge Function both run, so one seed and one shot log give one score.

## Setup

Needs Node 22 and pnpm.

```bash
pnpm install
cp .env.example .env
pnpm dev        # http://localhost:5173
```

With `VITE_SUPABASE_URL` empty, `pnpm dev` uses a mock backend in the browser. Any 10-digit number and any 6-digit OTP log you in. Production builds never load the mock.

| Command          | Does                                   |
| ---------------- | -------------------------------------- |
| `pnpm test`      | Simulation, anti-cheat, RLS, OG images |
| `pnpm typecheck` | TypeScript                             |
| `pnpm lint`      | ESLint                                 |
| `pnpm build`     | Production build                       |

Add `?debug=1` to `/play` for FPS, hitboxes, seed and tick. In dev, `?seed=42` fixes the seed.

## Environment variables

See [.env.example](.env.example).

| Name                                          | Where            | Purpose                        |
| --------------------------------------------- | ---------------- | ------------------------------ |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Vercel           | Supabase project               |
| `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`       | Vercel           | Analytics; off when empty      |
| `VITE_SENTRY_DSN`, `VITE_RELEASE`             | Vercel           | Errors; off when empty         |
| `HOST_JWT_SECRET`                             | Supabase secrets | Verifies `?token=` from a host |
| `ALLOWED_ORIGIN`                              | Supabase secrets | CORS; set to your domain       |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`   | Your shell       | `pnpm coupons` only            |

## Deploy to Supabase

```bash
supabase link --project-ref <ref>
supabase db push
supabase secrets set HOST_JWT_SECRET=<secret> ALLOWED_ORIGIN=https://<domain>
supabase functions deploy session round-start round-finish reward
supabase functions deploy auth-embed --no-verify-jwt
```

In the Supabase dashboard, enable the Phone provider with an SMS gateway. Enable the Email provider too if you use embedded login, because `auth-embed` signs users in through a magic link.

## Deploy to Vercel

Import the repo, set the variables above, and deploy. `vercel.json` handles routing and caching, and `api/og.ts` deploys by itself.

## Swap art

1. Put files in `public/assets` with the names in `public/assets/assets.json`.
2. Set `"ready": true` on each file you added. Anything still `false` keeps its placeholder.
3. For `hit_burst`, also add `"frame": { "frameWidth": 256, "frameHeight": 256 }` with your real frame size.

The hit circle is `headWidth * hitRadiusFactor` in `simConfig.ts`. Check it against new head art with `?debug=1`.

## Change numbers and copy

- **Rules the server must agree with** (speed, arrows, hit size): `supabase/functions/_shared/simConfig.ts`. Deploy the Edge Functions and the site together. Rounds in play when these change can score differently.
- **Visual numbers:** `src/game/config.ts`.
- **Copy:** `src/config/campaign.ts`.
- **Live campaign values:** rows in the `campaign_config` table. These need no deploy: `reward_short`, `reward_title`, `reward_conditions`, `is_open`, `starts_at`, `ends_at`, `round_seconds`, `arrows`, `attempts_per_user`, `reward_valid_days`. Keep `heads` at 10 unless you add head art.

To stop play at once:

```sql
update campaign_config set value = 'false' where key = 'is_open';
```

## Load coupons

The CSV needs one code per line in the first column. Loading a file twice is safe.

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm coupons coupons.csv raavan-2026
```

The campaign name must match the `campaign` row in `campaign_config`. When the pool runs out, winners see a message and Postgres logs a warning.

## Embedded login

The host app opens the game with `?token=<JWT>`, signed with HS256 and `HOST_JWT_SECRET`. The token needs `sub` (your user id) and `exp`. Keep the expiry short, because the token travels in a URL. The game removes it from the address bar after login.

## Reskin

Replace the copy in `campaign.ts`, the art in `assets.json`, the colours in `@theme` in `src/index.css`, and the coupon pool. Change the `campaign` row to the new pool name. `sim.ts` needs no change.
