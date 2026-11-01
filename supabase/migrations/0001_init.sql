-- Schema, row level security and the transactional functions behind the Edge Functions.
-- Edge Functions call the functions below with the service role; players only ever read.

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  phone text,
  attempts_left int not null default 10,
  best_score int not null default 0,
  last_score int,
  created_at timestamptz not null default now()
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  seed bigint not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  shot_log jsonb,
  client_score int,
  server_score int,
  status text not null default 'started' check (status in ('started', 'finished', 'rejected')),
  reject_reason text
);
create unique index rounds_one_started_per_user on rounds (user_id) where status = 'started';

create table coupons (
  code text primary key,
  campaign text not null,
  assigned_to uuid references profiles,
  assigned_at timestamptz,
  expires_at timestamptz
);
create index coupons_free on coupons (campaign) where assigned_to is null;

create table rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles on delete cascade,
  round_id uuid not null references rounds,
  coupon_code text not null references coupons,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table campaign_config (
  key text primary key,
  value jsonb not null
);

insert into campaign_config (key, value) values
  ('campaign', '"raavan-2026"'),
  ('round_seconds', '30'),
  ('arrows', '12'),
  ('heads', '10'),
  ('attempts_per_user', '10'),
  ('starts_at', '"2026-11-01T00:00:00+05:30"'),
  ('ends_at', '"2026-12-01T00:00:00+05:30"'),
  ('is_open', 'true'),
  ('reward_short', '"50% off on movie tickets"'),
  ('reward_title', '"Win 50% OFF up to ₹200 on movie tickets"'),
  ('reward_conditions', '"Use your offer on 2 or more tickets. Valid for 3 days after you win."'),
  ('reward_valid_days', '3');

create table rate_limits (
  user_id uuid primary key,
  window_start timestamptz not null,
  hits int not null
);

alter table profiles enable row level security;
alter table rounds enable row level security;
alter table coupons enable row level security;
alter table rewards enable row level security;
alter table campaign_config enable row level security;
alter table rate_limits enable row level security;

create policy "read own profile" on profiles for select to authenticated using (id = auth.uid());
create policy "read own rounds" on rounds for select to authenticated using (user_id = auth.uid());
create policy "read own reward" on rewards for select to authenticated using (user_id = auth.uid());
-- Holds public campaign copy and dates only. The landing page reads it before login.
create policy "read campaign" on campaign_config for select to anon, authenticated using (true);

create function config_text(p_key text) returns text
language sql stable set search_path = public as $$
  select value #>> '{}' from public.campaign_config where key = p_key
$$;

create function campaign_is_open() returns boolean
language sql stable set search_path = public as $$
  select config_text('is_open')::boolean
    and now() >= config_text('starts_at')::timestamptz
    and now() < config_text('ends_at')::timestamptz
$$;

create function session_upsert(p_user uuid, p_name text, p_phone text) returns profiles
language plpgsql security definer set search_path = public as $$
declare
  result profiles;
begin
  insert into profiles (id, display_name, phone, attempts_left)
  values (p_user, nullif(p_name, ''), p_phone, config_text('attempts_per_user')::int)
  on conflict (id) do update set
    display_name = coalesce(nullif(p_name, ''), profiles.display_name),
    phone = coalesce(p_phone, profiles.phone)
  returning * into result;
  return result;
end;
$$;

create function round_start(p_user uuid, p_seed bigint, p_stale_seconds int)
returns table (round_id uuid, seed bigint)
language plpgsql security definer set search_path = public as $$
declare
  left_now int;
begin
  if not campaign_is_open() then
    raise exception 'campaign_closed';
  end if;

  -- The row lock makes two simultaneous starts take turns.
  select attempts_left into left_now from profiles where id = p_user for update;
  if not found then
    raise exception 'no_profile';
  end if;

  -- A closed tab must not lock the player out for the rest of the campaign.
  update rounds set status = 'rejected', reject_reason = 'abandoned'
  where user_id = p_user and status = 'started'
    and started_at < now() - make_interval(secs => p_stale_seconds);

  if exists (select 1 from rounds where user_id = p_user and status = 'started') then
    raise exception 'round_in_progress';
  end if;
  if left_now <= 0 then
    raise exception 'no_attempts';
  end if;

  update profiles set attempts_left = attempts_left - 1 where id = p_user;
  return query
    insert into rounds (user_id, seed) values (p_user, p_seed)
    returning rounds.id, rounds.seed;
end;
$$;

create function round_reject(p_round uuid, p_reason text) returns void
language sql security definer set search_path = public as $$
  update rounds set status = 'rejected', reject_reason = p_reason, finished_at = now()
  where id = p_round and status = 'started'
$$;

create function round_finish(
  p_round uuid, p_user uuid, p_shot_log jsonb, p_client_score int, p_score int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  player profiles;
  v_code text;
  v_expires timestamptz;
begin
  -- Serialises everything for this player, so parallel finishes cannot both win.
  perform 1 from profiles where id = p_user for update;

  update rounds set
    status = 'finished', finished_at = now(), shot_log = p_shot_log,
    client_score = p_client_score, server_score = p_score
  where id = p_round and user_id = p_user and status = 'started';
  if not found then
    raise exception 'round_not_started';
  end if;

  update profiles set best_score = greatest(best_score, p_score), last_score = p_score
  where id = p_user returning * into player;

  select coupon_code, expires_at into v_code, v_expires from rewards where user_id = p_user;

  if v_code is null and p_score >= config_text('heads')::int then
    select c.code into v_code from coupons c
    where c.campaign = config_text('campaign') and c.assigned_to is null
    order by c.code limit 1
    for update skip locked;

    if v_code is null then
      raise warning 'coupon pool empty, user % won without a coupon', p_user;
    else
      v_expires := now() + make_interval(days => config_text('reward_valid_days')::int);
      update coupons set assigned_to = p_user, assigned_at = now(), expires_at = v_expires
      where code = v_code;
      insert into rewards (user_id, round_id, coupon_code, expires_at)
      values (p_user, p_round, v_code, v_expires);
    end if;
  end if;

  return jsonb_build_object(
    'score', p_score,
    'best', player.best_score,
    'attemptsLeft', player.attempts_left,
    'reward', case when v_code is null then null
      else jsonb_build_object('code', v_code, 'expiresAt', v_expires) end
  );
end;
$$;

create function rate_limit_hit(p_user uuid, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  count_now int;
begin
  insert into rate_limits as r (user_id, window_start, hits)
  values (p_user, date_trunc('minute', now()), 1)
  on conflict (user_id) do update set
    hits = case when r.window_start = excluded.window_start then r.hits + 1 else 1 end,
    window_start = excluded.window_start
  returning hits into count_now;
  return count_now <= p_limit;
end;
$$;

revoke all on function session_upsert, round_start, round_reject, round_finish, rate_limit_hit
  from public, anon, authenticated;
grant execute on function session_upsert, round_start, round_reject, round_finish, rate_limit_hit
  to service_role;
