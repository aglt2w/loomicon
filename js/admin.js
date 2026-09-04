// ============================================================
// LOOM ICON 后台管理 - admin.js
// ============================================================
// 数据全部走 LOOMICON_DB（Supabase）。所有写操作通过 admin_action RPC。
// ============================================================

(function () {
  // ============== 全局状态 ==============
  let adminPwd = null;       // 当前会话的管理员明文密码（仅保存在内存）
  let categories = [];       // 全部分类（含 id、is_locked）
  let icons = [];            // 全部图标（含 id、category_id、svg、name）
  let catById = new Map();   // id -> category
  let catByName = new Map(); // name -> category
  let currentView = 'icons';
  let editingIconId = null;
  let editingCatId = null;

  // 批量上传/导入缓冲
  let uploadQueue = [];      // [{ file, name, svg }]
  let importPayload = null;  // { categories: [...], icons: [...] }

  // ============== 元素 ==============
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const elLogin = $('#admin-login');
  const elShell = $('#admin-shell');
  const elPwd = $('#admin-pwd');
  const elPwdErr = $('#admin-pwd-error');
  const elLoginSubmit = $('#admin-pwd-submit');
  const elLogout = $('#admin-logout');

  // ============== Toast ==============
  function toast(text, type = '') {
    const host = $('#admin-toast-host');
    const t = document.createElement('div');
    t.className = `admin-toast ${type}`;
    t.textContent = text;
    host.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ============== 登录 ==============
  async function tryLogin() {
    const pwd = elPwd.value.trim();
    if (!pwd) {
      elPwdErr.textContent = '请输入管理员密码';
      elPwd.focus();
      return;
    }
    if (!window.LOOMICON_DB) {
      elPwdErr.textContent = 'LOOMICON_DB 未加载，请检查 js/supabase.js';
      return;
    }
    if (!LOOMICON_DB.isConfigured()) {
      elPwdErr.textContent = '未配置 Supabase URL / Key。请填写 js/config.js';
      return;
    }
    try {
      await LOOMICON_DB.init();
      const ok = await LOOMICON_DB.verifyAdmin(pwd);
      if (!ok) {
        elPwdErr.textContent = '管理员密码错误';
        toast('密码错误', 'error');
        return;
      }
      adminPwd = pwd;
      elLogin.style.display = 'none';
      elShell.hidden = false;
      toast('登录成功');
      await refreshAll();
      bindAfterLogin();
    } catch (e) {
      console.error(e);
      elPwdErr.textContent = '登录失败：' + (e.message || e);
    }
  }

  elPwd.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
  elLoginSubmit.addEventListener('click', tryLogin);
  elLogout.addEventListener('click', () => {
    adminPwd = null;
    elPwd.value = '';
    elPwdErr.textContent = '';
    elShell.hidden = true;
    elLogin.style.display = 'flex';
  });

  // ============== 视图切换 ==============
  function switchView(view) {
    currentView = view;
    $$('.admin-nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    $$('.admin-view').forEach((s) => s.classList.toggle('active', s.dataset.view === view));
    if (view === 'icons') renderIconsList();
    if (view === 'categories') renderCatsList();
    if (view === 'upload') renderUploadView();
  }
  $$('.admin-nav-item').forEach((b) =>
    b.addEventListener('click', () => switchView(b.dataset.view))
  );

  // 关闭弹窗
  document.addEventListener('click', (e) => {
    const id = e.target.dataset && e.target.dataset.close;
    if (id) {
      const m = document.getElementById(id);
      if (m) m.hidden = true;
    }
    if (e.target.classList && e.target.classList.contains('admin-modal-mask')) {
      e.target.closest('.admin-modal').hidden = true;
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.admin-modal').forEach((m) => (m.hidden = true));
    }
  });

  // ============== 数据加载 ==============
  async function refreshAll() {
    try {
      const data = await LOOMICON_DB.fetchAll(true);
      categories = data.categories || [];
      icons = data.icons || [];
      catById = new Map(categories.map((c) => [c.id, c]));
      catByName = new Map(categories.map((c) => [c.name, c]));
      renderFilters();
      if (currentView === 'icons') renderIconsList();
      if (currentView === 'categories') renderCatsList();
      if (currentView === 'upload') renderUploadView();
    } catch (e) {
      console.error(e);
      toast('加载数据失败：' + (e.message || e), 'error');
    }
  }

  function bindAfterLogin() {
    renderFilters();
    if (currentView === 'icons') renderIconsList();
  }

  function renderFilters() {
    // 图标管理筛选
    const filterCat = $('#icons-filter-cat');
    if (filterCat) {
      const cur = filterCat.value;
      filterCat.innerHTML = '<option value="">全部分类</option>' +
        categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      if (cur) filterCat.value = cur;
    }
    // 批量上传分类
    const uploadCat = $('#upload-cat');
    if (uploadCat) {
      const cur = uploadCat.value;
      uploadCat.innerHTML = '<option value="">选择分类...</option>' +
        categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      if (cur) uploadCat.value = cur;
    }
    // 图标编辑弹窗分类下拉
    const imCat = $('#im-cat');
    if (imCat) {
      const cur = imCat.value;
      imCat.innerHTML = categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      if (cur) imCat.value = cur;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ============== 图标管理 ==============
  function filteredIcons() {
    const catId = $('#icons-filter-cat').value;
    const kw = ($('#icons-filter-search').value || '').toLowerCase().trim();
    return icons.filter((i) => {
      if (catId && i.category_id !== catId) return false;
      if (kw && !i.name.toLowerCase().includes(kw)) return false;
      return true;
    });
  }

  function renderIconsList() {
    const grid = $('#icons-grid');
    const empty = $('#icons-empty');
    const list = filteredIcons();
    $('#icons-total').textContent = icons.length;
    if (!list.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.innerHTML = list.map((i) => {
      const cat = catById.get(i.category_id);
      return `
        <div class="admin-icon-card" data-id="${i.id}">
          <div class="admin-icon-thumb">${i.svg}</div>
          <div class="admin-icon-name">${escapeHtml(i.name)}</div>
          <div class="admin-icon-cat-tag">${cat ? escapeHtml(cat.name) : '未分类'}</div>
          <div class="admin-icon-actions">
            <button class="admin-btn" data-act="edit" data-id="${i.id}">编辑</button>
            <button class="admin-btn admin-btn-danger" data-act="del" data-id="${i.id}">删除</button>
          </div>
        </div>
      `;
    }).join('');
  }

  $('#icons-filter-cat').addEventListener('change', renderIconsList);
  $('#icons-filter-search').addEventListener('input', renderIconsList);

  $('#icons-grid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if (act === 'edit') openIconModal(id);
    if (act === 'del') {
      const icon = icons.find((x) => x.id === id);
      if (!confirm(`确认删除「${icon ? icon.name : ''}」？`)) return;
      try {
        await LOOMICON_DB.adminAction(adminPwd, 'delete_icon', { id });
        toast('已删除', 'success');
        await refreshAll();
      } catch (err) { toast('删除失败：' + err.message, 'error'); }
    }
  });

  $('#btn-add-icon').addEventListener('click', () => openIconModal(null));

  function openIconModal(id) {
    editingIconId = id;
    const icon = id ? icons.find((x) => x.id === id) : null;
    $('#icon-modal-title').textContent = icon ? '编辑图标' : '新增图标';
    $('#im-name').value = icon ? icon.name : '';
    $('#im-order').value = icon ? (icon.sort_order || 0) : 0;
    $('#im-svg').value = icon ? icon.svg : '';
    renderFilters();
    if (icon) $('#im-cat').value = icon.category_id;
    updateIconPreview();
    $('#icon-modal').hidden = false;
  }

  $('#im-svg').addEventListener('input', updateIconPreview);

  function updateIconPreview() {
    const svg = $('#im-svg').value.trim();
    const box = $('#im-preview');
    if (!svg) { box.innerHTML = ''; return; }
    box.innerHTML = svg;
    // 兜底：把 svg 强制设大小
    const s = box.querySelector('svg');
    if (s) {
      s.removeAttribute('width');
      s.removeAttribute('height');
      s.style.maxWidth = '60px';
      s.style.maxHeight = '60px';
    }
  }

  $('#im-save').addEventListener('click', async () => {
    const name = $('#im-name').value.trim();
    const category_id = $('#im-cat').value;
    const sort_order = parseInt($('#im-order').value || '0', 10);
    const svg = $('#im-svg').value.trim();
    if (!name || !category_id || !svg) {
      toast('请填齐名称、分类和 SVG 代码', 'error');
      return;
    }
    try {
      if (editingIconId) {
        await LOOMICON_DB.adminAction(adminPwd, 'update_icon', { id: editingIconId, name, category_id, sort_order, svg });
        toast('已保存', 'success');
      } else {
        await LOOMICON_DB.adminAction(adminPwd, 'create_icon', { name, category_id, sort_order, svg });
        toast('已新增', 'success');
      }
      $('#icon-modal').hidden = true;
      await refreshAll();
    } catch (e) { toast('保存失败：' + e.message, 'error'); }
  });

  // ============== 分类管理 ==============
  function renderCatsList() {
    const tbody = $('#cats-tbody');
    $('#cats-total').textContent = categories.length;
    if (!categories.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px;">暂无分类</td></tr>';
      return;
    }
    tbody.innerHTML = categories.sort((a, b) => a.sort_order - b.sort_order).map((c) => {
      const count = icons.filter((i) => i.category_id === c.id).length;
      return `
        <tr data-id="${c.id}">
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td><code style="font-size:12px;color:#64748b;background:rgba(245,179,44,0.08);padding:1px 6px;border-radius:4px;">${escapeHtml(c.slug)}</code></td>
          <td>${count}</td>
          <td>${c.sort_order || 0}</td>
          <td>
            <span class="admin-lock-pill ${c.is_locked ? 'locked' : 'unlocked'}" data-act="toggle-lock" data-id="${c.id}">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="${c.is_locked ? 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z' : 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'}"></path></svg>
              ${c.is_locked ? '上锁' : '公开'}
            </span>
          </td>
          <td>
            <button class="admin-btn" data-act="edit-cat" data-id="${c.id}">编辑</button>
            <button class="admin-btn admin-btn-danger" data-act="del-cat" data-id="${c.id}">删除</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  $('#cats-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if (act === 'edit-cat') openCatModal(id);
    if (act === 'del-cat') {
      const cat = categories.find((x) => x.id === id);
      const count = icons.filter((i) => i.category_id === id).length;
      const msg = count > 0
        ? `「${cat ? cat.name : ''}」下还有 ${count} 个图标，删除会一起删除。确认？`
        : `确认删除分类「${cat ? cat.name : ''}」？`;
      if (!confirm(msg)) return;
      try {
        await LOOMICON_DB.adminAction(adminPwd, 'delete_category', { id });
        toast('已删除分类', 'success');
        await refreshAll();
      } catch (err) { toast('删除失败：' + err.message, 'error'); }
    }
    if (act === 'toggle-lock') {
      const cat = categories.find((x) => x.id === id);
      try {
        await LOOMICON_DB.adminAction(adminPwd, 'toggle_lock', { id, is_locked: !cat.is_locked });
        toast('已切换上锁状态', 'success');
        await refreshAll();
      } catch (err) { toast('切换失败：' + err.message, 'error'); }
    }
  });

  $('#btn-add-cat').addEventListener('click', () => openCatModal(null));

  function openCatModal(id) {
    editingCatId = id;
    const cat = id ? categories.find((x) => x.id === id) : null;
    $('#cat-modal-title').textContent = cat ? '编辑分类' : '新增分类';
    $('#cm-name').value = cat ? cat.name : '';
    $('#cm-slug').value = cat ? cat.slug : '';
    $('#cm-order').value = cat ? (cat.sort_order || 0) : 0;
    $('#cm-locked').checked = cat ? !!cat.is_locked : false;
    $('#cat-modal').hidden = false;
  }

  // 自动从名称生成 slug
  $('#cm-name').addEventListener('input', () => {
    if (!editingCatId) {
      const slug = $('#cm-name').value.trim()
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      $('#cm-slug').value = slug;
    }
  });

  $('#cm-save').addEventListener('click', async () => {
    const name = $('#cm-name').value.trim();
    const slug = $('#cm-slug').value.trim();
    const sort_order = parseInt($('#cm-order').value || '0', 10);
    const is_locked = $('#cm-locked').checked;
    if (!name || !slug) { toast('请填齐名称和 slug', 'error'); return; }
    try {
      if (editingCatId) {
        await LOOMICON_DB.adminAction(adminPwd, 'update_category', { id: editingCatId, name, slug, sort_order, is_locked });
        toast('已保存', 'success');
      } else {
        await LOOMICON_DB.adminAction(adminPwd, 'create_category', { name, slug, sort_order, is_locked });
        toast('已新增', 'success');
      }
      $('#cat-modal').hidden = true;
      await refreshAll();
    } catch (e) { toast('保存失败：' + e.message, 'error'); }
  });

  // ============== 批量上传 ==============
  function renderUploadView() {
    renderUploadQueue();
  }

  function renderUploadQueue() {
    const list = $('#upload-list');
    if (!uploadQueue.length) {
      list.innerHTML = '';
      $('#btn-upload-confirm').disabled = true;
      return;
    }
    list.innerHTML = uploadQueue.map((it, idx) => `
      <div class="admin-upload-item" data-idx="${idx}">
        <div class="thumb-svg">${it.svg}</div>
        <div class="name">${escapeHtml(it.name)}</div>
        <button class="del" data-del="${idx}">移除</button>
      </div>
    `).join('');
    $('#btn-upload-confirm').disabled = !($('#upload-cat').value && uploadQueue.length);
  }

  function bindUpload() {
    const drop = $('#upload-drop');
    const fileInput = $('#upload-files');
    const catSelect = $('#upload-cat');

    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', async (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
      await handleUploadFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', async (e) => {
      await handleUploadFiles(e.target.files);
      e.target.value = '';
    });
    catSelect.addEventListener('change', renderUploadQueue);
    $('#upload-list').addEventListener('click', (e) => {
      const idx = e.target.dataset && e.target.dataset.del;
      if (idx !== undefined) {
        uploadQueue.splice(parseInt(idx, 10), 1);
        renderUploadQueue();
      }
    });
    $('#btn-upload-confirm').addEventListener('click', doUpload);
    $('#btn-upload-clear').addEventListener('click', () => { uploadQueue = []; renderUploadQueue(); });
  }

  async function handleUploadFiles(fileList) {
    for (const file of fileList) {
      if (!/\.svg$/i.test(file.name)) continue;
      const text = await file.text();
      // 简单校验 svg
      if (!/<svg[\s>]/i.test(text)) continue;
      const name = file.name.replace(/\.svg$/i, '');
      uploadQueue.push({ file, name, svg: text });
    }
    renderUploadQueue();
  }

  async function doUpload() {
    const category_id = $('#upload-cat').value;
    if (!category_id) { toast('请选择目标分类', 'error'); return; }
    const total = uploadQueue.length;
    const prog = $('#upload-progress');
    const fill = $('#upload-progress-fill');
    const txt = $('#upload-progress-text');
    prog.hidden = false;
    fill.style.width = '0%';
    txt.textContent = `0 / ${total}`;
    let okCount = 0;
    let failCount = 0;
    for (let i = 0; i < total; i++) {
      const it = uploadQueue[i];
      try {
        await LOOMICON_DB.adminAction(adminPwd, 'create_icon', {
          name: it.name,
          category_id,
          svg: it.svg,
          sort_order: i,
        });
        okCount++;
      } catch (e) {
        failCount++;
        console.error('upload fail', it.name, e);
      }
      const pct = ((i + 1) / total) * 100;
      fill.style.width = pct + '%';
      txt.textContent = `${i + 1} / ${total}`;
    }
    toast(`上传完成：成功 ${okCount}，失败 ${failCount}`, failCount ? 'error' : 'success');
    uploadQueue = [];
    renderUploadQueue();
    await refreshAll();
  }
  bindUpload();

  // ============== 数据导入 ==============
  function bindImport() {
    const drop = $('#import-drop');
    const fileInput = $('#import-file');

    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', async (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
      await handleImportFile(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', async (e) => {
      await handleImportFile(e.target.files);
      e.target.value = '';
    });
    $('#btn-import-confirm').addEventListener('click', doImport);
    $('#btn-import-clear').addEventListener('click', () => {
      importPayload = null;
      $('#import-preview').innerHTML = '';
      $('#btn-import-confirm').disabled = true;
    });
  }

  async function handleImportFile(fileList) {
    const file = fileList[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : (Array.isArray(data.icons) ? data.icons : []);
      if (!list.length) { toast('JSON 内未找到图标数组', 'error'); return; }
      // 统计
      const catSet = new Set(list.map((i) => i.category || '未分类'));
      importPayload = { list };
      $('#import-preview').innerHTML = `
        <div>共 <strong>${list.length}</strong> 个图标，涉及 <strong>${catSet.size}</strong> 个分类：${[...catSet].map((c) => escapeHtml(c)).join('、')}</div>
        <div style="margin-top:6px;">已存在同名分类会复用，不存在的会先自动创建。</div>
      `;
      $('#btn-import-confirm').disabled = false;
    } catch (e) {
      toast('解析失败：' + e.message, 'error');
    }
  }

  async function doImport() {
    if (!importPayload) return;
    const list = importPayload.list;
    const total = list.length;
    const prog = $('#import-progress');
    const fill = $('#import-progress-fill');
    const txt = $('#import-progress-text');
    prog.hidden = false;
    fill.style.width = '0%';
    txt.textContent = `0 / ${total}`;

    // 1) 创建缺失的分类
    const existingNames = new Set(categories.map((c) => c.name));
    const neededNames = new Set(list.map((i) => i.category || '未分类'));
    for (const name of neededNames) {
      if (existingNames.has(name)) continue;
      const slug = name.toLowerCase().replace(/[^\w\u4e00-\u9fa5-]+/g, '-').replace(/^-+|-+$/g, '') || ('cat-' + Date.now());
      try {
        await LOOMICON_DB.adminAction(adminPwd, 'create_category', { name, slug, is_locked: /^(LOGO|OMC表情)$/.test(name) });
      } catch (e) {
        console.warn('create cat fail', name, e);
      }
    }
    // 重新拉分类映射
    await refreshAll();

    // 2) 批量插入图标
    let okCount = 0, failCount = 0;
    for (let i = 0; i < total; i++) {
      const it = list[i];
      const cat = catByName.get(it.category || '未分类');
      if (!cat) { failCount++; continue; }
      try {
        await LOOMICON_DB.adminAction(adminPwd, 'create_icon', {
          name: it.name,
          category_id: cat.id,
          svg: it.svg,
          sort_order: i,
        });
        okCount++;
      } catch (e) {
        failCount++;
        console.error('import fail', it.name, e);
      }
      const pct = ((i + 1) / total) * 100;
      fill.style.width = pct + '%';
      txt.textContent = `${i + 1} / ${total}`;
    }
    toast('导入完成：成功 ' + okCount + '，失败 ' + failCount, failCount ? 'error' : 'success');
    importPayload = null;
    $('#import-preview').innerHTML = '';
    $('#btn-import-confirm').disabled = true;
    await refreshAll();
  }
  bindImport();

  // ============== 设置 ==============
  $('#btn-change-admin').addEventListener('click', async () => {
    const newPwd = $('#new-admin-pwd').value.trim();
    if (!newPwd || newPwd.length < 6) { toast('新密码至少 6 位', 'error'); return; }
    try {
      await LOOMICON_DB.adminAction(adminPwd, 'change_password', { new_password: newPwd });
      toast('管理员密码已修改，请用新密码重新登录', 'success');
      // 清空当前会话密码，强制重新登录
      setTimeout(() => elLogout.click(), 800);
    } catch (e) { toast('修改失败：' + e.message, 'error'); }
  });

  $('#btn-change-unlock').addEventListener('click', async () => {
    const newPwd = $('#new-unlock-pwd').value.trim();
    if (!newPwd || newPwd.length < 4) { toast('新密码至少 4 位', 'error'); return; }
    try {
      await LOOMICON_DB.adminAction(adminPwd, 'change_unlock_password', { new_password: newPwd });
      toast('公开端解锁密码已修改', 'success');
      $('#new-unlock-pwd').value = '';
    } catch (e) { toast('修改失败：' + e.message, 'error'); }
  });

  // ============== 自动登录（如果本地有 session） ==============
  // 后台会话不持久化（安全性考虑），刷新页面就要重新输密码。
  // 如果你想记住，可以在 elPwd 输入框加 autocomplete。
})();