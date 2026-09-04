// ============================================================
// Loomicon 配置
// ============================================================
// 本文件可以安全提交到 git：只包含公开安全的信息。
// - SUPABASE_ANON_KEY 是 publishable key，设计上就是公开的，
//   数据安全由 RLS + admin_action RPC 的密码哈希校验保证。
// - 解锁密码 / 管理员密码只存在数据库里（后台「设置」可修改），
//   前端只发送到 RPC 校验，本文件不存任何密码。
// ============================================================

const LOOMICON_CONFIG = {
  SUPABASE_URL: 'https://yxsnhhnihusiubrvxxmd.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_YrvNIG--Xqx9Ejhayji9iQ_f_pJm-oA',
  VERSION: '1.0.0',
};

window.LOOMICON_CONFIG = LOOMICON_CONFIG;