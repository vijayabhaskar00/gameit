# Row Level Security review

Reviewed against `supabase/migrations/0001_init.sql`.

| Table             | anon      | Logged-in player | Writes              |
| ----------------- | --------- | ---------------- | ------------------- |
| `profiles`        | None      | Own row, read    | Edge Functions only |
| `rounds`          | None      | Own rows, read   | Edge Functions only |
| `rewards`         | None      | Own row, read    | Edge Functions only |
| `coupons`         | None      | None             | Edge Functions, CSV |
| `campaign_config` | All, read | All, read        | Service role only   |
| `rate_limits`     | None      | None             | Edge Functions only |

## Findings

- **Tested in `tests/backend.test.ts`:** a player cannot read another player's rows, cannot read coupons, cannot write to `profiles` or `coupons`, and cannot call `round_start`.
- **`campaign_config` is public on purpose.** The landing page reads it before login. Never put a secret in it.
- **Players never see unassigned coupons.** A player gets a code only through their own `rewards` row.
- **`round_start`, `round_finish`, `round_reject`, `session_upsert` and `rate_limit_hit`** are `security definer`, have a fixed `search_path`, and only `service_role` can execute them.
- **`config_text` and `campaign_is_open`** run with the caller's rights and read public data only. The review added a fixed `search_path` to both, which the Supabase linter asks for.

## Known limits

- **The seed reaches the client**, as the spec requires. A cheater can therefore solve a round offline and submit a real winning log, and the server cannot tell it from a skilled player. The damage stops at one coupon per verified phone number.
- **`auth-embed` has no rate limit**, because no user exists yet at that point. It only does work for a token signed with `HOST_JWT_SECRET`. Skip deploying it if no host app embeds the game.
- **Not run on real Supabase.** The tests use the same SQL with a small stand-in for the `auth` schema. Rerun the checks in `docs/runbook.md` on the first deployed project.
