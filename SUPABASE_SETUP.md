# Supabase 在线老板评价配置说明

本项目部署在 GitHub Pages，不需要自建 Node 后端。老板评价使用 Supabase Auth + Supabase Database。

当前线上前端已经使用 Supabase Publishable key：

```text
Project URL: https://btkmovuusgazlwgjubkv.supabase.co
Publishable key: 已写入 assets/supabase-config.js
```

Publishable key 可以放在前端页面中使用。绝对不要把 `secret key` 或 Supabase `service role` 权限密钥放进前端，也不要提交任何私密密钥。

## 1. Supabase 后台必须完成的配置

1. 打开 Supabase Project。
2. 确认 `Project Settings -> API` 中的 Project URL 与 `assets/supabase-config.js` 一致。
3. 确认前端只使用 Publishable key / anon public key。
4. 创建 `boss_reviews` 表。
5. 开启 RLS。
6. 添加权限策略。

## 2. 前端配置文件

线上使用：

```js
window.SUPABASE_URL = "https://btkmovuusgazlwgjubkv.supabase.co";
window.SUPABASE_ANON_KEY = "你的 Publishable key";
```

示例文件仍保留在：

```text
assets/supabase-config.example.js
```

如果以后更换 Supabase 项目，只需要更新：

```text
assets/supabase-config.js
```

安全要求：

- 前端只允许使用 Publishable key / anon public key。
- 不要使用 secret key。
- 不要使用 Supabase service role 权限密钥。
- 必须开启 RLS，并通过策略限制写入权限。

## 3. 创建 boss_reviews 表

在 Supabase 后台打开 `SQL Editor`，执行：

```sql
create table if not exists public.boss_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) <= 20),
  service_type text not null,
  rating int not null check (rating between 1 and 5),
  message text not null check (char_length(message) <= 300),
  created_at timestamp with time zone default now()
);
```

## 4. 开启 RLS

```sql
alter table public.boss_reviews enable row level security;
```

## 5. 添加权限策略

所有人可以读取评价：

```sql
create policy "Anyone can read boss reviews"
on public.boss_reviews
for select
using (true);
```

登录用户可以新增自己的评价：

```sql
create policy "Authenticated users can insert own reviews"
on public.boss_reviews
for insert
to authenticated
with check (auth.uid() = user_id);
```

用户只能修改自己的评价：

```sql
create policy "Users can update own reviews"
on public.boss_reviews
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

用户只能删除自己的评价：

```sql
create policy "Users can delete own reviews"
on public.boss_reviews
for delete
to authenticated
using (auth.uid() = user_id);
```

第一版页面只实现：

- 查看评价
- 注册/登录
- 发布评价
- 退出登录

编辑/删除策略先保留，页面暂不提供编辑/删除按钮。

## 6. Auth 邮箱验证

如果 Supabase 开启了邮箱验证，用户注册后可能不会立即登录。页面会提示：

```text
注册成功。如果没有立即登录，请先到邮箱完成验证哦。
```

可以在 Supabase 后台的 `Authentication -> Providers -> Email` 中调整邮箱验证设置。

## 7. Boss review likes and comments

Run this SQL in Supabase SQL Editor to enable likes and comments for `price.html`.

The SQL is repeatable: tables and indexes use `if not exists`, and policies are dropped before being recreated.

```sql
create table if not exists public.boss_review_likes (
  review_id uuid not null references public.boss_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  primary key (review_id, user_id)
);

create index if not exists boss_review_likes_review_id_idx
on public.boss_review_likes (review_id);

create index if not exists boss_review_likes_user_id_idx
on public.boss_review_likes (user_id);

alter table public.boss_review_likes enable row level security;

drop policy if exists "Anyone can read boss review likes" on public.boss_review_likes;
create policy "Anyone can read boss review likes"
on public.boss_review_likes
for select
using (true);

drop policy if exists "Authenticated users can insert own boss review likes" on public.boss_review_likes;
create policy "Authenticated users can insert own boss review likes"
on public.boss_review_likes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own boss review likes" on public.boss_review_likes;
create policy "Users can delete own boss review likes"
on public.boss_review_likes
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.boss_review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.boss_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) <= 20),
  message text not null check (char_length(message) <= 120),
  created_at timestamp with time zone default now()
);

create index if not exists boss_review_comments_review_id_idx
on public.boss_review_comments (review_id);

create index if not exists boss_review_comments_created_at_idx
on public.boss_review_comments (created_at);

alter table public.boss_review_comments enable row level security;

drop policy if exists "Anyone can read boss review comments" on public.boss_review_comments;
create policy "Anyone can read boss review comments"
on public.boss_review_comments
for select
using (true);

drop policy if exists "Authenticated users can insert own boss review comments" on public.boss_review_comments;
create policy "Authenticated users can insert own boss review comments"
on public.boss_review_comments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own boss review comments" on public.boss_review_comments;
create policy "Users can update own boss review comments"
on public.boss_review_comments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own boss review comments" on public.boss_review_comments;
create policy "Users can delete own boss review comments"
on public.boss_review_comments
for delete
to authenticated
using (auth.uid() = user_id);
```

The first page version only supports reading, liking/unliking, and posting comments. Update/delete policies are kept for future expansion, but the page does not show edit/delete buttons.

## 8. 直播互动：评分竞猜

Run this SQL in Supabase SQL Editor to enable the shared `直播互动 -> 评分竞猜` feature.

This feature uses Supabase Auth + Database shared data. It does not use localStorage for public vote results. The SQL is repeatable: tables and indexes use `if not exists`, and policies are dropped before being recreated.

```sql
create table if not exists public.live_interaction_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.live_score_guess_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default '评分竞猜',
  status text not null check (status in ('open','closed')) default 'open',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index if not exists one_open_live_score_guess
on public.live_score_guess_sessions(status)
where status = 'open';

create table if not exists public.live_score_guess_votes (
  session_id uuid not null references public.live_score_guess_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('铜牌','银牌','金牌','顶级','无')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists live_score_guess_votes_session_id_idx
on public.live_score_guess_votes (session_id);

create index if not exists live_score_guess_votes_choice_idx
on public.live_score_guess_votes (choice);

create or replace function public.set_live_score_guess_vote_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_live_score_guess_vote_updated_at on public.live_score_guess_votes;
create trigger set_live_score_guess_vote_updated_at
before update on public.live_score_guess_votes
for each row
execute function public.set_live_score_guess_vote_updated_at();

alter table public.live_interaction_admins enable row level security;
alter table public.live_score_guess_sessions enable row level security;
alter table public.live_score_guess_votes enable row level security;

drop policy if exists "Users can read own live interaction admin row" on public.live_interaction_admins;
create policy "Users can read own live interaction admin row"
on public.live_interaction_admins
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Anyone can read live score guess sessions" on public.live_score_guess_sessions;
create policy "Anyone can read live score guess sessions"
on public.live_score_guess_sessions
for select
using (true);

drop policy if exists "Only live interaction admins can create score guess sessions" on public.live_score_guess_sessions;
create policy "Only live interaction admins can create score guess sessions"
on public.live_score_guess_sessions
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.live_interaction_admins
    where user_id = auth.uid()
  )
);

drop policy if exists "Only live interaction admins can close score guess sessions" on public.live_score_guess_sessions;
create policy "Only live interaction admins can close score guess sessions"
on public.live_score_guess_sessions
for update
to authenticated
using (
  status = 'open'
  and exists (
    select 1
    from public.live_interaction_admins
    where user_id = auth.uid()
  )
)
with check (
  status = 'closed'
  and exists (
    select 1
    from public.live_interaction_admins
    where user_id = auth.uid()
  )
);

drop policy if exists "Anyone can read live score guess votes" on public.live_score_guess_votes;
create policy "Anyone can read live score guess votes"
on public.live_score_guess_votes
for select
using (true);

drop policy if exists "Authenticated users can insert own open score guess votes" on public.live_score_guess_votes;
create policy "Authenticated users can insert own open score guess votes"
on public.live_score_guess_votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.live_score_guess_sessions
    where id = session_id
      and status = 'open'
  )
);

drop policy if exists "Authenticated users can update own open score guess votes" on public.live_score_guess_votes;
create policy "Authenticated users can update own open score guess votes"
on public.live_score_guess_votes
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.live_score_guess_sessions
    where id = session_id
      and status = 'open'
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.live_score_guess_sessions
    where id = session_id
      and status = 'open'
  )
);

insert into public.live_interaction_admins (user_id)
select id from auth.users
where email = 'davidsun@ulsee.ai'
on conflict do nothing;
```

Notes:

- You must run this SQL manually in Supabase SQL Editor.
- Do not put a Supabase secret key or service role key into frontend files.
- Row level security (RLS) is required. The frontend hides admin controls for normal users, but RLS is the real permission boundary.
- Realtime should be enabled for `live_score_guess_sessions` and `live_score_guess_votes` if you want live updates across viewers.

## 9. 直播互动：评分竞猜管理员投票名单升级 SQL

Run this SQL in Supabase SQL Editor after section 8 if you want the admin-only voter list shown after a score guess session ends.

The function is intentionally narrow: it only returns `choice`, `voter_name`, and `created_at`; it does not expose full email, `user_id`, or full UUID values, and it does not query `auth.users`.

```sql
drop function if exists public.get_live_score_guess_voters(uuid);

create or replace function public.get_live_score_guess_voters(p_session_id uuid)
returns table (
  choice text,
  voter_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.live_interaction_admins admin
    where admin.user_id = auth.uid()
  ) then
    raise exception 'not allowed';
  end if;

  return query
  select
    vote.choice,
    '老板用户' as voter_name,
    vote.created_at
  from public.live_score_guess_votes vote
  where vote.session_id = p_session_id
  order by
    case vote.choice
      when '铜牌' then 1
      when '银牌' then 2
      when '金牌' then 3
      when '顶级' then 4
      when '无' then 5
      else 6
    end,
    vote.created_at asc;
end;
$$;

revoke all on function public.get_live_score_guess_voters(uuid) from public;
grant execute on function public.get_live_score_guess_voters(uuid) to authenticated;
```

## 10. 老板账号昵称与评分竞猜投票名单显示昵称升级 SQL

Run this SQL manually in Supabase SQL Editor after sections 8 and 9.

This upgrade stores a safe boss display name in `public.boss_profiles` and updates the admin-only score guess voter RPC to return that nickname. The RPC still returns only `choice`, `voter_name`, and `created_at`; it does not return email, `user_id`, or full UUID values, and the frontend must not query `auth.users`.

```sql
create table if not exists public.boss_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.boss_profiles
  add column if not exists display_name text;

alter table public.boss_profiles
  add column if not exists created_at timestamptz not null default now();

alter table public.boss_profiles
  add column if not exists updated_at timestamptz not null default now();

update public.boss_profiles
set display_name = '老板用户'
where display_name is null
   or trim(display_name) = '';

alter table public.boss_profiles
  alter column display_name set not null;

alter table public.boss_profiles
  drop constraint if exists boss_profiles_display_name_length;

alter table public.boss_profiles
  add constraint boss_profiles_display_name_length
  check (char_length(trim(display_name)) between 1 and 20);

alter table public.boss_profiles enable row level security;

revoke all on public.boss_profiles from anon;
grant select, insert, update on public.boss_profiles to authenticated;

drop policy if exists "Boss profiles can select own row" on public.boss_profiles;
create policy "Boss profiles can select own row"
on public.boss_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Boss profiles can insert own row" on public.boss_profiles;
create policy "Boss profiles can insert own row"
on public.boss_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Boss profiles can update own row" on public.boss_profiles;
create policy "Boss profiles can update own row"
on public.boss_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.set_boss_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_boss_profiles_updated_at on public.boss_profiles;
create trigger set_boss_profiles_updated_at
before update on public.boss_profiles
for each row
execute function public.set_boss_profiles_updated_at();

create or replace function public.sync_boss_profile_from_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_display_name text;
begin
  safe_display_name := left(trim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'nickname',
    ''
  )), 20);

  if safe_display_name is null or safe_display_name = '' then
    return new;
  end if;

  insert into public.boss_profiles (user_id, display_name)
  values (new.id, safe_display_name)
  on conflict (user_id) do update
  set
    display_name = excluded.display_name,
    updated_at = now()
  where public.boss_profiles.display_name is null
     or trim(public.boss_profiles.display_name) = '';

  return new;
end;
$$;

drop trigger if exists sync_boss_profile_from_auth_metadata on auth.users;
create trigger sync_boss_profile_from_auth_metadata
after insert or update of raw_user_meta_data on auth.users
for each row
execute function public.sync_boss_profile_from_auth_metadata();

drop function if exists public.get_live_score_guess_voters(uuid);

create or replace function public.get_live_score_guess_voters(p_session_id uuid)
returns table (
  choice text,
  voter_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.live_interaction_admins admin
    where admin.user_id = auth.uid()
  ) then
    raise exception 'not allowed';
  end if;

  return query
  select
    vote.choice,
    coalesce(nullif(trim(profile.display_name), ''), '老板用户') as voter_name,
    vote.created_at
  from public.live_score_guess_votes vote
  left join public.boss_profiles profile
    on profile.user_id = vote.user_id
  where vote.session_id = p_session_id
  order by
    case vote.choice
      when '铜牌' then 1
      when '银牌' then 2
      when '金牌' then 3
      when '顶级' then 4
      when '无' then 5
      else 6
    end,
    vote.created_at asc;
end;
$$;

revoke all on function public.get_live_score_guess_voters(uuid) from public;
grant execute on function public.get_live_score_guess_voters(uuid) to authenticated;
```

## 11. 老板昵称管理升级 SQL

Run this SQL manually in Supabase SQL Editor if you want bosses to edit their own display name after registration. It is safe to run repeatedly after sections 3, 8, 9, and 10.

This upgrade keeps the permission boundary in RLS: each logged-in user can only read and update their own `boss_profiles` row, and the frontend still must not query `auth.users`. It also confirms that users can update only their own `boss_reviews` rows, which lets the nickname manager softly sync old review nicknames after a display name change.

```sql
create table if not exists public.boss_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.boss_profiles
  add column if not exists display_name text;

