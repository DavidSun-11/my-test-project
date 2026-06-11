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
