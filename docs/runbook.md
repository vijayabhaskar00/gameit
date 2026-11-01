# Launch runbook

## Before launch day

**Supabase**

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase secrets set ALLOWED_ORIGIN=https://<domain> HOST_JWT_SECRET=<secret>
npx supabase functions deploy session round-start round-finish reward
npx supabase functions deploy auth-embed --no-verify-jwt   # embedded login only
```

- Enable the Phone provider with an SMS gateway. Sender registration in India can take days, so start early.
- Open Authentication > Rate Limits and raise the SMS limit. It covers the whole project, so a low value stops logins during a traffic spike.
- Set `starts_at`, `ends_at` and the reward copy in `campaign_config`.
- Load coupons with `pnpm coupons coupons.csv raavan-2026`. Load more than your expected winners.

**Vercel**

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add VITE_POSTHOG_KEY production
vercel env add VITE_SENTRY_DSN production
vercel env rm VITE_DEMO production
vercel domains add <domain>
```

Point DNS at Vercel as `vercel domains inspect <domain>` says. `ALLOWED_ORIGIN` must match this domain exactly. Redeploy after changing any variable, because `VITE_` values are built into the site.

**PostHog funnel.** Create a dashboard with one funnel over 7 days:
`landing_view` > `play_click` > `login_success` > `round_start` > `round_end` > `result_view` > `reward_issued` > `coupon_copy` > `cta_click`.
Add trends for `error` and for `round_end` broken down by `score`.

**Sentry.** Each deploy tags its release with the Git commit. Add alerts for new issues and for error spikes.

**Sign-off**

- [ ] `pnpm test` and `pnpm attack` pass.
- [ ] `docs/device-qa.md` is complete on real phones.
- [ ] k6 load test passed on staging, with errors under 0.5%.
- [ ] Terms, Privacy and `ctaUrl` hold real content, and legal has approved them.
- [ ] One real phone logs in, wins, and redeems the coupon.
- [ ] A logged-in player reading `coupons` through the Supabase client gets no rows.

## Launch

1. Keep the campaign closed: `update campaign_config set value = 'false' where key = 'is_open';`
2. Deploy, then confirm the production domain shows "Campaign closed".
3. Paste the link into WhatsApp and check the preview.
4. Open: `update campaign_config set value = 'true' where key = 'is_open';`
5. Play one round on a real phone, then announce the link.

## During the campaign

Run these in the Supabase SQL editor.

```sql
-- Coupons left. Add more before this reaches zero.
select count(*) from coupons where assigned_to is null;

-- Rejections in the last hour. A jump means someone is probing.
select reject_reason, count(*) from rounds
where status = 'rejected' and started_at > now() - interval '1 hour' group by 1;
```

## When something breaks

| Symptom                      | Action                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| Need to stop play now        | Set `is_open` to `false`. No deploy needed                     |
| Coupons ran out              | Run `pnpm coupons` with more codes                             |
| Winners without a coupon     | Query `rounds` for `server_score = 10` with no `rewards` row   |
| OTP not arriving             | Check the SMS gateway balance, then the Auth rate limit        |
| "Could not reach the server" | Check `ALLOWED_ORIGIN`, then Edge Function logs                |
| Bad site deploy              | Run `vercel rollback`                                          |
| Bad Edge Function            | Redeploy the last good commit with `supabase functions deploy` |

Changing `simConfig.ts` during a campaign changes scoring. Close the campaign, deploy the Edge Functions and the site together, then reopen.

## After the campaign

Set `is_open` to `false`. Export winners, then delete phone numbers as the privacy policy says.
