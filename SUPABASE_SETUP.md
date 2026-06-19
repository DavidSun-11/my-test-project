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
