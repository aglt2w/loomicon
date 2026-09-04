// ============================================================
// Loomicon 配置模板
// ============================================================
// 复制本文件为 js/config.js，填入你自己的 Supabase 项目信息。
// config.js 可以安全提交到 git：anon key 是公开密钥，数据安全
// 由 RLS + admin_action RPC 的密码校验保证，密码只存在数据库里。
// ============================================================

const LOOMICON_CONFIG = {
  // Supabase 项目地址（Settings -> API -> Project URL）
  SUPABASE_URL: 'https://YOUR-PROJECT-ID.supabase.co',

  // Supabase 公开密钥（Settings -> API -> API keys -> Publishable key）
  SUPABASE_ANON_KEY: 'YOUR-PUBLISHABLE-KEY',

  // 版本号（方便排查缓存）
  VERSION: '1.0.0',
};

window.LOOMICON_CONFIG = LOOMICON_CONFIG;
