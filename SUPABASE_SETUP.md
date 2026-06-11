# Supabase 在线老板评价配置说明

本项目部署在 GitHub Pages，不需要自建 Node 后端。老板评价使用 Supabase Auth + Supabase Database。

## 1. 创建 Supabase Project

1. 打开 Supabase 官网并创建一个新 Project。
2. 等待项目初始化完成。
3. 进入项目后台的 `Project Settings`。

## 2. 获取前端配置

在 `Project Settings -> API` 中复制：

- `Project URL`
- `anon public key`

注意：

- 前端只能使用 `anon public key`。
- 不要把 `service_role` key 写进前端。
- 不要把任何私密密钥提交到仓库。

## 3. 配置前端文件

复制示例文件：

```text
assets/supabase-config.example.js
```

另存为：

```text
assets/supabase-config.js
```

然后填入真实配置：

```js
const SUPABASE_URL = "你的 Project URL";
const SUPABASE_ANON_KEY = "你的 anon public key";

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
```

`assets/supabase-config.js` 已加入 `.gitignore`，不要提交真实配置。

## 4. 创建 boss_reviews 表

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

## 5. 开启 RLS

```sql
alter table public.boss_reviews enable row level security;
```

## 6. 添加权限策略

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

## 7. Auth 邮箱验证

如果 Supabase 开启了邮箱验证，用户注册后可能不会立即登录。页面会提示：

```text
注册成功。如果没有立即登录，请先到邮箱完成验证哦。
```

可以在 Supabase 后台的 `Authentication -> Providers -> Email` 中调整邮箱验证设置。
