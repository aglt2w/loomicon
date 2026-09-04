// ============================================================
// Loomicon 数据访问层
// ============================================================
// 通过 window.LOOMICON_DB 调用
// 方法：
//   LOOMICON_DB.init()                -> Promise<boolean>  初始化 client
//   LOOMICON_DB.fetchAll()            -> Promise<{categories, icons}>
//   LOOMICON_DB.fetchUnlockHash()     -> Promise<string>
//   LOOMICON_DB.verifyUnlock(pwd)     -> Promise<boolean>   前端校验解锁密码
//   LOOMICON_DB.verifyAdmin(pwd)      -> Promise<boolean>   前端校验管理员密码
//   LOOMICON_DB.adminAction(pwd, action, payload) -> Promise<any>
//   LOOMICON_DB.isConfigured()        -> boolean            检查 URL / key 是否填好
// ============================================================

(function () {
  const cfg = (window.LOOMICON_CONFIG) || {};
  let client = null;
  let cache = null; // { categories: [], icons: [], ts: 0 }
  const CACHE_TTL = 30 * 1000;

  // SHA-256 hex 工具
  async function sha256Hex(text) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function isConfigured() {
    const url = cfg.SUPABASE_URL || '';
    const key = cfg.SUPABASE_ANON_KEY || '';
    return url.startsWith('https://') && !url.includes('YOUR-PROJECT') && key.length > 20 && !key.includes('YOUR-ANON');
  }

  // 加载 Supabase JS SDK（CDN）
  async function loadSdk() {
    if (window.supabase && window.supabase.createClient) return window.supabase;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return window.supabase;
  }

  async function init() {
    if (!isConfigured()) {
      console.warn('[LOOMICON_DB] Supabase URL / Key 未配置。请填 js/config.js');
      return false;
    }
    const sdk = await loadSdk();
    client = sdk.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    return true;
  }

  function ensure() {
    if (!client) throw new Error('LOOMICON_DB 未初始化，请先调用 init()');
  }

  async function fetchAll(force = false) {
    ensure();
    if (!force && cache && Date.now() - cache.ts < CACHE_TTL) return cache;
    const [{ data: categories, error: e1 }, { data: icons, error: e2 }] = await Promise.all([
      client.from('categories').select('*').order('sort_order', { ascending: true }),
      client.from('icons').select('*').order('sort_order', { ascending: true }),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    cache = { categories: categories || [], icons: icons || [], ts: Date.now() };
    return cache;
  }

  function invalidate() {
    cache = null;
  }

  async function fetchUnlockHash() {
    ensure();
    const { data, error } = await client
      .from('app_settings')
      .select('value')
      .eq('key', 'unlock_password_hash')
      .single();
    if (error) throw error;
    return data && data.value;
  }

  async function fetchAdminHash() {
    ensure();
    const { data, error } = await client
      .from('app_settings')
      .select('value')
      .eq('key', 'admin_password_hash')
      .single();
    if (error) throw error;
    return data && data.value;
  }

  async function verifyUnlock(pwd) {
    const hash = await sha256Hex(pwd);
    const stored = await fetchUnlockHash();
    return hash === stored;
  }

  async function verifyAdmin(pwd) {
    const hash = await sha256Hex(pwd);
    const stored = await fetchAdminHash();
    return hash === stored;
  }

  async function adminAction(password, action, payload) {
    ensure();
    const { data, error } = await client.rpc('admin_action', {
      password,
      action,
      payload,
    });
    if (error) throw error;
    invalidate();
    return data;
  }

  window.LOOMICON_DB = {
    init,
    isConfigured,
    fetchAll,
    invalidate,
    fetchUnlockHash,
    fetchAdminHash,
    verifyUnlock,
    verifyAdmin,
    adminAction,
    sha256Hex,
  };
})();