alter table public.boss_profiles
  add column if not exists created_at timestamptz not null default now();

alter table public.boss_profiles
  add column if not exists updated_at timestamptz not null default now();

update public.boss_profiles
set display_name = '老板用户'
where display_name is null
   or trim(display_name) = '';

alter table public.boss_profiles
  alter column display_name set not null;

alter table public.boss_profiles
  drop constraint if exists boss_profiles_display_name_length;

alter table public.boss_profiles
  add constraint boss_profiles_display_name_length
  check (char_length(trim(display_name)) between 1 and 20);

alter table public.boss_profiles enable row level security;

revoke all on public.boss_profiles from anon;
grant select, insert, update on public.boss_profiles to authenticated;

drop policy if exists "Boss profiles can select own row" on public.boss_profiles;
create policy "Boss profiles can select own row"
on public.boss_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Boss profiles can insert own row" on public.boss_profiles;
create policy "Boss profiles can insert own row"
on public.boss_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Boss profiles can update own row" on public.boss_profiles;
create policy "Boss profiles can update own row"
on public.boss_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.set_boss_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_boss_profiles_updated_at on public.boss_profiles;
create trigger set_boss_profiles_updated_at
before update on public.boss_profiles
for each row
execute function public.set_boss_profiles_updated_at();

alter table public.boss_reviews enable row level security;
grant update on public.boss_reviews to authenticated;

drop policy if exists "Users can update own reviews" on public.boss_reviews;
create policy "Users can update own reviews"
on public.boss_reviews
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop function if exists public.get_live_score_guess_voters(uuid);

create or replace function public.get_live_score_guess_voters(p_session_id uuid)
returns table (
  choice text,
  voter_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.live_interaction_admins admin
    where admin.user_id = auth.uid()
  ) then
    raise exception 'not allowed';
  end if;

  return query
  select
    vote.choice,
    coalesce(nullif(trim(profile.display_name), ''), '老板用户') as voter_name,
    vote.created_at
  from public.live_score_guess_votes vote
  left join public.boss_profiles profile
    on profile.user_id = vote.user_id
  where vote.session_id = p_session_id
  order by
    case vote.choice
      when '铜牌' then 1
      when '银牌' then 2
      when '金牌' then 3
      when '顶级' then 4
      when '无' then 5
      else 6
    end,
    vote.created_at asc;
end;
$$;

revoke all on function public.get_live_score_guess_voters(uuid) from public;
grant execute on function public.get_live_score_guess_voters(uuid) to authenticated;
```

## 12. Live2D 每日签到与老板积分升级 SQL

Run this SQL manually in Supabase SQL Editor if you want to enable the Live2D star lake check-in feature. It is safe to run repeatedly after the boss account SQL sections.

This upgrade stores check-in points without exposing email, `user_id`, or full UUID values to the frontend. Users can only read their own rows. Check-in writes and point changes must go through the RPC functions.

Rules:

- Normal check-in: 10 points.
- Current streak day 7 only: 20 points. Day 14, 21, and 28 do not trigger this rule.
- Current Asia/Shanghai natural month day 30: 50 points. This is not historical total day 30 or streak day 30.
- Priority: monthly day 30, then streak day 7, then normal.

```sql
create table if not exists public.boss_points (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0,
  total_checkins integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_checkin_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boss_points_points_nonnegative check (points >= 0),
  constraint boss_points_total_checkins_nonnegative check (total_checkins >= 0),
  constraint boss_points_current_streak_nonnegative check (current_streak >= 0),
  constraint boss_points_longest_streak_nonnegative check (longest_streak >= 0)
);

alter table public.boss_points
  add column if not exists current_streak integer not null default 0;

alter table public.boss_points
  add column if not exists longest_streak integer not null default 0;

alter table public.boss_points
  add column if not exists last_checkin_date date;

alter table public.boss_points
  add column if not exists created_at timestamptz not null default now();

alter table public.boss_points
  add column if not exists updated_at timestamptz not null default now();

alter table public.boss_points
  drop constraint if exists boss_points_points_nonnegative;
alter table public.boss_points
  add constraint boss_points_points_nonnegative check (points >= 0);

alter table public.boss_points
  drop constraint if exists boss_points_total_checkins_nonnegative;
alter table public.boss_points
  add constraint boss_points_total_checkins_nonnegative check (total_checkins >= 0);

alter table public.boss_points
  drop constraint if exists boss_points_current_streak_nonnegative;
alter table public.boss_points
  add constraint boss_points_current_streak_nonnegative check (current_streak >= 0);

alter table public.boss_points
  drop constraint if exists boss_points_longest_streak_nonnegative;
alter table public.boss_points
  add constraint boss_points_longest_streak_nonnegative check (longest_streak >= 0);

create table if not exists public.boss_daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sign_date date not null,
  reward_points integer not null,
  streak_after integer not null,
  monthly_checkins_after integer not null,
  total_checkins_after integer not null,
  created_at timestamptz not null default now(),
  constraint boss_daily_checkins_reward_positive check (reward_points > 0),
  constraint boss_daily_checkins_streak_positive check (streak_after > 0),
  constraint boss_daily_checkins_monthly_positive check (monthly_checkins_after > 0),
  constraint boss_daily_checkins_total_positive check (total_checkins_after > 0),
  constraint boss_daily_checkins_user_date_unique unique (user_id, sign_date)
);

alter table public.boss_daily_checkins
  add column if not exists reward_points integer;

alter table public.boss_daily_checkins
  add column if not exists streak_after integer;

alter table public.boss_daily_checkins
  add column if not exists monthly_checkins_after integer;

alter table public.boss_daily_checkins
  add column if not exists total_checkins_after integer;

alter table public.boss_daily_checkins
  alter column reward_points set not null;

alter table public.boss_daily_checkins
  alter column streak_after set not null;

alter table public.boss_daily_checkins
  alter column monthly_checkins_after set not null;

alter table public.boss_daily_checkins
  alter column total_checkins_after set not null;

alter table public.boss_daily_checkins
  drop constraint if exists boss_daily_checkins_reward_positive;
alter table public.boss_daily_checkins
  add constraint boss_daily_checkins_reward_positive check (reward_points > 0);

alter table public.boss_daily_checkins
  drop constraint if exists boss_daily_checkins_streak_positive;
alter table public.boss_daily_checkins
  add constraint boss_daily_checkins_streak_positive check (streak_after > 0);

alter table public.boss_daily_checkins
  drop constraint if exists boss_daily_checkins_monthly_positive;
alter table public.boss_daily_checkins
  add constraint boss_daily_checkins_monthly_positive check (monthly_checkins_after > 0);

alter table public.boss_daily_checkins
  drop constraint if exists boss_daily_checkins_total_positive;
alter table public.boss_daily_checkins
  add constraint boss_daily_checkins_total_positive check (total_checkins_after > 0);

alter table public.boss_daily_checkins
  drop constraint if exists boss_daily_checkins_user_date_unique;
alter table public.boss_daily_checkins
  add constraint boss_daily_checkins_user_date_unique unique (user_id, sign_date);

create index if not exists boss_daily_checkins_user_sign_date_idx
on public.boss_daily_checkins (user_id, sign_date);

create index if not exists boss_daily_checkins_sign_date_idx
on public.boss_daily_checkins (sign_date);

alter table public.boss_points enable row level security;
alter table public.boss_daily_checkins enable row level security;

revoke all on public.boss_points from anon, authenticated;
revoke all on public.boss_daily_checkins from anon, authenticated;

grant select on public.boss_points to authenticated;
grant select on public.boss_daily_checkins to authenticated;

drop policy if exists "Boss points can select own row" on public.boss_points;
create policy "Boss points can select own row"
on public.boss_points
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Boss daily checkins can select own rows" on public.boss_daily_checkins;
create policy "Boss daily checkins can select own rows"
on public.boss_daily_checkins
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.set_boss_points_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_boss_points_updated_at on public.boss_points;
create trigger set_boss_points_updated_at
before update on public.boss_points
for each row
execute function public.set_boss_points_updated_at();

drop function if exists public.get_boss_checkin_status(date);

