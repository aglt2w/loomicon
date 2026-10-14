-- ============================================================
-- 迁移脚本：图标多颜色版本（icon_colors）
-- ============================================================
-- 适用：已经跑过 init.sql 的线上库，需要升级到「图标可挂多个颜色版本」。
--
-- 用法：Supabase 控制台 → SQL Editor → 粘贴本文件全部内容 → Run
--
-- 本脚本做三件事：
--   1. 新建 icon_colors 表（一个图标挂多个颜色版本，每个版本一份完整 SVG）
--   2. 给表加 RLS + anon 只读策略
--   3. 替换 admin_action 函数，新增 4 个颜色动作
-- 不会改动任何已有数据、分类、图标和密码哈希。可重复执行（幂等）。
-- ============================================================

-- ============ 1. 新建表 ============

create table if not exists public.icon_colors (
  id uuid primary key default gen_random_uuid(),
  icon_id uuid not null references public.icons(id) on delete cascade,
  name text not null,                 -- 颜色显示名，如「黑色」
  svg text not null,                  -- 该颜色的完整 SVG 源码
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (icon_id, name)
);

create index if not exists idx_icon_colors_icon on public.icon_colors(icon_id, sort_order);

-- ============ 2. RLS + 公开读 ============

alter table public.icon_colors enable row level security;

drop policy if exists "anon read icon_colors" on public.icon_colors;

create policy "anon read icon_colors"
  on public.icon_colors for select to anon using (true);

-- ============ 3. 替换 admin_action 函数（新增颜色动作） ============

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
  item        jsonb;
  next_sort   int;
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

  elsif action = 'reorder_icons' then
    for item in select * from jsonb_array_elements(payload->'items') loop
      update public.icons
         set category_id = (item->>'category_id')::uuid,
             sort_order  = coalesce((item->>'sort_order')::int, sort_order)
       where id = (item->>'id')::uuid;
    end loop;
    result := jsonb_build_object('ok', true);

  elsif action = 'change_password' then
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

  elsif action = 'create_icon_color' then
    -- 给图标挂一个颜色版本：payload = { icon_id, name, svg, sort_order? }
    -- 注意：PostgreSQL 不允许在 INSERT ... VALUES 中写子查询，
    -- 所以 sort_order 的兜底必须先在变量里算好再插入。
    if payload ? 'sort_order' and (payload->>'sort_order') is not null then
      next_sort := (payload->>'sort_order')::int;
    else
      select coalesce(max(sort_order), -1) + 1 into next_sort
        from public.icon_colors
       where icon_id = (payload->>'icon_id')::uuid;
    end if;

    insert into public.icon_colors(icon_id, name, svg, sort_order)
    values (
      (payload->>'icon_id')::uuid,
      payload->>'name',
      payload->>'svg',
      next_sort
    )
    returning id into new_id;
    result := jsonb_build_object('id', new_id);

  elsif action = 'update_icon_color' then
    update public.icon_colors
       set name       = coalesce(payload->>'name', name),
           svg        = coalesce(payload->>'svg', svg),
           sort_order = coalesce((payload->>'sort_order')::int, sort_order),
           updated_at = now()
     where id = (payload->>'id')::uuid;
    result := jsonb_build_object('ok', true);

  elsif action = 'delete_icon_color' then
    delete from public.icon_colors where id = (payload->>'id')::uuid;
    result := jsonb_build_object('ok', true);

  elsif action = 'reorder_icon_colors' then
    -- 同一图标内颜色顺序批量调整：payload.items = [{ id, sort_order }, ...]
    for item in select * from jsonb_array_elements(payload->'items') loop
      update public.icon_colors
         set sort_order = coalesce((item->>'sort_order')::int, sort_order)
       where id = (item->>'id')::uuid;
    end loop;
    result := jsonb_build_object('ok', true);

  else
    raise exception 'unknown action: %', action using errcode = '22023';
  end if;

  return coalesce(result, '{"ok": true}'::jsonb);
end;
$$;

grant execute on function public.admin_action(text, text, jsonb) to anon;

-- ============================================================
-- 完。接下来到后台「图标管理」编辑某个 LOGO 图标，在弹窗里添加颜色版本即可。
-- ============================================================
