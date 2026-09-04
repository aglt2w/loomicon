-- ============================================================
-- Loomicon 后台 + 公开端：Supabase 初始化脚本
-- ============================================================
-- 用法：
--   1. 在 https://supabase.com 新建一个项目
--   2. SQL Editor 里粘贴本文件全部内容并 Run
--   3. 在 Settings -> API 拷贝 Project URL 和 anon key
--   4. 项目根目录的 js/config.js 里填上 URL 和 key
--   5. 执行下面的「步骤 1：写入密码哈希」前，先用 docs/SUPABASE_SETUP.md
--      里的命令把 SHA-256 算出来再替换占位符
-- ============================================================

-- ============ 0. 启用扩展（gen_random_uuid 需要） ============
create extension if not exists pgcrypto with schema extensions;

-- ============ 1. 数据表 ============

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_locked boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.icons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  svg text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 应用设置（两个密码的 SHA-256 哈希存这里）
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- ============ 2. 索引 ============
create index if not exists idx_icons_category_id on public.icons(category_id);
create index if not exists idx_icons_sort_order on public.icons(sort_order);
create index if not exists idx_categories_sort_order on public.categories(sort_order);

-- ============ 3. 启用 RLS ============
alter table public.categories enable row level security;
alter table public.icons     enable row level security;
alter table public.app_settings enable row level security;

-- ============ 4. 公开读策略（anon 角色可读） ============
drop policy if exists "anon read categories"  on public.categories;
drop policy if exists "anon read icons"      on public.icons;
drop policy if exists "anon read app_settings" on public.app_settings;

create policy "anon read categories"
  on public.categories for select to anon using (true);

create policy "anon read icons"
  on public.icons for select to anon using (true);

create policy "anon read app_settings"
  on public.app_settings for select to anon using (true);

-- 写入通过 SECURITY DEFINER 函数完成，anon 角色没有直接 INSERT/UPDATE/DELETE 权限
-- （即使前端拿到 anon key，也写不进去）

-- ============ 5. 触发器：icons updated_at 自动维护 ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_icons_touch on public.icons;
create trigger trg_icons_touch
  before update on public.icons
  for each row execute function public.touch_updated_at();

-- ============ 6. 管理员操作函数（SECURITY DEFINER 绕过 RLS） ============
-- 前端调用：
--   supabase.rpc('admin_action', { password: '...', action: 'create_icon', payload: {...} })
-- 注意：这里 password 是明文，但只在 HTTPS 上传输，且 Supabase 自身隔离数据库直连；
-- 数据库里只存 SHA-256 哈希，明文不会被持久化。
create or replace function public.admin_action(
  password text,
  action   text,
  payload  jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
  new_id      uuid;
  result      jsonb;
begin
  select value into stored_hash
    from public.app_settings
   where key = 'admin_password_hash';

  if stored_hash is null
     or encode(digest(coalesce(password,''), 'sha256'), 'hex') <> stored_hash then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if action = 'create_category' then
    insert into public.categories(name, slug, is_locked, sort_order)
    values (
      payload->>'name',
      payload->>'slug',
      coalesce((payload->>'is_locked')::boolean, false),
      coalesce((payload->>'sort_order')::int, 0)
    )
    returning id into new_id;
    result := jsonb_build_object('id', new_id);

  elsif action = 'update_category' then
    update public.categories
       set name       = payload->>'name',
           slug       = payload->>'slug',
           is_locked  = coalesce((payload->>'is_locked')::boolean, is_locked),
           sort_order = coalesce((payload->>'sort_order')::int, sort_order)
     where id = (payload->>'id')::uuid;
    result := jsonb_build_object('ok', true);

  elsif action = 'delete_category' then
    delete from public.categories where id = (payload->>'id')::uuid;
    result := jsonb_build_object('ok', true);

  elsif action = 'toggle_lock' then
    update public.categories
       set is_locked = (payload->>'is_locked')::boolean
     where id = (payload->>'id')::uuid;
    result := jsonb_build_object('ok', true);

  elsif action = 'create_icon' then
    insert into public.icons(name, category_id, svg, sort_order)
    values (
      payload->>'name',
      (payload->>'category_id')::uuid,
      payload->>'svg',
      coalesce((payload->>'sort_order')::int, 0)
    )
    returning id into new_id;
    result := jsonb_build_object('id', new_id);

  elsif action = 'update_icon' then
    update public.icons
       set name        = payload->>'name',
           category_id = (payload->>'category_id')::uuid,
           svg         = payload->>'svg',
           sort_order  = coalesce((payload->>'sort_order')::int, sort_order)
     where id = (payload->>'id')::uuid;
    result := jsonb_build_object('ok', true);

  elsif action = 'delete_icon' then
    delete from public.icons where id = (payload->>'id')::uuid;
    result := jsonb_build_object('ok', true);

  elsif action = 'change_password' then
    -- 修改管理员密码：payload.new_password 传明文，本函数做哈希后入库
    update public.app_settings
       set value = encode(digest(payload->>'new_password', 'sha256'), 'hex'),
           updated_at = now()
     where key = 'admin_password_hash';
    result := jsonb_build_object('ok', true);

  elsif action = 'change_unlock_password' then
    update public.app_settings
       set value = encode(digest(payload->>'new_password', 'sha256'), 'hex'),
           updated_at = now()
     where key = 'unlock_password_hash';
    result := jsonb_build_object('ok', true);

  else
    raise exception 'unknown action: %', action using errcode = '22023';
  end if;

  return coalesce(result, '{"ok": true}'::jsonb);
end;
$$;

-- 允许 anon 角色调用这个 RPC（验证逻辑在函数内部）
grant execute on function public.admin_action(text, text, jsonb) to anon;

-- ============ 7. 初始密码哈希（请先修改再执行！） ============
-- 默认 unlock 密码：loomicon12345   -> SHA-256:
--   3b601d221d3b3976c3bc89acc4860f36c469916073c8581657f4dc7179f8c05d
-- 默认 admin  密码：loomicon-admin  -> SHA-256:
--   26a464dfda1e6696428fb2158dcbd33c4c05d41bbe0cd0be7142f019c6de505d
-- 想改密码：用 docs/SUPABASE_SETUP.md 里的命令算好 hash，再覆盖下面两行。
-- 已建过同名 key 时：会 on conflict 更新值（多次执行幂等）。
insert into public.app_settings(key, value) values
  ('unlock_password_hash', '3b601d221d3b3976c3bc89acc4860f36c469916073c8581657f4dc7179f8c05d'),
  ('admin_password_hash',  '26a464dfda1e6696428fb2158dcbd33c4c05d41bbe0cd0be7142f019c6de505d')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- ============ 8. 初始分类（可选，方便你新建项目时直接有结构） ============
insert into public.categories(name, slug, is_locked, sort_order) values
  ('全部图标', 'all',  false, 0),
  ('基础图标', 'basic', false, 1),
  ('服装品类', 'clothing', false, 2),
  ('功能标识', 'function', false, 3),
  ('LOGO', 'logo', true, 4),
  ('OMC表情', 'omc',  true, 5)
on conflict (slug) do nothing;

-- ============================================================
-- 完。执行后到 Table Editor 看 categories / icons / app_settings 是否就位。
-- ============================================================