create or replace function public.get_boss_checkin_status(p_month date default null)
returns table (
  today_signed boolean,
  today_date date,
  month_start date,
  total_points integer,
  total_checkins integer,
  current_streak integer,
  monthly_checkins integer,
  signed_dates date[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_month_start date := date_trunc('month', coalesce(p_month, (now() at time zone 'Asia/Shanghai')::date))::date;
  v_month_end date := (date_trunc('month', coalesce(p_month, (now() at time zone 'Asia/Shanghai')::date)) + interval '1 month')::date;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  return query
  select
    exists (
      select 1
      from public.boss_daily_checkins checkin
      where checkin.user_id = v_user_id
        and checkin.sign_date = v_today
    ) as today_signed,
    v_today as today_date,
    v_month_start as month_start,
    coalesce(points.points, 0) as total_points,
    coalesce(points.total_checkins, 0) as total_checkins,
    coalesce(points.current_streak, 0) as current_streak,
    (
      select count(*)::integer
      from public.boss_daily_checkins checkin
      where checkin.user_id = v_user_id
        and checkin.sign_date >= v_month_start
        and checkin.sign_date < v_month_end
    ) as monthly_checkins,
    coalesce((
      select array_agg(checkin.sign_date order by checkin.sign_date)
      from public.boss_daily_checkins checkin
      where checkin.user_id = v_user_id
        and checkin.sign_date >= v_month_start
        and checkin.sign_date < v_month_end
    ), array[]::date[]) as signed_dates
  from (select 1) seed
  left join public.boss_points points
    on points.user_id = v_user_id;
end;
$$;

drop function if exists public.claim_boss_daily_checkin();

create or replace function public.claim_boss_daily_checkin()
returns table (
  signed_today boolean,
  already_signed boolean,
  sign_date date,
  reward_points integer,
  total_points integer,
  total_checkins integer,
  current_streak integer,
  monthly_checkins integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_month_start date := date_trunc('month', (now() at time zone 'Asia/Shanghai')::date)::date;
  v_month_end date := (date_trunc('month', (now() at time zone 'Asia/Shanghai')::date) + interval '1 month')::date;
  v_points public.boss_points%rowtype;
  v_current_streak_after integer;
  v_monthly_checkins_after integer;
  v_total_checkins_after integer;
  v_reward_points integer;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.boss_points (user_id, points, total_checkins, current_streak, longest_streak, last_checkin_date)
  values (v_user_id, 0, 0, 0, 0, null)
  on conflict (user_id) do nothing;

  select *
  into v_points
  from public.boss_points
  where user_id = v_user_id
  for update;

  if exists (
    select 1
    from public.boss_daily_checkins checkin
    where checkin.user_id = v_user_id
      and checkin.sign_date = v_today
  ) then
    return query
    select
      false as signed_today,
      true as already_signed,
      v_today as sign_date,
      0 as reward_points,
      v_points.points as total_points,
      v_points.total_checkins as total_checkins,
      v_points.current_streak as current_streak,
      (
        select count(*)::integer
        from public.boss_daily_checkins checkin
        where checkin.user_id = v_user_id
          and checkin.sign_date >= v_month_start
          and checkin.sign_date < v_month_end
      ) as monthly_checkins,
      '今天已经签到过啦，明天再来见甘雨吧。' as message;
    return;
  end if;

  if v_points.last_checkin_date = v_today - 1 then
    v_current_streak_after := v_points.current_streak + 1;
  else
    v_current_streak_after := 1;
  end if;

  select count(*)::integer + 1
  into v_monthly_checkins_after
  from public.boss_daily_checkins checkin
  where checkin.user_id = v_user_id
    and checkin.sign_date >= v_month_start
    and checkin.sign_date < v_month_end;

  v_total_checkins_after := v_points.total_checkins + 1;

  if v_monthly_checkins_after = 30 then
    v_reward_points := 50;
  elsif v_current_streak_after = 7 then
    v_reward_points := 20;
  else
    v_reward_points := 10;
  end if;

  begin
    insert into public.boss_daily_checkins (
      user_id,
      sign_date,
      reward_points,
      streak_after,
      monthly_checkins_after,
      total_checkins_after
    )
    values (
      v_user_id,
      v_today,
      v_reward_points,
      v_current_streak_after,
      v_monthly_checkins_after,
      v_total_checkins_after
    );
  exception
    when unique_violation then
      select *
      into v_points
      from public.boss_points
      where user_id = v_user_id
      for update;

      return query
      select
        false as signed_today,
        true as already_signed,
        v_today as sign_date,
        0 as reward_points,
        v_points.points as total_points,
        v_points.total_checkins as total_checkins,
        v_points.current_streak as current_streak,
        (
          select count(*)::integer
          from public.boss_daily_checkins checkin
          where checkin.user_id = v_user_id
            and checkin.sign_date >= v_month_start
            and checkin.sign_date < v_month_end
        ) as monthly_checkins,
        '今天已经签到过啦，明天再来见甘雨吧。' as message;
      return;
  end;

  update public.boss_points
  set
    points = points + v_reward_points,
    total_checkins = v_total_checkins_after,
    current_streak = v_current_streak_after,
    longest_streak = greatest(longest_streak, v_current_streak_after),
    last_checkin_date = v_today,
    updated_at = now()
  where user_id = v_user_id
  returning *
  into v_points;

  return query
  select
    true as signed_today,
    false as already_signed,
    v_today as sign_date,
    v_reward_points as reward_points,
    v_points.points as total_points,
    v_points.total_checkins as total_checkins,
    v_points.current_streak as current_streak,
    v_monthly_checkins_after as monthly_checkins,
    case
      when v_monthly_checkins_after = 30 then '本月累计签到 30 天达成，今日获得 50 积分。'
      when v_current_streak_after = 7 then '连续签到 7 天达成，今日获得 20 积分。'
      else '签到成功，今日获得 10 积分。'
    end as message;
end;
$$;

revoke all on function public.get_boss_checkin_status(date) from public;
revoke all on function public.claim_boss_daily_checkin() from public;
grant execute on function public.get_boss_checkin_status(date) to authenticated;
grant execute on function public.claim_boss_daily_checkin() to authenticated;
```

## 13. 管理员后台与老板账号管理升级 SQL

Run this SQL manually in Supabase SQL Editor to enable `admin.html`.
It is safe to run after Sections 10-12 and keeps the permission boundary in admin-only RPC/RLS. The frontend still uses only the anon/publishable key and must not query `auth.users`.

```sql
create extension if not exists pgcrypto;

create table if not exists public.boss_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.boss_profiles
  add column if not exists admin_ref uuid not null default gen_random_uuid();

create unique index if not exists boss_profiles_admin_ref_key
on public.boss_profiles (admin_ref);

update public.boss_profiles
set admin_ref = gen_random_uuid()
where admin_ref is null;

insert into public.boss_profiles (user_id, display_name)
select
  users.id,
  left(coalesce(
    nullif(trim(users.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(users.raw_user_meta_data->>'nickname'), ''),
    '老板用户'
  ), 20)
from auth.users users
on conflict (user_id) do nothing;

create table if not exists public.boss_account_flags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_blocked boolean not null default false,
  blocked_reason text check (blocked_reason is null or char_length(blocked_reason) <= 120),
  blocked_at timestamptz,
  blocked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boss_visit_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  visit_count integer not null default 0,
  last_seen_at timestamptz,
  last_counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boss_visit_stats_count_nonnegative check (visit_count >= 0)
);

alter table public.boss_visit_stats
  add column if not exists last_counted_at timestamptz;

alter table public.boss_visit_stats
  drop constraint if exists boss_visit_stats_count_nonnegative;
alter table public.boss_visit_stats
  add constraint boss_visit_stats_count_nonnegative check (visit_count >= 0);

create table if not exists public.boss_admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  action_type text not null check (
    action_type in ('add_points', 'block_user', 'unblock_user', 'grant_admin', 'revoke_admin')
  ),
  amount integer,
  reason text check (reason is null or char_length(reason) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists boss_admin_actions_actor_idx
on public.boss_admin_actions (actor_user_id, created_at desc);

create index if not exists boss_admin_actions_target_idx
on public.boss_admin_actions (target_user_id, created_at desc);

alter table public.boss_profiles enable row level security;
alter table public.boss_account_flags enable row level security;
alter table public.boss_visit_stats enable row level security;
alter table public.boss_admin_actions enable row level security;

revoke all on public.boss_account_flags from anon, authenticated;
revoke all on public.boss_visit_stats from anon, authenticated;
revoke all on public.boss_admin_actions from anon, authenticated;

grant select on public.boss_account_flags to authenticated;
grant select on public.boss_visit_stats to authenticated;

drop policy if exists "Boss account flags can select own row" on public.boss_account_flags;
create policy "Boss account flags can select own row"
on public.boss_account_flags
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Boss visit stats can select own row" on public.boss_visit_stats;
create policy "Boss visit stats can select own row"
on public.boss_visit_stats
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.is_live_interaction_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.live_interaction_admins admin
    where admin.user_id = p_user_id
  );
$$;

create or replace function public.is_boss_account_blocked(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select flags.is_blocked
    from public.boss_account_flags flags
    where flags.user_id = p_user_id
  ), false);
$$;

create or replace function public.mask_admin_email(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := trim(coalesce(p_email, ''));
  v_name text;
  v_domain text;
  v_at integer;
begin
  if v_email = '' then
    return '未绑定邮箱';
  end if;

  v_at := position('@' in v_email);
  if v_at <= 1 then
    if char_length(v_email) <= 2 then
      return left(v_email, 1) || '*';
    end if;
    return left(v_email, 1) || repeat('*', greatest(char_length(v_email) - 2, 1)) || right(v_email, 1);
  end if;

  v_name := left(v_email, v_at - 1);
  v_domain := substring(v_email from v_at + 1);

  if v_domain = '' then
    return left(v_name, 1) || '***';
  end if;

  if char_length(v_name) = 1 then
    return v_name || '***@' || v_domain;
  end if;

  return left(v_name, 1) || repeat('*', least(greatest(char_length(v_name) - 2, 2), 6)) || right(v_name, 1) || '@' || v_domain;
end;
$$;

drop function if exists public.get_own_boss_account_flags();
create or replace function public.get_own_boss_account_flags()
returns table (
  is_blocked boolean,
  blocked_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  return query
  select coalesce(flags.is_blocked, false), flags.blocked_reason
  from (select v_user_id as user_id) me
  left join public.boss_account_flags flags
    on flags.user_id = me.user_id;
end;
$$;

drop function if exists public.record_boss_site_visit(text);
create or replace function public.record_boss_site_visit(p_page_path text default null)
returns table (
  counted boolean,
  visit_count integer,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_stats public.boss_visit_stats%rowtype;
  v_counted boolean := false;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.boss_visit_stats (user_id, visit_count, last_seen_at, last_counted_at)
  values (v_user_id, 0, v_now, null)
  on conflict (user_id) do nothing;

  select *
  into v_stats
  from public.boss_visit_stats
  where user_id = v_user_id
  for update;

  if v_stats.last_counted_at is null or v_stats.last_counted_at <= v_now - interval '30 minutes' then
    update public.boss_visit_stats
    set
      visit_count = public.boss_visit_stats.visit_count + 1,
      last_seen_at = v_now,
      last_counted_at = v_now,
      updated_at = v_now
    where user_id = v_user_id
    returning *
    into v_stats;
    v_counted := true;
  else
    update public.boss_visit_stats
    set
      last_seen_at = v_now,
      updated_at = v_now
    where user_id = v_user_id
    returning *
    into v_stats;
  end if;

  return query select v_counted, v_stats.visit_count, v_stats.last_seen_at;
end;
$$;

drop function if exists public.admin_get_boss_users();
create or replace function public.admin_get_boss_users()
returns table (
  boss_ref uuid,
  display_name text,
  email_masked text,
  points integer,
  total_checkins integer,
  current_streak integer,
  monthly_checkins integer,
  visit_count integer,
  last_seen_at timestamptz,
  is_blocked boolean,
  is_admin boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_month_start date := date_trunc('month', (now() at time zone 'Asia/Shanghai')::date)::date;
  v_month_end date := (date_trunc('month', (now() at time zone 'Asia/Shanghai')::date) + interval '1 month')::date;
begin
  if v_actor is null or not public.is_live_interaction_admin(v_actor) then
    raise exception 'not authorized';
  end if;

  return query
  select
    profile.admin_ref as boss_ref,
    coalesce(nullif(trim(profile.display_name), ''), '老板用户') as display_name,
    public.mask_admin_email(auth_user.email) as email_masked,
    coalesce(points.points, 0)::integer as points,
    coalesce(points.total_checkins, 0)::integer as total_checkins,
    coalesce(points.current_streak, 0)::integer as current_streak,
    coalesce((
      select count(*)::integer
      from public.boss_daily_checkins checkin
      where checkin.user_id = profile.user_id
        and checkin.sign_date >= v_month_start
        and checkin.sign_date < v_month_end
    ), 0)::integer as monthly_checkins,
    coalesce(visits.visit_count, 0)::integer as visit_count,
    visits.last_seen_at,
    coalesce(flags.is_blocked, false) as is_blocked,
    exists (
      select 1
      from public.live_interaction_admins admin
      where admin.user_id = profile.user_id
    ) as is_admin,
    profile.created_at
  from public.boss_profiles profile
  left join auth.users auth_user
    on auth_user.id = profile.user_id
  left join public.boss_points points
    on points.user_id = profile.user_id
  left join public.boss_visit_stats visits
    on visits.user_id = profile.user_id
  left join public.boss_account_flags flags
    on flags.user_id = profile.user_id
  order by coalesce(visits.last_seen_at, profile.created_at) desc nulls last, profile.created_at desc;
end;
$$;

drop function if exists public.admin_adjust_boss_points(uuid, integer, text);
create or replace function public.admin_adjust_boss_points(
  p_boss_ref uuid,
  p_amount integer,
  p_reason text default null
)
returns table (
  boss_ref uuid,
  points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
  v_points integer;
  v_reason text := left(trim(coalesce(p_reason, '')), 120);
begin
  if v_actor is null or not public.is_live_interaction_admin(v_actor) then
    raise exception 'not authorized';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 10000 then
    raise exception 'points amount must be between 1 and 10000';
  end if;

  select profile.user_id
  into v_target
  from public.boss_profiles profile
  where profile.admin_ref = p_boss_ref;

  if v_target is null then
    raise exception 'target not found';
  end if;

  insert into public.boss_points (user_id, points, total_checkins, current_streak, longest_streak, last_checkin_date)
  values (v_target, p_amount, 0, 0, 0, null)
  on conflict (user_id) do update
  set points = public.boss_points.points + excluded.points,
      updated_at = now()
  returning public.boss_points.points
  into v_points;

  insert into public.boss_admin_actions (actor_user_id, target_user_id, action_type, amount, reason)
  values (v_actor, v_target, 'add_points', p_amount, nullif(v_reason, ''));

  return query select p_boss_ref, v_points;
end;
$$;

drop function if exists public.admin_set_boss_blocked(uuid, boolean, text);
create or replace function public.admin_set_boss_blocked(
  p_boss_ref uuid,
  p_is_blocked boolean,
  p_reason text default null
)
returns table (
  boss_ref uuid,
  is_blocked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
  v_reason text := left(trim(coalesce(p_reason, '')), 120);
begin
  if v_actor is null or not public.is_live_interaction_admin(v_actor) then
    raise exception 'not authorized';
  end if;

  select profile.user_id
  into v_target
  from public.boss_profiles profile
  where profile.admin_ref = p_boss_ref;

  if v_target is null then
    raise exception 'target not found';
  end if;
  if v_target = v_actor and p_is_blocked then
    raise exception 'cannot block yourself';
  end if;

  insert into public.boss_account_flags (user_id, is_blocked, blocked_reason, blocked_at, blocked_by)
  values (
    v_target,
    coalesce(p_is_blocked, false),
    case when coalesce(p_is_blocked, false) then nullif(v_reason, '') else null end,
    case when coalesce(p_is_blocked, false) then now() else null end,
    case when coalesce(p_is_blocked, false) then v_actor else null end
  )
  on conflict (user_id) do update
  set
    is_blocked = excluded.is_blocked,
    blocked_reason = excluded.blocked_reason,
    blocked_at = excluded.blocked_at,
    blocked_by = excluded.blocked_by,
    updated_at = now();

  insert into public.boss_admin_actions (actor_user_id, target_user_id, action_type, reason)
  values (
    v_actor,
    v_target,
    case when coalesce(p_is_blocked, false) then 'block_user' else 'unblock_user' end,
    nullif(v_reason, '')
  );

  return query select p_boss_ref, coalesce(p_is_blocked, false);
end;
$$;

drop function if exists public.admin_set_live_interaction_admin(uuid, boolean);
create or replace function public.admin_set_live_interaction_admin(
  p_boss_ref uuid,
  p_is_admin boolean
)
returns table (
  boss_ref uuid,
  is_admin boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
  v_admin_count integer;
begin
  if v_actor is null or not public.is_live_interaction_admin(v_actor) then
    raise exception 'not authorized';
  end if;

  select profile.user_id
  into v_target
  from public.boss_profiles profile
  where profile.admin_ref = p_boss_ref;

  if v_target is null then
    raise exception 'target not found';
  end if;

  if coalesce(p_is_admin, false) then
    if public.is_boss_account_blocked(v_target) then
      raise exception 'blocked user cannot be admin';
    end if;

    insert into public.live_interaction_admins (user_id)
    values (v_target)
    on conflict (user_id) do nothing;

    insert into public.boss_admin_actions (actor_user_id, target_user_id, action_type)
    values (v_actor, v_target, 'grant_admin');
  else
    if v_target = v_actor then
      raise exception 'cannot revoke your own admin role';
    end if;

    select count(*)::integer
    into v_admin_count
    from public.live_interaction_admins;

    if v_admin_count <= 1 then
      raise exception 'cannot revoke the last admin';
    end if;

    delete from public.live_interaction_admins
    where user_id = v_target;

    insert into public.boss_admin_actions (actor_user_id, target_user_id, action_type)
    values (v_actor, v_target, 'revoke_admin');
  end if;

  return query select p_boss_ref, coalesce(p_is_admin, false);
end;
$$;

drop policy if exists "Authenticated users can insert own reviews" on public.boss_reviews;
create policy "Authenticated users can insert own reviews"
on public.boss_reviews
for insert
to authenticated
with check (
  auth.uid() = user_id
  and not exists (select 1 from public.boss_account_flags bf where bf.user_id = auth.uid() and bf.is_blocked)
);

drop policy if exists "Authenticated users can insert own boss review likes" on public.boss_review_likes;
create policy "Authenticated users can insert own boss review likes"
on public.boss_review_likes
for insert
to authenticated
with check (
  auth.uid() = user_id
  and not exists (select 1 from public.boss_account_flags bf where bf.user_id = auth.uid() and bf.is_blocked)
);

drop policy if exists "Users can delete own boss review likes" on public.boss_review_likes;
create policy "Users can delete own boss review likes"
on public.boss_review_likes
for delete
to authenticated
using (
  auth.uid() = user_id
  and not exists (select 1 from public.boss_account_flags bf where bf.user_id = auth.uid() and bf.is_blocked)
);

drop policy if exists "Authenticated users can insert own boss review comments" on public.boss_review_comments;
create policy "Authenticated users can insert own boss review comments"
on public.boss_review_comments
for insert
to authenticated
with check (
  auth.uid() = user_id
  and not exists (select 1 from public.boss_account_flags bf where bf.user_id = auth.uid() and bf.is_blocked)
);

drop policy if exists "Users can update own boss review comments" on public.boss_review_comments;
create policy "Users can update own boss review comments"
on public.boss_review_comments
for update
to authenticated
using (
  auth.uid() = user_id
  and not exists (select 1 from public.boss_account_flags bf where bf.user_id = auth.uid() and bf.is_blocked)
)
with check (
  auth.uid() = user_id
  and not exists (select 1 from public.boss_account_flags bf where bf.user_id = auth.uid() and bf.is_blocked)
);

drop policy if exists "Users can delete own boss review comments" on public.boss_review_comments;
create policy "Users can delete own boss review comments"
on public.boss_review_comments
for delete
to authenticated
using (
  auth.uid() = user_id
  and not exists (select 1 from public.boss_account_flags bf where bf.user_id = auth.uid() and bf.is_blocked)
);

drop policy if exists "Authenticated users can insert own open score guess votes" on public.live_score_guess_votes;
create policy "Authenticated users can insert own open score guess votes"
on public.live_score_guess_votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and not exists (select 1 from public.boss_account_flags bf where bf.user_id = auth.uid() and bf.is_blocked)
  and exists (
    select 1
    from public.live_score_guess_sessions session
    where session.id = session_id
      and session.status = 'open'
  )
);

drop policy if exists "Authenticated users can update own open score guess votes" on public.live_score_guess_votes;
create policy "Authenticated users can update own open score guess votes"
on public.live_score_guess_votes
for update
to authenticated
using (
  user_id = auth.uid()
  and not exists (select 1 from public.boss_account_flags bf where bf.user_id = auth.uid() and bf.is_blocked)
  and exists (
    select 1
    from public.live_score_guess_sessions session
    where session.id = session_id
      and session.status = 'open'
  )
)
with check (
  user_id = auth.uid()
  and not exists (select 1 from public.boss_account_flags bf where bf.user_id = auth.uid() and bf.is_blocked)
  and exists (
    select 1
    from public.live_score_guess_sessions session
    where session.id = session_id
      and session.status = 'open'
  )
);

create or replace function public.claim_boss_daily_checkin()
returns table (
  signed_today boolean,
  already_signed boolean,
  sign_date date,
  reward_points integer,
  total_points integer,
  total_checkins integer,
  current_streak integer,
  monthly_checkins integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_month_start date := date_trunc('month', (now() at time zone 'Asia/Shanghai')::date)::date;
  v_month_end date := (date_trunc('month', (now() at time zone 'Asia/Shanghai')::date) + interval '1 month')::date;
  v_points public.boss_points%rowtype;
  v_current_streak_after integer;
  v_monthly_checkins_after integer;
  v_total_checkins_after integer;
  v_reward_points integer;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if public.is_boss_account_blocked(v_user_id) then
    raise exception '当前账号暂时不能参与互动，如有疑问可以联系君雪。';
  end if;

  insert into public.boss_points (user_id, points, total_checkins, current_streak, longest_streak, last_checkin_date)
  values (v_user_id, 0, 0, 0, 0, null)
  on conflict (user_id) do nothing;

  select *
  into v_points
  from public.boss_points
  where user_id = v_user_id
  for update;

  if exists (
    select 1
    from public.boss_daily_checkins checkin
    where checkin.user_id = v_user_id
      and checkin.sign_date = v_today
  ) then
    select count(*)::integer
    into v_monthly_checkins_after
    from public.boss_daily_checkins checkin
    where checkin.user_id = v_user_id
      and checkin.sign_date >= v_month_start
      and checkin.sign_date < v_month_end;

    return query select
      true,
      true,
      v_today,
      0,
      v_points.points,
      v_points.total_checkins,
      v_points.current_streak,
      v_monthly_checkins_after,
      '今天已经签到过啦，明天再来见甘雨吧。'::text;
    return;
  end if;

  if v_points.last_checkin_date = v_today - 1 then
    v_current_streak_after := v_points.current_streak + 1;
  else
    v_current_streak_after := 1;
  end if;

  select count(*)::integer + 1
  into v_monthly_checkins_after
  from public.boss_daily_checkins checkin
  where checkin.user_id = v_user_id
    and checkin.sign_date >= v_month_start
    and checkin.sign_date < v_month_end;

  v_total_checkins_after := v_points.total_checkins + 1;

  if v_monthly_checkins_after = 30 then
    v_reward_points := 50;
  elsif v_current_streak_after = 7 then
    v_reward_points := 20;
  else
    v_reward_points := 10;
  end if;

  begin
    insert into public.boss_daily_checkins (
      user_id,
      sign_date,
      reward_points,
      streak_after,
      monthly_checkins_after,
      total_checkins_after
    )
    values (
      v_user_id,
      v_today,
      v_reward_points,
      v_current_streak_after,
      v_monthly_checkins_after,
      v_total_checkins_after
    );
  exception when unique_violation then
    select *
    into v_points
    from public.boss_points
    where user_id = v_user_id
    for update;

    select count(*)::integer
    into v_monthly_checkins_after
    from public.boss_daily_checkins checkin
    where checkin.user_id = v_user_id
      and checkin.sign_date >= v_month_start
      and checkin.sign_date < v_month_end;

    return query select
      true,
      true,
      v_today,
      0,
      v_points.points,
      v_points.total_checkins,
      v_points.current_streak,
      v_monthly_checkins_after,
      '今天已经签到过啦，明天再来见甘雨吧。'::text;
    return;
  end;

  update public.boss_points
  set
    points = points + v_reward_points,
    total_checkins = v_total_checkins_after,
    current_streak = v_current_streak_after,
    longest_streak = greatest(longest_streak, v_current_streak_after),
    last_checkin_date = v_today,
    updated_at = now()
  where user_id = v_user_id
  returning *
  into v_points;

  return query select
    true,
    false,
    v_today,
    v_reward_points,
    v_points.points,
    v_points.total_checkins,
    v_points.current_streak,
    v_monthly_checkins_after,
    case
      when v_monthly_checkins_after = 30 then '本月累计签到 30 天达成，今日获得 50 积分。'
      when v_current_streak_after = 7 then '连续签到 7 天达成，今日获得 20 积分。'
      else '签到成功，今日获得 10 积分。'
    end as message;
end;
$$;

revoke all on function public.is_live_interaction_admin(uuid) from public;
revoke all on function public.is_boss_account_blocked(uuid) from public;
revoke all on function public.mask_admin_email(text) from public;
revoke all on function public.get_own_boss_account_flags() from public;
revoke all on function public.record_boss_site_visit(text) from public;
revoke all on function public.admin_get_boss_users() from public;
revoke all on function public.admin_adjust_boss_points(uuid, integer, text) from public;
revoke all on function public.admin_set_boss_blocked(uuid, boolean, text) from public;
revoke all on function public.admin_set_live_interaction_admin(uuid, boolean) from public;
revoke all on function public.claim_boss_daily_checkin() from public;

grant execute on function public.get_own_boss_account_flags() to authenticated;
grant execute on function public.record_boss_site_visit(text) to authenticated;
grant execute on function public.admin_get_boss_users() to authenticated;
grant execute on function public.admin_adjust_boss_points(uuid, integer, text) to authenticated;
grant execute on function public.admin_set_boss_blocked(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_live_interaction_admin(uuid, boolean) to authenticated;
grant execute on function public.claim_boss_daily_checkin() to authenticated;
```

## 14. “我的”页面老板头像 Storage 升级 SQL

Run this SQL manually in Supabase SQL Editor to enable cloud avatars for `my.html`.

The frontend still uses only the publishable / anon key. Do not use a service role key in frontend code.

This upgrade:

- Creates a private Supabase Storage bucket named `boss-avatars`.
- Adds `avatar_path` and `avatar_updated_at` to `public.boss_profiles`.
- Allows each authenticated user to read, upload, update, and delete only avatar objects owned by their own auth session.
- Keeps avatar display cross-device by storing the object path in `boss_profiles.avatar_path`.

```sql
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'boss-avatars',
  'boss-avatars',
  false,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.boss_profiles
  add column if not exists avatar_path text;

alter table public.boss_profiles
  add column if not exists avatar_updated_at timestamptz;

drop policy if exists "Boss avatars can select own objects" on storage.objects;
create policy "Boss avatars can select own objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'boss-avatars'
  and owner_id = auth.uid()::text
);

drop policy if exists "Boss avatars can insert own objects" on storage.objects;
create policy "Boss avatars can insert own objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'boss-avatars'
  and owner_id = auth.uid()::text
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists "Boss avatars can update own objects" on storage.objects;
create policy "Boss avatars can update own objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'boss-avatars'
  and owner_id = auth.uid()::text
)
with check (
  bucket_id = 'boss-avatars'
  and owner_id = auth.uid()::text
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists "Boss avatars can delete own objects" on storage.objects;
create policy "Boss avatars can delete own objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'boss-avatars'
  and owner_id = auth.uid()::text
);
```

If you prefer the Supabase Dashboard:

1. Go to **Storage -> New bucket**.
2. Bucket name: `boss-avatars`.
3. Keep it private, not public.
4. Set file size limit to `1 MB`.
5. Allow MIME types: `image/jpeg`, `image/png`, `image/webp`.
6. Then run the `boss_profiles` column SQL and the `storage.objects` policies above.

If this SQL is not executed yet, `my.html` will show:

```text
头像上传功能还需要完成云端配置。
```

## 15. 积分兑换申请升级 SQL

用途：

- 新增老板积分兑换申请表 `boss_point_redemptions`。
- 用户提交兑换申请时不扣积分，状态默认为 `pending`。
- 待审核申请只占用积分兑换页的可兑换额度，不冻结竞猜等其它积分消费；管理员审核时仍按实际积分余额最终判断。
- `cost_points` 由服务端 RPC 根据兑换类型、段位区间、数量重新计算，前端只显示预计值。
- 管理员同意时在同一个 RPC 事务流程内检查积分、扣除积分、更新申请状态。
- 管理员拒绝时不扣积分，只保存状态和批注。
- 管理员权限继续使用 `live_interaction_admins` 判断。

> 2026-07-14 余额强校验：全新部署仍按章节顺序执行。已经执行过第 17 节的现有项目，只需执行本节中从 `drop function if exists public.get_boss_redemption_balance_summary()` 开始，到两个 RPC 的 `grant execute` 结束的连续补丁段；不要单独用第 15 节旧版管理员审核函数覆盖第 17 节最终版本。

请在 Supabase SQL Editor 执行：

```sql
create table if not exists public.boss_point_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  redeem_ref uuid not null default gen_random_uuid(),
  redeem_type text not null,
  rank_range text,
  quantity numeric not null,
  cost_points integer not null,
  user_note text,
  admin_note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null,
  constraint boss_point_redemptions_ref_unique unique (redeem_ref),
  constraint boss_point_redemptions_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint boss_point_redemptions_quantity_check check (quantity > 0 and quantity <= 50 and quantity = trunc(quantity)),
  constraint boss_point_redemptions_cost_check check (cost_points >= 0),
  constraint boss_point_redemptions_user_note_check check (user_note is null or char_length(user_note) <= 300),
  constraint boss_point_redemptions_admin_note_check check (admin_note is null or char_length(admin_note) <= 200)
);

create index if not exists boss_point_redemptions_user_status_idx
on public.boss_point_redemptions (user_id, status, created_at desc);

create index if not exists boss_point_redemptions_status_created_idx
on public.boss_point_redemptions (status, created_at desc);

alter table public.boss_point_redemptions enable row level security;

revoke all on public.boss_point_redemptions from anon, authenticated;

drop policy if exists "Boss redemptions can select own rows" on public.boss_point_redemptions;
create policy "Boss redemptions can select own rows"
on public.boss_point_redemptions
for select
to authenticated
using (user_id = auth.uid());

alter table public.boss_admin_actions
  drop constraint if exists boss_admin_actions_action_type_check;

alter table public.boss_admin_actions
  add constraint boss_admin_actions_action_type_check check (
    action_type in (
      'add_points',
      'block_user',
      'unblock_user',
      'grant_admin',
      'revoke_admin',
      'approve_redemption',
      'reject_redemption'
    )
  );

create or replace function public.calculate_boss_redemption_cost(
  p_redeem_type text,
  p_rank_range text,
  p_quantity numeric
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quantity integer;
  v_unit_cost integer;
begin
  if p_quantity is null or p_quantity <= 0 or p_quantity > 50 or p_quantity <> trunc(p_quantity) then
    raise exception 'quantity must be a positive integer between 1 and 50';
  end if;

  v_quantity := p_quantity::integer;

  if p_redeem_type = 'king_star' then
    v_unit_cost := case p_rank_range
      when 'below_king' then 60
      when 'king_0_50' then 80
      when 'king_50_80' then 120
      when 'king_80_100' then 160
      when 'king_100_plus' then 200
      else null
    end;

    if v_unit_cost is null then
      raise exception 'invalid rank range';
    end if;
  elsif p_redeem_type = 'king_review' then
    v_unit_cost := 500;
  elsif p_redeem_type = 'naraka_companion' then
    v_unit_cost := 350;
  elsif p_redeem_type = 'voice_chat' then
    v_unit_cost := 300;
  else
    raise exception 'invalid redemption type';
  end if;

  return v_unit_cost * v_quantity;
end;
$$;

drop function if exists public.get_boss_redemption_balance_summary();
create function public.get_boss_redemption_balance_summary()
returns table (
  current_points integer,
  pending_reserved_points integer,
  available_points integer,
  pending_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_current_points integer := 0;
  v_pending_reserved_points integer := 0;
  v_pending_count integer := 0;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  select
    coalesce((
      select coalesce(points.points, 0)
      from public.boss_points points
      where points.user_id = v_actor
    ), 0)::integer,
    coalesce(sum(greatest(coalesce(redemption.cost_points, 0), 0)), 0)::integer,
    count(*)::integer
  into
    v_current_points,
    v_pending_reserved_points,
    v_pending_count
  from public.boss_point_redemptions redemption
  where redemption.user_id = v_actor
    and redemption.status = 'pending';

  return query
  select
    coalesce(v_current_points, 0),
    coalesce(v_pending_reserved_points, 0),
    greatest(coalesce(v_current_points, 0) - coalesce(v_pending_reserved_points, 0), 0),
    coalesce(v_pending_count, 0);
end;
$$;

do $$
declare
  v_signature text;
begin
  for v_signature in
    select format(
      '%I.%I(%s)',
      namespace.nspname,
      proc.proname,
      pg_get_function_identity_arguments(proc.oid)
    )
    from pg_proc proc
    join pg_namespace namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'submit_boss_point_redemption'
  loop
    execute 'drop function if exists ' || v_signature;
  end loop;
end;
$$;

create function public.submit_boss_point_redemption(
  p_redeem_type text,
  p_rank_range text,
  p_quantity numeric,
  p_user_note text default null
)
returns table (
  redeem_ref uuid,
  redeem_type text,
  rank_range text,
  quantity numeric,
  cost_points integer,
  status text,
  created_at timestamptz,
  current_points integer,
  pending_reserved_points integer,
  available_points integer,
  pending_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_rank_range text := nullif(trim(coalesce(p_rank_range, '')), '');
  v_user_note text := nullif(trim(coalesce(p_user_note, '')), '');
  v_cost integer;
  v_current_points integer := 0;
  v_pending_reserved_points integer := 0;
  v_available_points integer := 0;
  v_pending_count integer := 0;
  v_redemption public.boss_point_redemptions%rowtype;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if public.is_boss_account_blocked(v_actor) then
    raise exception 'blocked account cannot submit redemption';
  end if;

  if v_user_note is not null and char_length(v_user_note) > 300 then
    raise exception 'user note too long';
  end if;

  if p_redeem_type <> 'king_star' then
    v_rank_range := null;
  end if;

  v_cost := public.calculate_boss_redemption_cost(p_redeem_type, v_rank_range, p_quantity);

  insert into public.boss_points (user_id, points, total_checkins, current_streak, longest_streak, last_checkin_date)
  values (v_actor, 0, 0, 0, 0, null)
  on conflict (user_id) do nothing;

  select coalesce(points.points, 0)::integer
  into v_current_points
  from public.boss_points points
  where points.user_id = v_actor
  for update;

  select
    coalesce(sum(greatest(coalesce(redemption.cost_points, 0), 0)), 0)::integer,
    count(*)::integer
  into
    v_pending_reserved_points,
    v_pending_count
  from public.boss_point_redemptions redemption
  where redemption.user_id = v_actor
    and redemption.status = 'pending';

  if v_pending_count >= 5 then
    raise exception 'pending redemption limit reached';
  end if;

  v_available_points := greatest(coalesce(v_current_points, 0) - coalesce(v_pending_reserved_points, 0), 0);

  if v_available_points < v_cost then
    raise exception '积分不足，无法提交兑换申请。';
  end if;

  insert into public.boss_point_redemptions (
    user_id,
    redeem_type,
    rank_range,
    quantity,
    cost_points,
    user_note
  )
  values (
    v_actor,
    p_redeem_type,
    v_rank_range,
    p_quantity,
    v_cost,
    v_user_note
  )
  returning * into v_redemption;

  select
    coalesce(sum(greatest(coalesce(redemption.cost_points, 0), 0)), 0)::integer,
    count(*)::integer
  into
    v_pending_reserved_points,
    v_pending_count
  from public.boss_point_redemptions redemption
  where redemption.user_id = v_actor
    and redemption.status = 'pending';

  v_available_points := greatest(coalesce(v_current_points, 0) - coalesce(v_pending_reserved_points, 0), 0);

  return query
  select
    v_redemption.redeem_ref,
    v_redemption.redeem_type,
    v_redemption.rank_range,
    v_redemption.quantity,
    v_redemption.cost_points,
    v_redemption.status,
    v_redemption.created_at,
    coalesce(v_current_points, 0),
    coalesce(v_pending_reserved_points, 0),
    v_available_points,
    coalesce(v_pending_count, 0);
end;
$$;

revoke all on function public.get_boss_redemption_balance_summary() from public, anon, authenticated;
revoke all on function public.submit_boss_point_redemption(text, text, numeric, text) from public, anon, authenticated;

grant execute on function public.get_boss_redemption_balance_summary() to authenticated;
grant execute on function public.submit_boss_point_redemption(text, text, numeric, text) to authenticated;

drop function if exists public.get_my_boss_point_redemptions();
create or replace function public.get_my_boss_point_redemptions()
returns table (
  redeem_type text,
  rank_range text,
  quantity numeric,
  cost_points integer,
  user_note text,
  admin_note text,
  status text,
  created_at timestamptz,
  processed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  return query
  select
    redemption.redeem_type,
    redemption.rank_range,
    redemption.quantity,
    redemption.cost_points,
    redemption.user_note,
    redemption.admin_note,
    redemption.status,
    redemption.created_at,
    redemption.processed_at
  from public.boss_point_redemptions redemption
  where redemption.user_id = v_actor
  order by redemption.created_at desc
  limit 50;
end;
$$;

drop function if exists public.admin_get_boss_point_redemptions(text);
create or replace function public.admin_get_boss_point_redemptions(p_status text default null)
returns table (
  redeem_ref uuid,
  display_name text,
  email_masked text,
  redeem_type text,
  rank_range text,
  quantity numeric,
  cost_points integer,
  user_note text,
  admin_note text,
  status text,
  created_at timestamptz,
  processed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text := nullif(trim(coalesce(p_status, '')), '');
begin
  if v_actor is null or not public.is_live_interaction_admin(v_actor) then
    raise exception 'not authorized';
  end if;

  if v_status is not null and v_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid status filter';
  end if;

  return query
  select
    redemption.redeem_ref,
    coalesce(nullif(trim(profile.display_name), ''), '老板用户') as display_name,
    public.mask_admin_email(auth_user.email) as email_masked,
    redemption.redeem_type,
    redemption.rank_range,
    redemption.quantity,
    redemption.cost_points,
    redemption.user_note,
    redemption.admin_note,
    redemption.status,
    redemption.created_at,
    redemption.processed_at
  from public.boss_point_redemptions redemption
  left join public.boss_profiles profile
    on profile.user_id = redemption.user_id
  left join auth.users auth_user
    on auth_user.id = redemption.user_id
  where v_status is null or redemption.status = v_status
  order by
    case redemption.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    redemption.created_at desc
  limit 100;
end;
$$;

drop function if exists public.admin_review_boss_point_redemption(uuid, text, text);
create or replace function public.admin_review_boss_point_redemption(
  p_redeem_ref uuid,
  p_status text,
  p_admin_note text default null
)
returns table (
  redeem_ref uuid,
  status text,
  cost_points integer,
  processed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_redemption public.boss_point_redemptions%rowtype;
  v_points public.boss_points%rowtype;
  v_admin_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_processed_at timestamptz := now();
begin
  if v_actor is null or not public.is_live_interaction_admin(v_actor) then
    raise exception 'not authorized';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'invalid review status';
  end if;

  if v_admin_note is not null and char_length(v_admin_note) > 200 then
    raise exception 'admin note too long';
  end if;

  select *
  into v_redemption
  from public.boss_point_redemptions redemption
  where redemption.redeem_ref = p_redeem_ref
  for update;

  if v_redemption.id is null then
    raise exception 'redemption not found';
  end if;

  if v_redemption.status <> 'pending' then
    raise exception 'redemption already processed';
  end if;

  if p_status = 'approved' then
    insert into public.boss_points (user_id, points, total_checkins, current_streak, longest_streak, last_checkin_date)
    values (v_redemption.user_id, 0, 0, 0, 0, null)
    on conflict (user_id) do nothing;

    select *
    into v_points
    from public.boss_points
    where user_id = v_redemption.user_id
    for update;

    if v_points.points < v_redemption.cost_points then
      raise exception 'insufficient points';
    end if;

    update public.boss_points
    set
      points = points - v_redemption.cost_points,
      updated_at = now()
    where user_id = v_redemption.user_id;
  end if;

  update public.boss_point_redemptions
  set
    status = p_status,
    admin_note = v_admin_note,
    processed_at = v_processed_at,
    processed_by = v_actor
  where id = v_redemption.id;

  insert into public.boss_admin_actions (actor_user_id, target_user_id, action_type, amount, reason)
  values (
    v_actor,
    v_redemption.user_id,
    case when p_status = 'approved' then 'approve_redemption' else 'reject_redemption' end,
    case when p_status = 'approved' then -v_redemption.cost_points else null end,
    nullif(left(coalesce(v_admin_note, ''), 120), '')
  );

  return query
  select
    v_redemption.redeem_ref,
    p_status,
    v_redemption.cost_points,
    v_processed_at;
end;
$$;

revoke all on function public.calculate_boss_redemption_cost(text, text, numeric) from public;
revoke all on function public.get_my_boss_point_redemptions() from public;
revoke all on function public.admin_get_boss_point_redemptions(text) from public;
revoke all on function public.admin_review_boss_point_redemption(uuid, text, text) from public;

grant execute on function public.get_my_boss_point_redemptions() to authenticated;
grant execute on function public.admin_get_boss_point_redemptions(text) to authenticated;
grant execute on function public.admin_review_boss_point_redemption(uuid, text, text) to authenticated;
```

## 16. 评分竞猜积分奖池升级 SQL

Run this SQL manually in Supabase SQL Editor after Section 8. It is safe to run repeatedly. If Section 12 has not been executed yet, this section creates the compatible `boss_points` foundation needed for staking and balance checks.

This upgrade keeps old score guess votes compatible: existing rows get `staked_points = 0`, so they still count as people/votes in public stats but do not enter jackpot settlement. Ordinary users should not directly read `live_score_guess_votes` detail after this upgrade; public stats and personal settlement use RPC only.

```sql
create extension if not exists pgcrypto;

create table if not exists public.boss_points (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0,
  total_checkins integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_checkin_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boss_points_points_nonnegative check (points >= 0),
  constraint boss_points_total_checkins_nonnegative check (total_checkins >= 0),
  constraint boss_points_current_streak_nonnegative check (current_streak >= 0),
  constraint boss_points_longest_streak_nonnegative check (longest_streak >= 0)
);

alter table public.boss_points
  add column if not exists points integer not null default 0;
alter table public.boss_points
  add column if not exists total_checkins integer not null default 0;
alter table public.boss_points
  add column if not exists current_streak integer not null default 0;
alter table public.boss_points
  add column if not exists longest_streak integer not null default 0;
alter table public.boss_points
  add column if not exists last_checkin_date date;
alter table public.boss_points
  add column if not exists created_at timestamptz not null default now();
alter table public.boss_points
  add column if not exists updated_at timestamptz not null default now();

alter table public.boss_points
  drop constraint if exists boss_points_points_nonnegative;
alter table public.boss_points
  add constraint boss_points_points_nonnegative check (points >= 0);
alter table public.boss_points
  drop constraint if exists boss_points_total_checkins_nonnegative;
alter table public.boss_points
  add constraint boss_points_total_checkins_nonnegative check (total_checkins >= 0);
alter table public.boss_points
  drop constraint if exists boss_points_current_streak_nonnegative;
alter table public.boss_points
  add constraint boss_points_current_streak_nonnegative check (current_streak >= 0);
alter table public.boss_points
  drop constraint if exists boss_points_longest_streak_nonnegative;
alter table public.boss_points
  add constraint boss_points_longest_streak_nonnegative check (longest_streak >= 0);

alter table public.live_score_guess_sessions
  add column if not exists correct_choice text;
alter table public.live_score_guess_sessions
  add column if not exists settled_at timestamptz;
alter table public.live_score_guess_sessions
  add column if not exists settled_by uuid references auth.users(id) on delete set null;
alter table public.live_score_guess_sessions
  add column if not exists settlement_status text not null default 'pending';
alter table public.live_score_guess_sessions
  add column if not exists total_losing_pool integer not null default 0;
alter table public.live_score_guess_sessions
  add column if not exists total_winning_stake integer not null default 0;

alter table public.live_score_guess_sessions
  drop constraint if exists live_score_guess_sessions_correct_choice_check;
alter table public.live_score_guess_sessions
  add constraint live_score_guess_sessions_correct_choice_check
  check (correct_choice is null or correct_choice in ('铜牌','银牌','金牌','顶级','无'));

alter table public.live_score_guess_sessions
  drop constraint if exists live_score_guess_sessions_settlement_status_check;
alter table public.live_score_guess_sessions
  add constraint live_score_guess_sessions_settlement_status_check
  check (settlement_status in ('pending','settled','no_winner'));

alter table public.live_score_guess_sessions
  drop constraint if exists live_score_guess_sessions_pool_nonnegative;
alter table public.live_score_guess_sessions
  add constraint live_score_guess_sessions_pool_nonnegative
  check (total_losing_pool >= 0 and total_winning_stake >= 0);

alter table public.live_score_guess_votes
  add column if not exists staked_points integer not null default 0;
alter table public.live_score_guess_votes
  add column if not exists settled_points integer not null default 0;
alter table public.live_score_guess_votes
  add column if not exists settlement_bonus integer not null default 0;
alter table public.live_score_guess_votes
  add column if not exists is_correct boolean;
alter table public.live_score_guess_votes
  add column if not exists settled_at timestamptz;

update public.live_score_guess_votes
set staked_points = 0
where staked_points is null;

alter table public.live_score_guess_votes
  drop constraint if exists live_score_guess_votes_staked_points_check;
alter table public.live_score_guess_votes
  add constraint live_score_guess_votes_staked_points_check
  check (staked_points >= 0 and staked_points <= 10000);

alter table public.live_score_guess_votes
  drop constraint if exists live_score_guess_votes_settlement_points_check;
alter table public.live_score_guess_votes
  add constraint live_score_guess_votes_settlement_points_check
  check (settled_points >= 0 and settlement_bonus >= 0);

create table if not exists public.live_score_guess_point_ledger (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_score_guess_sessions(id) on delete cascade,
  vote_user_id uuid references auth.users(id) on delete set null,
  admin_user_id uuid references auth.users(id) on delete set null,
  amount integer not null check (amount >= 0),
  direction text not null check (direction in ('debit','credit','neutral')),
  reason text not null check (reason in (
    'stake_debit',
    'change_vote_refund',
    'settlement_principal',
    'settlement_bonus',
    'no_winner_pool'
  )),
  balance_after integer,
  created_at timestamptz not null default now()
);

create index if not exists live_score_guess_point_ledger_session_idx
on public.live_score_guess_point_ledger (session_id, created_at desc);

create index if not exists live_score_guess_point_ledger_vote_user_idx
on public.live_score_guess_point_ledger (vote_user_id, created_at desc);

alter table public.live_score_guess_point_ledger enable row level security;
revoke all on public.live_score_guess_point_ledger from anon, authenticated;

drop policy if exists "Anyone can read live score guess votes" on public.live_score_guess_votes;
drop policy if exists "Authenticated users can insert own open score guess votes" on public.live_score_guess_votes;
drop policy if exists "Authenticated users can update own open score guess votes" on public.live_score_guess_votes;
drop policy if exists "Only admins can read live score guess votes" on public.live_score_guess_votes;

drop function if exists public.get_live_score_guess_voters(uuid);

revoke select, insert, update, delete on public.live_score_guess_votes from anon, authenticated;

create policy "Only admins can read live score guess votes"
on public.live_score_guess_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.live_interaction_admins admin
    where admin.user_id = auth.uid()
  )
);

create or replace function public.is_live_score_guess_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.live_interaction_admins admin
    where admin.user_id = auth.uid()
  );
$$;

drop function if exists public.get_live_score_guess_public_stats(uuid);
create or replace function public.get_live_score_guess_public_stats(p_session_id uuid)
returns table (
  choice text,
  vote_count integer,
  total_staked_points integer
)
language sql
security definer
set search_path = public
as $$
  with choices(choice) as (
    values ('铜牌'), ('银牌'), ('金牌'), ('顶级'), ('无')
  )
  select
    choices.choice,
    count(vote.user_id)::integer as vote_count,
    coalesce(sum(case when vote.staked_points > 0 then vote.staked_points else 0 end), 0)::integer as total_staked_points
  from choices
  left join public.live_score_guess_votes vote
    on vote.session_id = p_session_id
   and vote.choice = choices.choice
  group by choices.choice
  order by case choices.choice
    when '铜牌' then 1
    when '银牌' then 2
    when '金牌' then 3
    when '顶级' then 4
    else 5
  end;
$$;

drop function if exists public.get_live_score_guess_my_settlement(uuid);
create or replace function public.get_live_score_guess_my_settlement(p_session_id uuid)
returns table (
  choice text,
  staked_points integer,
  settled_points integer,
  settlement_bonus integer,
  is_correct boolean,
  correct_choice text,
  settlement_status text,
  current_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.boss_points (user_id, points)
  values (v_user_id, 0)
  on conflict (user_id) do nothing;

  return query
  select
    vote.choice,
    coalesce(vote.staked_points, 0),
    coalesce(vote.settled_points, 0),
    coalesce(vote.settlement_bonus, 0),
    vote.is_correct,
    session.correct_choice,
    coalesce(session.settlement_status, 'pending'),
    coalesce(points.points, 0)
  from public.live_score_guess_sessions session
  left join public.live_score_guess_votes vote
    on vote.session_id = session.id
   and vote.user_id = v_user_id
  left join public.boss_points points
    on points.user_id = v_user_id
  where session.id = p_session_id
  limit 1;
end;
$$;

drop function if exists public.place_live_score_guess_vote_with_points(uuid, text, integer);
create or replace function public.place_live_score_guess_vote_with_points(
  p_session_id uuid,
  p_choice text,
  p_staked_points integer
)
returns table (
  choice text,
  staked_points integer,
  current_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.live_score_guess_sessions%rowtype;
  v_points public.boss_points%rowtype;
  v_old_vote public.live_score_guess_votes%rowtype;
  v_blocked boolean := false;
  v_available integer := 0;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_choice not in ('铜牌','银牌','金牌','顶级','无') then
    raise exception 'invalid choice';
  end if;

  if p_staked_points is null or p_staked_points < 1 or p_staked_points > 10000 then
    raise exception 'invalid staked points';
  end if;

  if to_regclass('public.boss_account_flags') is not null then
    execute 'select exists (select 1 from public.boss_account_flags where user_id = $1 and is_blocked)'
    into v_blocked
    using v_user_id;

    if v_blocked then
      raise exception 'blocked account';
    end if;
  end if;

  select *
  into v_session
  from public.live_score_guess_sessions session
  where session.id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'score guess session not found';
  end if;

  if v_session.status <> 'open' then
    raise exception 'score guess session is closed';
  end if;

  if coalesce(v_session.settlement_status, 'pending') <> 'pending' then
    raise exception 'score guess already settled';
  end if;

  insert into public.boss_points (user_id, points)
  values (v_user_id, 0)
  on conflict (user_id) do nothing;

  select *
  into v_points
  from public.boss_points points
  where points.user_id = v_user_id
  for update;

  select *
  into v_old_vote
  from public.live_score_guess_votes vote
  where vote.session_id = p_session_id
    and vote.user_id = v_user_id
  for update;

  v_available := v_points.points + coalesce(v_old_vote.staked_points, 0);

  if v_available < p_staked_points then
    raise exception 'insufficient points';
  end if;

  if coalesce(v_old_vote.staked_points, 0) > 0 then
    update public.boss_points
    set points = points + v_old_vote.staked_points,
        updated_at = now()
    where user_id = v_user_id
    returning *
    into v_points;

    insert into public.live_score_guess_point_ledger (
      session_id,
      vote_user_id,
      amount,
      direction,
      reason,
      balance_after
    )
    values (
      p_session_id,
      v_user_id,
      v_old_vote.staked_points,
      'credit',
      'change_vote_refund',
      v_points.points
    );
  end if;

  update public.boss_points
  set points = points - p_staked_points,
      updated_at = now()
  where user_id = v_user_id
  returning *
  into v_points;

  insert into public.live_score_guess_point_ledger (
    session_id,
    vote_user_id,
    amount,
    direction,
    reason,
    balance_after
  )
  values (
    p_session_id,
    v_user_id,
    p_staked_points,
    'debit',
    'stake_debit',
    v_points.points
  );

  insert into public.live_score_guess_votes (
    session_id,
    user_id,
    choice,
    staked_points,
    settled_points,
    settlement_bonus,
    is_correct,
    settled_at
  )
  values (
    p_session_id,
    v_user_id,
    p_choice,
    p_staked_points,
    0,
    0,
    null,
    null
  )
  on conflict (session_id, user_id) do update
  set choice = excluded.choice,
      staked_points = excluded.staked_points,
      settled_points = 0,
      settlement_bonus = 0,
      is_correct = null,
      settled_at = null,
      updated_at = now();

  return query
  select p_choice, p_staked_points, v_points.points;
end;
$$;

drop function if exists public.admin_start_live_score_guess_session();
create or replace function public.admin_start_live_score_guess_session()
returns table (
  session_id uuid,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.live_score_guess_sessions%rowtype;
begin
  if v_actor is null or not public.is_live_score_guess_admin() then
    raise exception 'not authorized';
  end if;

  if exists (
    select 1
    from public.live_score_guess_sessions session
    where session.status = 'open'
  ) then
    raise exception 'open session already exists';
  end if;

  insert into public.live_score_guess_sessions (title, status, created_by, settlement_status)
  values ('评分竞猜', 'open', v_actor, 'pending')
  returning *
  into v_session;

  return query
  select v_session.id, v_session.status, v_session.created_at;
end;
$$;

drop function if exists public.admin_close_live_score_guess_session(uuid);
create or replace function public.admin_close_live_score_guess_session(p_session_id uuid)
returns table (
  session_id uuid,
  status text,
  ended_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.live_score_guess_sessions%rowtype;
begin
  if v_actor is null or not public.is_live_score_guess_admin() then
    raise exception 'not authorized';
  end if;

  select *
  into v_session
  from public.live_score_guess_sessions session
  where session.id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'score guess session not found';
  end if;

  if v_session.status <> 'open' then
    raise exception 'score guess session is not open';
  end if;

  update public.live_score_guess_sessions
  set status = 'closed',
      ended_at = now()
  where id = p_session_id
  returning *
  into v_session;

  return query
  select v_session.id, v_session.status, v_session.ended_at;
end;
$$;

drop function if exists public.admin_get_live_score_guess_settlement(uuid);
create or replace function public.admin_get_live_score_guess_settlement(p_session_id uuid)
returns table (
  vote_ref text,
  display_name text,
  choice text,
  staked_points integer,
  is_correct boolean,
  settled_points integer,
  settlement_bonus integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_live_score_guess_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    left(md5(vote.session_id::text || vote.user_id::text), 8) as vote_ref,
    coalesce(profile.display_name, '星湖用户') as display_name,
    vote.choice,
    coalesce(vote.staked_points, 0) as staked_points,
    vote.is_correct,
    coalesce(vote.settled_points, 0) as settled_points,
    coalesce(vote.settlement_bonus, 0) as settlement_bonus,
    vote.created_at,
    vote.updated_at
  from public.live_score_guess_votes vote
  left join public.boss_profiles profile
    on profile.user_id = vote.user_id
  where vote.session_id = p_session_id
  order by vote.created_at asc;
end;
$$;

drop function if exists public.admin_set_live_score_guess_result(uuid, text);
create or replace function public.admin_set_live_score_guess_result(
  p_session_id uuid,
  p_correct_choice text
)
returns table (
  session_id uuid,
  settlement_status text,
  correct_choice text,
  total_losing_pool integer,
  total_winning_stake integer,
  settled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.live_score_guess_sessions%rowtype;
  v_losing_pool integer := 0;
  v_winning_stake integer := 0;
  v_remainder integer := 0;
  v_settled_at timestamptz := now();
begin
  if v_actor is null or not public.is_live_score_guess_admin() then
    raise exception 'not authorized';
  end if;

  if p_correct_choice not in ('铜牌','银牌','金牌','顶级','无') then
    raise exception 'invalid correct choice';
  end if;

  select *
  into v_session
  from public.live_score_guess_sessions session
  where session.id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'score guess session not found';
  end if;

  if v_session.status <> 'closed' then
    raise exception 'session must be closed before settlement';
  end if;

  if coalesce(v_session.settlement_status, 'pending') <> 'pending' then
    raise exception 'score guess already settled';
  end if;

  select
    coalesce(sum(case when vote.choice <> p_correct_choice and vote.staked_points > 0 then vote.staked_points else 0 end), 0)::integer,
    coalesce(sum(case when vote.choice = p_correct_choice and vote.staked_points > 0 then vote.staked_points else 0 end), 0)::integer
  into v_losing_pool, v_winning_stake
  from public.live_score_guess_votes vote
  where vote.session_id = p_session_id;

  update public.live_score_guess_votes vote
  set is_correct = (vote.choice = p_correct_choice),
      settled_points = 0,
      settlement_bonus = 0,
      settled_at = v_settled_at
  where vote.session_id = p_session_id;

  if v_winning_stake <= 0 then
    update public.live_score_guess_sessions
    set correct_choice = p_correct_choice,
        settlement_status = 'no_winner',
        total_losing_pool = v_losing_pool,
        total_winning_stake = 0,
        settled_at = v_settled_at,
        settled_by = v_actor
    where id = p_session_id
    returning *
    into v_session;

    if v_losing_pool > 0 then
      insert into public.live_score_guess_point_ledger (
        session_id,
        admin_user_id,
        amount,
        direction,
        reason
      )
      values (
        p_session_id,
        v_actor,
        v_losing_pool,
        'neutral',
        'no_winner_pool'
      );
    end if;

    return query
    select v_session.id, v_session.settlement_status, v_session.correct_choice, v_session.total_losing_pool, v_session.total_winning_stake, v_session.settled_at;
    return;
  end if;

  select
    v_losing_pool - coalesce(sum(floor((v_losing_pool::numeric * vote.staked_points::numeric) / v_winning_stake::numeric)::integer), 0)::integer
  into v_remainder
  from public.live_score_guess_votes vote
  where vote.session_id = p_session_id
    and vote.choice = p_correct_choice
    and vote.staked_points > 0;

  with calculated as (
    select
      vote.user_id,
      vote.staked_points,
      floor((v_losing_pool::numeric * vote.staked_points::numeric) / v_winning_stake::numeric)::integer as base_bonus,
      ((v_losing_pool::numeric * vote.staked_points::numeric) / v_winning_stake::numeric)
        - floor((v_losing_pool::numeric * vote.staked_points::numeric) / v_winning_stake::numeric) as fraction_part,
      vote.created_at
    from public.live_score_guess_votes vote
    where vote.session_id = p_session_id
      and vote.choice = p_correct_choice
      and vote.staked_points > 0
  ),
  ranked as (
    select
      calculated.*,
      row_number() over (order by calculated.fraction_part desc, calculated.created_at asc, calculated.user_id asc) as rank_no
    from calculated
  ),
  final_bonus as (
    select
      ranked.user_id,
      ranked.staked_points,
      ranked.base_bonus + case when ranked.rank_no <= v_remainder then 1 else 0 end as bonus_points
    from ranked
  )
  update public.live_score_guess_votes vote
  set settlement_bonus = final_bonus.bonus_points,
      settled_points = final_bonus.staked_points + final_bonus.bonus_points,
      settled_at = v_settled_at
  from final_bonus
  where vote.session_id = p_session_id
    and vote.user_id = final_bonus.user_id;

  insert into public.boss_points (user_id, points)
  select vote.user_id, 0
  from public.live_score_guess_votes vote
  where vote.session_id = p_session_id
    and vote.choice = p_correct_choice
    and vote.staked_points > 0
  on conflict (user_id) do nothing;

  with payouts as (
    select
      vote.user_id,
      vote.staked_points,
      vote.settlement_bonus,
      vote.settled_points
    from public.live_score_guess_votes vote
    where vote.session_id = p_session_id
      and vote.choice = p_correct_choice
      and vote.staked_points > 0
  )
  update public.boss_points points
  set points = points.points + payouts.settled_points,
      updated_at = now()
  from payouts
  where points.user_id = payouts.user_id;

  insert into public.live_score_guess_point_ledger (
    session_id,
    vote_user_id,
    admin_user_id,
    amount,
    direction,
    reason,
    balance_after
  )
  select
    p_session_id,
    vote.user_id,
    v_actor,
    vote.staked_points,
    'credit',
    'settlement_principal',
    points.points
  from public.live_score_guess_votes vote
  join public.boss_points points
    on points.user_id = vote.user_id
  where vote.session_id = p_session_id
    and vote.choice = p_correct_choice
    and vote.staked_points > 0;

  insert into public.live_score_guess_point_ledger (
    session_id,
    vote_user_id,
    admin_user_id,
    amount,
    direction,
    reason,
    balance_after
  )
  select
    p_session_id,
    vote.user_id,
    v_actor,
    vote.settlement_bonus,
    'credit',
    'settlement_bonus',
    points.points
  from public.live_score_guess_votes vote
  join public.boss_points points
    on points.user_id = vote.user_id
  where vote.session_id = p_session_id
    and vote.choice = p_correct_choice
    and vote.staked_points > 0
    and vote.settlement_bonus > 0;

  update public.live_score_guess_sessions
  set correct_choice = p_correct_choice,
      settlement_status = 'settled',
      total_losing_pool = v_losing_pool,
      total_winning_stake = v_winning_stake,
      settled_at = v_settled_at,
      settled_by = v_actor
  where id = p_session_id
  returning *
  into v_session;

  return query
  select v_session.id, v_session.settlement_status, v_session.correct_choice, v_session.total_losing_pool, v_session.total_winning_stake, v_session.settled_at;
end;
$$;

revoke all on function public.is_live_score_guess_admin() from public;
revoke all on function public.get_live_score_guess_public_stats(uuid) from public;
revoke all on function public.get_live_score_guess_my_settlement(uuid) from public;
revoke all on function public.place_live_score_guess_vote_with_points(uuid, text, integer) from public;
revoke all on function public.admin_start_live_score_guess_session() from public;
revoke all on function public.admin_close_live_score_guess_session(uuid) from public;
revoke all on function public.admin_get_live_score_guess_settlement(uuid) from public;
revoke all on function public.admin_set_live_score_guess_result(uuid, text) from public;

grant execute on function public.get_live_score_guess_public_stats(uuid) to anon, authenticated;
grant execute on function public.get_live_score_guess_my_settlement(uuid) to authenticated;
grant execute on function public.place_live_score_guess_vote_with_points(uuid, text, integer) to authenticated;
grant execute on function public.admin_start_live_score_guess_session() to authenticated;
grant execute on function public.admin_close_live_score_guess_session(uuid) to authenticated;
grant execute on function public.admin_get_live_score_guess_settlement(uuid) to authenticated;
grant execute on function public.admin_set_live_score_guess_result(uuid, text) to authenticated;
```

## 17. 服务预约 / 积分兑换券 / 人工转账升级 SQL

用途：

- 新增服务预约表 `boss_paid_orders`，前端展示为“服务预约 / 预约订单”。
- 新增服务兑换券表 `boss_service_vouchers`，兑换券由积分兑换申请审核同意后自动生成。
- 用户预约时可以选择一张可用兑换券；提交后服务端锁定兑换券，避免重复使用。
- 管理员确认、改期、拒绝、取消、完成预约，并手动记录线下转账状态。
- 第一版不接真实支付接口，`payment_provider` 固定为 `manual`。

请在 Supabase SQL Editor 执行。本节建议在第 15 节积分兑换 SQL 之后执行；如果第 15 节尚未执行，兑换券生成功能会缺少来源表和审核 RPC。

```sql
create extension if not exists pgcrypto;

create table if not exists public.boss_service_vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_ref uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_redeem_ref uuid,
  voucher_type text not null,
  voucher_title text not null,
  game_type text,
  service_type text,
  rank_range text,
  quantity numeric,
  value_points integer,
  status text not null default 'available',
  reserved_order_ref uuid,
  used_order_ref uuid,
  admin_note text,
  created_at timestamptz not null default now(),
  reserved_at timestamptz,
  used_at timestamptz,
  expires_at timestamptz,
  constraint boss_service_vouchers_ref_unique unique (voucher_ref),
  constraint boss_service_vouchers_source_unique unique (source_redeem_ref),
  constraint boss_service_vouchers_status_check check (status in ('available', 'reserved', 'used', 'cancelled', 'expired')),
  constraint boss_service_vouchers_quantity_check check (quantity is null or quantity > 0),
  constraint boss_service_vouchers_value_points_check check (value_points is null or value_points >= 0),
  constraint boss_service_vouchers_admin_note_check check (admin_note is null or char_length(admin_note) <= 200)
);

create index if not exists boss_service_vouchers_user_status_idx
on public.boss_service_vouchers (user_id, status, created_at desc);

create index if not exists boss_service_vouchers_reserved_order_idx
on public.boss_service_vouchers (reserved_order_ref);

create table if not exists public.boss_paid_orders (
  id uuid primary key default gen_random_uuid(),
  order_ref uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_type text not null,
  service_type text not null,
  scheduled_date date not null,
  scheduled_time text,
  duration_hours numeric,
  contact_info text,
  user_note text,
  admin_note text,
  order_status text not null default 'pending',
  payment_status text not null default 'unpaid',
  manual_payment_status text not null default 'manual_unpaid',
  payment_provider text not null default 'manual',
  voucher_ref uuid,
  voucher_title text,
  estimated_amount_cents integer,
  final_amount_cents integer,
  paid_at timestamptz,
  payment_note text,
  provider_trade_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null,
  constraint boss_paid_orders_ref_unique unique (order_ref),
  constraint boss_paid_orders_status_check check (order_status in ('pending', 'confirmed', 'need_reschedule', 'rejected', 'completed', 'cancelled')),
  constraint boss_paid_orders_payment_status_check check (payment_status in ('unpaid', 'paid', 'not_required')),
  constraint boss_paid_orders_manual_payment_status_check check (manual_payment_status in ('manual_unpaid', 'manual_paid', 'not_required', 'voucher_reserved', 'voucher_used', 'partial_voucher')),
  constraint boss_paid_orders_payment_provider_check check (payment_provider = 'manual'),
  constraint boss_paid_orders_duration_check check (duration_hours is null or duration_hours > 0),
  constraint boss_paid_orders_estimated_amount_check check (estimated_amount_cents is null or estimated_amount_cents >= 0),
  constraint boss_paid_orders_final_amount_check check (final_amount_cents is null or final_amount_cents >= 0),
  constraint boss_paid_orders_contact_check check (contact_info is null or char_length(contact_info) <= 120),
  constraint boss_paid_orders_user_note_check check (user_note is null or char_length(user_note) <= 300),
  constraint boss_paid_orders_admin_note_check check (admin_note is null or char_length(admin_note) <= 200),
  constraint boss_paid_orders_payment_note_check check (payment_note is null or char_length(payment_note) <= 200)
);

alter table public.boss_paid_orders
  add column if not exists voucher_ref uuid;
alter table public.boss_paid_orders
  add column if not exists voucher_title text;
alter table public.boss_paid_orders
  add column if not exists manual_payment_status text not null default 'manual_unpaid';
alter table public.boss_paid_orders
  add column if not exists payment_provider text not null default 'manual';
alter table public.boss_paid_orders
  add column if not exists paid_at timestamptz;
alter table public.boss_paid_orders
  add column if not exists payment_note text;
alter table public.boss_paid_orders
  add column if not exists provider_trade_no text;

alter table public.boss_paid_orders
  drop constraint if exists boss_paid_orders_status_check;
alter table public.boss_paid_orders
  add constraint boss_paid_orders_status_check check (order_status in ('pending', 'confirmed', 'need_reschedule', 'rejected', 'completed', 'cancelled'));
alter table public.boss_paid_orders
  drop constraint if exists boss_paid_orders_manual_payment_status_check;
alter table public.boss_paid_orders
  add constraint boss_paid_orders_manual_payment_status_check check (manual_payment_status in ('manual_unpaid', 'manual_paid', 'not_required', 'voucher_reserved', 'voucher_used', 'partial_voucher'));
alter table public.boss_paid_orders
  drop constraint if exists boss_paid_orders_payment_provider_check;
alter table public.boss_paid_orders
  add constraint boss_paid_orders_payment_provider_check check (payment_provider = 'manual');

create index if not exists boss_paid_orders_user_status_idx
on public.boss_paid_orders (user_id, order_status, created_at desc);

create index if not exists boss_paid_orders_status_created_idx
on public.boss_paid_orders (order_status, created_at desc);

create index if not exists boss_paid_orders_voucher_ref_idx
on public.boss_paid_orders (voucher_ref);

alter table public.boss_service_vouchers enable row level security;
alter table public.boss_paid_orders enable row level security;

revoke all on public.boss_service_vouchers from anon, authenticated;
revoke all on public.boss_paid_orders from anon, authenticated;

create or replace function public.get_boss_service_voucher_title(
  p_redeem_type text,
  p_rank_range text,
  p_quantity numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quantity_text text := trim(to_char(coalesce(p_quantity, 0), 'FM999999990.##'));
begin
  if p_redeem_type = 'king_star' then
    return '王者荣耀 ' || v_quantity_text || ' 颗星兑换券';
  elsif p_redeem_type = 'king_review' then
    return '王者复盘 ' || v_quantity_text || ' 小时兑换券';
  elsif p_redeem_type = 'naraka_companion' then
    return '永劫无间娱乐陪 ' || v_quantity_text || ' 小时兑换券';
  elsif p_redeem_type = 'voice_chat' then
    return '语音聊天 ' || case when p_quantity = 1 then '半小时' else v_quantity_text || ' 个半小时' end || '兑换券';
  end if;

  return '服务兑换券';
end;
$$;

drop function if exists public.create_boss_service_voucher_from_redemption(uuid, uuid, text, text, numeric, integer, text);
create or replace function public.create_boss_service_voucher_from_redemption(
  p_user_id uuid,
  p_redeem_ref uuid,
  p_redeem_type text,
  p_rank_range text,
  p_quantity numeric,
  p_cost_points integer,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher_ref uuid;
  v_game_type text;
  v_service_type text;
  v_title text;
begin
  if p_user_id is null or p_redeem_ref is null then
    raise exception 'redemption not found';
  end if;

  v_game_type := case p_redeem_type
    when 'king_star' then '王者荣耀'
    when 'king_review' then '王者荣耀'
    when 'naraka_companion' then '永劫无间'
    when 'voice_chat' then '其它'
    else '其它'
  end;

  v_service_type := case p_redeem_type
    when 'king_star' then '段位上分'
    when 'king_review' then '复盘'
    when 'naraka_companion' then '娱乐陪玩'
    when 'voice_chat' then '语音聊天'
    else '其它'
  end;

  v_title := public.get_boss_service_voucher_title(p_redeem_type, p_rank_range, p_quantity);

  insert into public.boss_service_vouchers (
    user_id,
    source_redeem_ref,
    voucher_type,
    voucher_title,
    game_type,
    service_type,
    rank_range,
    quantity,
    value_points,
    status,
    admin_note
  )
  values (
    p_user_id,
    p_redeem_ref,
    p_redeem_type,
    v_title,
    v_game_type,
    v_service_type,
    p_rank_range,
    p_quantity,
    p_cost_points,
    'available',
    nullif(left(coalesce(p_admin_note, ''), 200), '')
  )
  on conflict (source_redeem_ref) do update
  set admin_note = coalesce(boss_service_vouchers.admin_note, excluded.admin_note)
  returning voucher_ref into v_voucher_ref;

  return v_voucher_ref;
end;
$$;

create or replace function public.admin_review_boss_point_redemption(
  p_redeem_ref uuid,
  p_status text,
  p_admin_note text default null
)
returns table (
  redeem_ref uuid,
  status text,
  cost_points integer,
  processed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_redemption public.boss_point_redemptions%rowtype;
  v_points public.boss_points%rowtype;
  v_admin_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_processed_at timestamptz := now();
begin
  if v_actor is null or not public.is_live_interaction_admin(v_actor) then
    raise exception 'not authorized';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'invalid review status';
  end if;

  if v_admin_note is not null and char_length(v_admin_note) > 200 then
    raise exception 'admin note too long';
  end if;

  select *
  into v_redemption
  from public.boss_point_redemptions redemption
  where redemption.redeem_ref = p_redeem_ref
  for update;

  if v_redemption.id is null then
    raise exception 'redemption not found';
  end if;

  if v_redemption.status <> 'pending' then
    raise exception 'redemption already processed';
  end if;

  if p_status = 'approved' then
    insert into public.boss_points (user_id, points, total_checkins, current_streak, longest_streak, last_checkin_date)
    values (v_redemption.user_id, 0, 0, 0, 0, null)
    on conflict (user_id) do nothing;

    select *
    into v_points
    from public.boss_points
    where user_id = v_redemption.user_id
    for update;

    if v_points.points < v_redemption.cost_points then
      raise exception 'insufficient points';
    end if;

    update public.boss_points
    set
      points = points - v_redemption.cost_points,
      updated_at = now()
    where user_id = v_redemption.user_id;

    perform public.create_boss_service_voucher_from_redemption(
      v_redemption.user_id,
      v_redemption.redeem_ref,
      v_redemption.redeem_type,
      v_redemption.rank_range,
      v_redemption.quantity,
      v_redemption.cost_points,
      v_admin_note
    );
  end if;

  update public.boss_point_redemptions
  set
    status = p_status,
    admin_note = v_admin_note,
    processed_at = v_processed_at,
    processed_by = v_actor
  where id = v_redemption.id;

  insert into public.boss_admin_actions (actor_user_id, target_user_id, action_type, amount, reason)
  values (
    v_actor,
    v_redemption.user_id,
    case when p_status = 'approved' then 'approve_redemption' else 'reject_redemption' end,
    case when p_status = 'approved' then -v_redemption.cost_points else null end,
    nullif(left(coalesce(v_admin_note, ''), 120), '')
  );

  return query
  select
    v_redemption.redeem_ref,
    p_status,
    v_redemption.cost_points,
    v_processed_at;
end;
$$;

drop function if exists public.get_my_available_service_vouchers();
create or replace function public.get_my_available_service_vouchers()
returns table (
  voucher_ref uuid,
  voucher_title text,
  voucher_type text,
  game_type text,
  service_type text,
  rank_range text,
  quantity numeric,
  value_points integer,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  update public.boss_service_vouchers
  set status = 'expired'
  where user_id = v_actor
    and status = 'available'
    and expires_at is not null
    and expires_at < now();

  return query
  select
    voucher.voucher_ref,
    voucher.voucher_title,
    voucher.voucher_type,
    voucher.game_type,
    voucher.service_type,
    voucher.rank_range,
    voucher.quantity,
    voucher.value_points,
    voucher.status,
    voucher.created_at,
    voucher.expires_at
  from public.boss_service_vouchers voucher
  where voucher.user_id = v_actor
    and voucher.status = 'available'
    and (voucher.expires_at is null or voucher.expires_at >= now())
  order by voucher.created_at desc
  limit 50;
end;
$$;

drop function if exists public.submit_boss_paid_order(text, text, date, text, numeric, text, text, uuid);
create or replace function public.submit_boss_paid_order(
  p_game_type text,
  p_service_type text,
  p_scheduled_date date,
  p_scheduled_time text default null,
  p_duration_hours numeric default null,
  p_contact_info text default null,
  p_user_note text default null,
  p_voucher_ref uuid default null
)
returns table (
  order_ref uuid,
  order_status text,
  manual_payment_status text,
  voucher_ref uuid,
  voucher_title text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_game_type text := nullif(trim(coalesce(p_game_type, '')), '');
  v_service_type text := nullif(trim(coalesce(p_service_type, '')), '');
  v_scheduled_time text := nullif(trim(coalesce(p_scheduled_time, '')), '');
  v_contact_info text := nullif(trim(coalesce(p_contact_info, '')), '');
  v_user_note text := nullif(trim(coalesce(p_user_note, '')), '');
  v_open_count integer;
  v_voucher public.boss_service_vouchers%rowtype;
  v_order_ref uuid := gen_random_uuid();
  v_manual_status text := 'manual_unpaid';
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if public.is_boss_account_blocked(v_actor) then
    raise exception 'blocked account cannot submit order';
  end if;

  if v_game_type not in ('王者荣耀', '永劫无间', '其它') then
    raise exception 'invalid game type';
  end if;

  if v_service_type not in ('段位上分', '娱乐陪玩', '复盘', '语音聊天', '其它') then
    raise exception 'invalid service type';
  end if;

  if p_scheduled_date is null or p_scheduled_date < current_date then
    raise exception 'scheduled date cannot be earlier than today';
  end if;

  if p_duration_hours is null or p_duration_hours <= 0 or p_duration_hours > 24 then
    raise exception 'invalid duration';
  end if;

  if v_contact_info is null then
    raise exception 'contact info is required';
  end if;

  if char_length(v_contact_info) > 120 then
    raise exception 'contact info too long';
  end if;

  if v_user_note is not null and char_length(v_user_note) > 300 then
    raise exception 'user note too long';
  end if;

  select count(*)::integer
  into v_open_count
  from public.boss_paid_orders paid_order
  where paid_order.user_id = v_actor
    and paid_order.order_status in ('pending', 'confirmed', 'need_reschedule');

  if v_open_count >= 10 then
    raise exception 'open order limit reached';
  end if;

  if p_voucher_ref is not null then
    select *
    into v_voucher
    from public.boss_service_vouchers voucher
    where voucher.voucher_ref = p_voucher_ref
    for update;

    if v_voucher.id is null or v_voucher.user_id <> v_actor then
      raise exception 'voucher not found';
    end if;

    if v_voucher.status <> 'available' or (v_voucher.expires_at is not null and v_voucher.expires_at < now()) then
      raise exception 'voucher is not available';
    end if;

    v_manual_status := 'voucher_reserved';
  end if;

  insert into public.boss_paid_orders (
    order_ref,
    user_id,
    game_type,
    service_type,
    scheduled_date,
    scheduled_time,
    duration_hours,
    contact_info,
    user_note,
    order_status,
    payment_status,
    manual_payment_status,
    payment_provider,
    voucher_ref,
    voucher_title
  )
  values (
    v_order_ref,
    v_actor,
    v_game_type,
    v_service_type,
    p_scheduled_date,
    v_scheduled_time,
    p_duration_hours,
    v_contact_info,
    v_user_note,
    'pending',
    'unpaid',
    v_manual_status,
    'manual',
    case when p_voucher_ref is not null then v_voucher.voucher_ref else null end,
    case when p_voucher_ref is not null then v_voucher.voucher_title else null end
  );

  if p_voucher_ref is not null then
    update public.boss_service_vouchers
    set
      status = 'reserved',
      reserved_order_ref = v_order_ref,
      reserved_at = now()
    where id = v_voucher.id;
  end if;

  return query
  select
    paid_order.order_ref,
    paid_order.order_status,
    paid_order.manual_payment_status,
    paid_order.voucher_ref,
    paid_order.voucher_title,
    paid_order.created_at
  from public.boss_paid_orders paid_order
  where paid_order.order_ref = v_order_ref;
end;
$$;

drop function if exists public.get_my_boss_paid_orders();
create or replace function public.get_my_boss_paid_orders()
returns table (
  order_ref uuid,
  game_type text,
  service_type text,
  scheduled_date date,
  scheduled_time text,
  duration_hours numeric,
  contact_info text,
  user_note text,
  admin_note text,
  order_status text,
  manual_payment_status text,
  voucher_title text,
  final_amount_cents integer,
  payment_note text,
  created_at timestamptz,
  processed_at timestamptz,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  return query
  select
    paid_order.order_ref,
    paid_order.game_type,
    paid_order.service_type,
    paid_order.scheduled_date,
    paid_order.scheduled_time,
    paid_order.duration_hours,
    paid_order.contact_info,
    paid_order.user_note,
    paid_order.admin_note,
    paid_order.order_status,
    paid_order.manual_payment_status,
    paid_order.voucher_title,
    paid_order.final_amount_cents,
    paid_order.payment_note,
    paid_order.created_at,
    paid_order.processed_at,
    paid_order.paid_at
  from public.boss_paid_orders paid_order
  where paid_order.user_id = v_actor
  order by paid_order.created_at desc
  limit 50;
end;
$$;

drop function if exists public.admin_get_boss_paid_orders(text);
create or replace function public.admin_get_boss_paid_orders(p_status text default null)
returns table (
  order_ref uuid,
  display_name text,
  email_masked text,
  game_type text,
  service_type text,
  scheduled_date date,
  scheduled_time text,
  duration_hours numeric,
  contact_info text,
  user_note text,
  admin_note text,
  order_status text,
  manual_payment_status text,
  voucher_title text,
  voucher_status text,
  final_amount_cents integer,
  payment_note text,
  created_at timestamptz,
  processed_at timestamptz,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text := nullif(trim(coalesce(p_status, '')), '');
begin
  if v_actor is null or not public.is_live_interaction_admin(v_actor) then
    raise exception 'not authorized';
  end if;

  if v_status is not null and v_status not in ('pending', 'confirmed', 'need_reschedule', 'rejected', 'completed', 'cancelled') then
    raise exception 'invalid order status filter';
  end if;

  return query
  select
    paid_order.order_ref,
    coalesce(nullif(trim(profile.display_name), ''), '星湖用户') as display_name,
    public.mask_admin_email(auth_user.email) as email_masked,
    paid_order.game_type,
    paid_order.service_type,
    paid_order.scheduled_date,
    paid_order.scheduled_time,
    paid_order.duration_hours,
    paid_order.contact_info,
    paid_order.user_note,
    paid_order.admin_note,
    paid_order.order_status,
    paid_order.manual_payment_status,
    paid_order.voucher_title,
    voucher.status as voucher_status,
    paid_order.final_amount_cents,
    paid_order.payment_note,
    paid_order.created_at,
    paid_order.processed_at,
    paid_order.paid_at
  from public.boss_paid_orders paid_order
  left join public.boss_profiles profile
    on profile.user_id = paid_order.user_id
  left join auth.users auth_user
    on auth_user.id = paid_order.user_id
  left join public.boss_service_vouchers voucher
    on voucher.voucher_ref = paid_order.voucher_ref
  where v_status is null or paid_order.order_status = v_status
  order by
    case paid_order.order_status
      when 'pending' then 0
      when 'need_reschedule' then 1
      when 'confirmed' then 2
      when 'rejected' then 3
      when 'cancelled' then 4
      else 5
    end,
    paid_order.created_at desc
  limit 120;
end;
$$;

drop function if exists public.admin_update_boss_paid_order(uuid, text, text, integer, text, text);
create or replace function public.admin_update_boss_paid_order(
  p_order_ref uuid,
  p_order_status text,
  p_admin_note text default null,
  p_final_amount_cents integer default null,
  p_manual_payment_status text default null,
  p_payment_note text default null
)
returns table (
  order_ref uuid,
  order_status text,
  manual_payment_status text,
  voucher_title text,
  processed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.boss_paid_orders%rowtype;
  v_voucher public.boss_service_vouchers%rowtype;
  v_admin_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_payment_note text := nullif(trim(coalesce(p_payment_note, '')), '');
  v_manual_status text := nullif(trim(coalesce(p_manual_payment_status, '')), '');
  v_processed_at timestamptz := now();
begin
  if v_actor is null or not public.is_live_interaction_admin(v_actor) then
    raise exception 'not authorized';
  end if;

  if p_order_status not in ('confirmed', 'need_reschedule', 'rejected', 'completed', 'cancelled') then
    raise exception 'invalid order status';
  end if;

  if v_manual_status is not null and v_manual_status not in ('manual_unpaid', 'manual_paid', 'not_required', 'voucher_reserved', 'voucher_used', 'partial_voucher') then
    raise exception 'invalid manual payment status';
  end if;

  if v_admin_note is not null and char_length(v_admin_note) > 200 then
    raise exception 'admin note too long';
  end if;

  if v_payment_note is not null and char_length(v_payment_note) > 200 then
    raise exception 'payment note too long';
  end if;

  if p_final_amount_cents is not null and p_final_amount_cents < 0 then
    raise exception 'invalid final amount';
  end if;

  if p_order_status = 'need_reschedule' and v_admin_note is null then
    raise exception 'admin note required for reschedule';
  end if;

  select *
  into v_order
  from public.boss_paid_orders paid_order
  where paid_order.order_ref = p_order_ref
  for update;

  if v_order.id is null then
    raise exception 'order not found';
  end if;

  if v_order.order_status in ('rejected', 'completed', 'cancelled') then
    raise exception 'order already finalized';
  end if;

  if v_order.order_status = 'pending' and p_order_status not in ('confirmed', 'need_reschedule', 'rejected', 'cancelled') then
    raise exception 'invalid order transition';
  end if;

  if v_order.order_status = 'need_reschedule' and p_order_status not in ('confirmed', 'cancelled') then
    raise exception 'invalid order transition';
  end if;

  if v_order.order_status = 'confirmed' and p_order_status not in ('completed', 'cancelled') then
    raise exception 'invalid order transition';
  end if;

  if v_order.voucher_ref is not null then
    select *
    into v_voucher
    from public.boss_service_vouchers voucher
    where voucher.voucher_ref = v_order.voucher_ref
    for update;
  end if;

  if p_order_status in ('rejected', 'cancelled') and v_voucher.id is not null and v_voucher.status = 'reserved' then
    update public.boss_service_vouchers
    set status = 'available',
        reserved_order_ref = null,
        reserved_at = null
    where id = v_voucher.id;
  elsif p_order_status = 'completed' and v_voucher.id is not null and v_voucher.status = 'reserved' then
    update public.boss_service_vouchers
    set status = 'used',
        used_order_ref = v_order.order_ref,
        used_at = now()
    where id = v_voucher.id;

    if v_manual_status is null then
      v_manual_status := 'voucher_used';
    end if;
  end if;

  if v_manual_status is null then
    v_manual_status := case
      when p_order_status in ('rejected', 'cancelled') then v_order.manual_payment_status
      when v_order.voucher_ref is not null and p_order_status = 'confirmed' and coalesce(p_final_amount_cents, v_order.final_amount_cents, 0) = 0 then 'not_required'
      when v_order.voucher_ref is not null and p_order_status = 'confirmed' then 'partial_voucher'
      else v_order.manual_payment_status
    end;
  end if;

  update public.boss_paid_orders
  set
    order_status = p_order_status,
    admin_note = v_admin_note,
    final_amount_cents = p_final_amount_cents,
    manual_payment_status = v_manual_status,
    payment_status = case
      when p_order_status in ('rejected', 'cancelled') then 'not_required'
      when v_manual_status in ('manual_paid', 'not_required', 'voucher_used') then 'paid'
      else 'unpaid'
    end,
    payment_provider = 'manual',
    paid_at = case
      when p_order_status not in ('rejected', 'cancelled') and v_manual_status in ('manual_paid', 'not_required', 'voucher_used') then coalesce(paid_at, now())
      else paid_at
    end,
    payment_note = v_payment_note,
    processed_at = v_processed_at,
    processed_by = v_actor,
    updated_at = now()
  where id = v_order.id;

  return query
  select
    paid_order.order_ref,
    paid_order.order_status,
    paid_order.manual_payment_status,
    paid_order.voucher_title,
    paid_order.processed_at
  from public.boss_paid_orders paid_order
  where paid_order.id = v_order.id;
end;
$$;

revoke all on function public.get_boss_service_voucher_title(text, text, numeric) from public;
revoke all on function public.create_boss_service_voucher_from_redemption(uuid, uuid, text, text, numeric, integer, text) from public;
revoke all on function public.get_my_available_service_vouchers() from public;
revoke all on function public.submit_boss_paid_order(text, text, date, text, numeric, text, text, uuid) from public;
revoke all on function public.get_my_boss_paid_orders() from public;
revoke all on function public.admin_get_boss_paid_orders(text) from public;
revoke all on function public.admin_update_boss_paid_order(uuid, text, text, integer, text, text) from public;

grant execute on function public.get_my_available_service_vouchers() to authenticated;
grant execute on function public.submit_boss_paid_order(text, text, date, text, numeric, text, text, uuid) to authenticated;
grant execute on function public.get_my_boss_paid_orders() to authenticated;
grant execute on function public.admin_get_boss_paid_orders(text) to authenticated;
grant execute on function public.admin_update_boss_paid_order(uuid, text, text, integer, text, text) to authenticated;
```
