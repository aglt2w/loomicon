// ============================================================
// Loomicon 配置文件（不提交到 git）
// ============================================================
// 复制本文件为 js/config.local.js，把下面三个占位符替换成你自己的值，
// 然后在 index.html 和 admin.html 里把 script src 改成 config.local.js。
// 或者直接编辑本文件并加入 .gitignore。
// ============================================================

const LOOMICON_CONFIG = {
  // Supabase 项目地址（Settings -> API -> Project URL）
  SUPABASE_URL: 'https://YOUR-PROJECT-ID.supabase.co',

  // Supabase 公开 anon key（Settings -> API -> Project API keys -> anon public）
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',

  // 公开端「解锁密码」（用户输入密码后可见 logo / omc 表情分类）
  // 默认：loomicon12345
  UNLOCK_PASSWORD: 'loomicon12345',

  // 后台管理员密码（admin.html 登录用）
  // 默认：admin / 完整默认 loomicon-admin
  ADMIN_PASSWORD: 'loomicon-admin',

  // 版本号（方便排查缓存）
  VERSION: '1.0.0',
};

// 不导出，纯前端使用
window.LOOMICON_CONFIG = LOOMICON_CONFIG;