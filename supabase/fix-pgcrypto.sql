-- ============================================================
-- 修复：admin_action 运行时找不到 pgcrypto 的 digest() 函数
-- 原因：Supabase 把 pgcrypto 装在 extensions schema，
--       而函数的 search_path 只包含 public。
-- 用法：复制本文件全部内容，到 Supabase SQL Editor 里执行一次。
-- ============================================================

alter function public.admin_action(text, text, jsonb)
  set search_path = public, extensions;

-- 验证（应返回一行，不含错误）：
-- select public.admin_action('noop', 'x', '{}'::jsonb); -- 预期报 unauthorized（密码错）说明函数已能运行
