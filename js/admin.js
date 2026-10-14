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
  let iconColors = [];       // 全部图标颜色版本（含 id、icon_id、name、svg）
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
      iconColors = data.iconColors || [];
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
    const realCats = categories.filter((c) => !isPseudoCat(c));
    // 图标管理筛选
    const filterCat = $('#icons-filter-cat');
    if (filterCat) {
      const cur = filterCat.value;
      filterCat.innerHTML = '<option value="">全部分类</option>' +
        realCats.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      if (cur) filterCat.value = cur;
    }
    // 批量上传分类
    const uploadCat = $('#upload-cat');
    if (uploadCat) {
      const cur = uploadCat.value;
      uploadCat.innerHTML = '<option value="">选择分类...</option>' +
        realCats.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      if (cur) uploadCat.value = cur;
    }
    // 图标编辑弹窗分类下拉
    const imCat = $('#im-cat');
    if (imCat) {
      const cur = imCat.value;
      imCat.innerHTML = realCats.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      if (cur) imCat.value = cur;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // 「全部图标」只是公开端的集合概念，不是真实分类，后台不作为分组/选项展示
  function isPseudoCat(c) {
    return c.slug === 'all' || c.name === '全部图标';
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
      empty.textContent = icons.length ? '没有匹配的图标' : '暂无图标';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    const kw = ($('#icons-filter-search').value || '').trim();
    // 搜索时禁止拖拽（可见子集排序会产生歧义）
    grid.classList.toggle('no-drag', !!kw);

    // 按分类分组：分类按 sort_order 排列，组内按 sort_order 排列
    // 「全部图标」伪分类不占展示栏（万一部分类下有历史图标，仍兜底渲染出来便于管理）
    const groups = categories
      .filter((c) => !isPseudoCat(c) || list.some((i) => i.category_id === c.id))
      .map((c) => ({
        cat: c,
        items: list
          .filter((i) => i.category_id === c.id)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
      }));
    // 分类已被删除的“孤儿”图标兜底展示
    const orphans = list.filter((i) => !catById.has(i.category_id));
    if (orphans.length) groups.push({ cat: null, items: orphans });

    grid.innerHTML = groups.map(({ cat, items }) => `
      <div class="admin-cat-group">
        <div class="admin-cat-group-head">
          <h3>${cat ? escapeHtml(cat.name) : '未分类'}</h3>
          <span class="count">${items.length} 个</span>
          ${kw ? '' : '<span class="hint">拖动卡片排序</span>'}
        </div>
        <div class="admin-cat-body" ${cat ? `data-cat-id="${cat.id}"` : ''}>
          ${items.map((i, idx) => `
            <div class="admin-icon-card" data-id="${i.id}" draggable="${cat ? 'true' : 'false'}">
              <span class="admin-icon-order">${idx + 1}</span>
              <div class="admin-icon-thumb">${i.svg}</div>
              <div class="admin-icon-name">${escapeHtml(i.name)}</div>
              <div class="admin-icon-actions">
                <button class="admin-btn" data-act="edit" data-id="${i.id}">编辑</button>
                <button class="admin-btn admin-btn-danger" data-act="del" data-id="${i.id}">删除</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
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

  // ============== 拖拽排序（组内 / 跨组均可，序号自动重排） ==============
  let dragId = null;
  let dropInfo = null; // { catId, index }

  function clearDropIndicators() {
    $$('#icons-grid .insert-before').forEach((el) => el.classList.remove('insert-before'));
    $$('#icons-grid .insert-after').forEach((el) => el.classList.remove('insert-after'));
    $$('#icons-grid .drop-empty').forEach((el) => el.classList.remove('drop-empty'));
    dropInfo = null;
  }
  function clearDraggingClass() {
    $$('#icons-grid .dragging').forEach((el) => el.classList.remove('dragging'));
  }

  const gridEl = $('#icons-grid');
  gridEl.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.admin-icon-card');
    if (!card || card.getAttribute('draggable') !== 'true') { e.preventDefault(); return; }
    dragId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  gridEl.addEventListener('dragend', () => {
    dragId = null;
    clearDraggingClass();
    clearDropIndicators();
  });
  gridEl.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropIndicators();

    const card = e.target.closest('.admin-icon-card:not(.dragging)');
    if (card) {
      const body = card.closest('.admin-cat-body');
      if (!body || !body.dataset.catId) return;
      const rect = card.getBoundingClientRect();
      const before = (e.clientX - rect.left) < rect.width / 2;
      card.classList.add(before ? 'insert-before' : 'insert-after');
      const ids = [...body.querySelectorAll('.admin-icon-card:not(.dragging)')].map((el) => el.dataset.id);
      let idx = ids.indexOf(card.dataset.id);
      if (idx < 0) idx = ids.length;
      dropInfo = { catId: body.dataset.catId, index: before ? idx : idx + 1 };
      return;
    }
    // 悬停在分组空白处 / 空分组 => 追加到该分类末尾
    const body = e.target.closest('.admin-cat-body');
    if (body && body.dataset.catId) {
      body.classList.add('drop-empty');
      dropInfo = {
        catId: body.dataset.catId,
        index: body.querySelectorAll('.admin-icon-card:not(.dragging)').length,
      };
    }
  });
  gridEl.addEventListener('drop', async (e) => {
    if (!dragId) return;
    e.preventDefault();
    const info = dropInfo;
    const srcId = dragId;
    dragId = null;
    clearDraggingClass();
    clearDropIndicators();
    if (info) await applyMove(srcId, info);
  });

  async function applyMove(sourceId, info) {
    const src = icons.find((i) => i.id === sourceId);
    if (!src) return;
    const catIcons = icons
      .filter((i) => i.category_id === info.catId && i.id !== sourceId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    catIcons.splice(info.index, 0, src);
    // 序号自动生成：组内 0..n-1
    const changed = [];
    catIcons.forEach((ic, idx) => {
      if (ic.sort_order !== idx || ic.category_id !== info.catId) {
        changed.push({ id: ic.id, category_id: info.catId, sort_order: idx });
        ic.sort_order = idx;
        ic.category_id = info.catId;
      }
    });
    renderIconsList();
    if (!changed.length) return;
    try {
      await LOOMICON_DB.adminAction(adminPwd, 'reorder_icons', { items: changed });
      toast('排序已保存', 'success');
    } catch (err) {
      toast('排序保存失败：' + err.message, 'error');
      await refreshAll();
    }
  }

  $('#btn-add-icon').addEventListener('click', () => openIconModal(null));

  let iconModalSvg = '';  // 弹窗当前持有的 SVG 源码（来自选择的文件，或编辑中的原图标）

  function openIconModal(id) {
    editingIconId = id;
    const icon = id ? icons.find((x) => x.id === id) : null;
    $('#icon-modal-title').textContent = icon ? '编辑图标' : '新增图标';
    $('#im-name').value = icon ? icon.name : '';
    $('#im-file').value = '';
    iconModalSvg = icon ? (icon.svg || '') : '';
    setIconDropHint(icon ? '已载入当前图标' : '',
      icon ? '拖入或点击选择 .svg 文件可替换' : '');
    renderFilters();
    if (icon) $('#im-cat').value = icon.category_id;
    updateIconPreview();
    // 颜色版本：只有已有图标才有 id 可挂载
    modalColors = icon ? iconColorsOf(icon.id).map((c) => ({ id: c.id, name: c.name, svg: c.svg })) : [];
    resetNewColorInputs();
    // 已有图标：把图标自带的那份 SVG 认成「原图」版本（无需重复上传）
    if (icon) ensureOriginColor();
    renderIconColors();
    $('#icon-modal').hidden = false;
  }

  // 拖拽区文案：无文件时显示默认提示，选中文件后显示文件名
  function setIconDropHint(fileName, subText) {
    const hint = $('#im-drop-hint');
    const sub = $('#im-drop-sub');
    if (fileName) {
      hint.textContent = fileName;
      hint.classList.add('is-file');
      sub.textContent = subText || '已载入，可再次拖入或点击替换';
    } else {
      hint.textContent = '点击或拖拽 .svg 文件到此处';
      hint.classList.remove('is-file');
      sub.textContent = subText || '文件名会自动填入上方名称';
    }
  }

  function updateIconPreview() {
    const svg = iconModalSvg.trim();
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

  function bindIconDrop() {
    const drop = $('#im-drop');
    const fileInput = $('#im-file');
    if (!drop || !fileInput) return;
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', async (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
      await handleIconFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', async (e) => {
      await handleIconFile(e.target.files[0]);
      e.target.value = ''; // 允许连续选择同一个文件
    });
  }

  async function handleIconFile(file) {
    if (!file) return;
    if (!/\.svg$/i.test(file.name)) { toast('请选择 .svg 格式的文件', 'error'); return; }
    const text = (await file.text()).trim();
    if (!/<svg[\s>]/i.test(text)) { toast('文件内容不是有效的 SVG', 'error'); return; }
    iconModalSvg = text;
    // 新增时用文件名自动补名称（名称已手填则不动）
    if (!editingIconId && !$('#im-name').value.trim()) {
      $('#im-name').value = file.name.replace(/\.svg$/i, '');
    }
    setIconDropHint(file.name);
    updateIconPreview();
    // 图标本身 = 第一个颜色版本，不需要再去下面重复上传一次
    ensureOriginColor();
    renderIconColors();
  }

  bindIconDrop();

  $('#im-save').addEventListener('click', async () => {
    const name = $('#im-name').value.trim();
    const category_id = $('#im-cat').value;
    const svg = iconModalSvg.trim();
    if (!name || !category_id) {
      toast('请填齐名称和分类', 'error');
      return;
    }
    if (!svg) {
      toast('请先选择 SVG 文件', 'error');
      return;
    }
    // 排序自动生成：新增或更换分类 => 排到该分类末尾；同分类编辑 => 保持原序号
    const old = editingIconId ? icons.find((x) => x.id === editingIconId) : null;
    const sort_order = (old && old.category_id === category_id)
      ? (old.sort_order || 0)
      : icons
          .filter((i) => i.category_id === category_id)
          .reduce((m, i) => Math.max(m, i.sort_order || 0), -1) + 1;
    try {
      let savedIconId = editingIconId;
      if (editingIconId) {
        await LOOMICON_DB.adminAction(adminPwd, 'update_icon', { id: editingIconId, name, category_id, sort_order, svg });
      } else {
        const res = await LOOMICON_DB.adminAction(adminPwd, 'create_icon', { name, category_id, sort_order, svg });
        savedIconId = res && res.id;
      }
      // 保存颜色版本（需要图标 id，所以放在图标保存之后）
      let colorFail = 0;
      if (savedIconId && modalColors.length) {
        const colorErr = await saveIconColors(savedIconId);
        colorFail = colorErr.count;
        if (colorErr.firstMsg) console.error('[LOOMICON] 颜色保存失败原因：', colorErr.firstMsg);
      }
      if (colorFail) {
        toast(`图标已保存，但 ${colorFail} 个颜色版本保存失败：${lastColorError || '未知错误'}`, 'error');
      } else {
        toast('已保存', 'success');
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
      } else {
        await LOOMICON_DB.adminAction(adminPwd, 'create_category', { name, slug, sort_order, is_locked });
      }
      toast('已保存', 'success');
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

  // ============== 图标颜色版本 ==============
  // 每个图标可以挂若干「颜色版本」，每个版本是一份完整的该颜色 SVG。
  // 公开端点开这个图标时，只能在这些已上传的版本之间切换。
  let modalColors = [];     // 弹窗内正在编辑的颜色版本 [{id?, name, svg, fromIcon?}]
  let newColorSvg = '';     // 待添加的颜色的 SVG 源码
  let newColorFile = '';    // 待添加的颜色的文件名（仅用于提示）
  let lastColorError = '';  // 最近一次颜色保存失败的原因（用于提示）

  function iconColorsOf(iconId) {
    return iconColors
      .filter((c) => c.icon_id === iconId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  function renderIconColors() {
    const box = $('#im-colors');
    if (!box) return;
    if (!modalColors.length) {
      box.innerHTML = '<p class="admin-field-tip" style="margin:0;">还没有颜色版本，图标只有默认样式。</p>';
      return;
    }
    box.innerHTML = modalColors.map((c, idx) => `
      <div class="admin-color-item${c.fromIcon ? ' is-origin' : ''}" data-idx="${idx}">
        <span class="swatch">${c.svg}</span>
        <input class="admin-color-name" data-idx="${idx}" value="${escapeHtml(c.name)}" maxlength="20" placeholder="颜色名">
        ${c.fromIcon ? '<span class="origin-tag">原图</span>' : ''}
        <button class="del" data-del-color="${idx}" title="移除">×</button>
      </div>
    `).join('');
  }

  // 颜色名就地编辑
  $('#im-colors').addEventListener('input', (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('admin-color-name')) return;
    const idx = parseInt(el.dataset.idx, 10);
    if (modalColors[idx]) modalColors[idx].name = el.value;
  });

  $('#im-colors').addEventListener('click', (e) => {
    const idx = e.target.dataset && e.target.dataset.delColor;
    if (idx === undefined) return;
    modalColors.splice(parseInt(idx, 10), 1);
    renderIconColors();
  });

  // 把图标本身的 SVG 变成「第一个颜色」，无需重复上传。
  // 作用：用户只要改个名字（如「黑色」）就能把默认样式纳入可选颜色列表。
  function ensureOriginColor() {
    const svg = (iconModalSvg || '').trim();
    if (!svg) return;
    const first = modalColors[0];
    if (first && first.fromIcon) {
      // 原图版本已存在：跟随最新的图标 SVG
      first.svg = svg;
      return;
    }
    // 若列表里已经有同样 svg 的版本（老数据），把它标记为原图，避免重复
    const same = modalColors.find((c) => (c.svg || '').trim() === svg);
    if (same) {
      same.fromIcon = true;
      same.svg = svg;
      return;
    }
    modalColors.unshift({ name: '默认', svg, fromIcon: true });
  }

  function setNewColorHint(fileName) {
    const hint = $('#imc-drop-hint');
    if (!hint) return;
    if (fileName) {
      hint.textContent = fileName;
      hint.classList.add('is-file');
    } else {
      hint.textContent = '点击或拖拽该颜色的 .svg 文件';
      hint.classList.remove('is-file');
    }
  }

  function bindNewColorDrop() {
    const drop = $('#imc-drop');
    const fileInput = $('#imc-file');
    if (!drop || !fileInput) return;
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', async (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
      await handleNewColorFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', async (e) => {
      await handleNewColorFile(e.target.files[0]);
      e.target.value = '';
    });
  }

  async function handleNewColorFile(file) {
    if (!file) return;
    if (!/\.svg$/i.test(file.name)) { toast('请选择 .svg 格式的文件', 'error'); return; }
    const text = (await file.text()).trim();
    if (!/<svg[\s>]/i.test(text)) { toast('文件内容不是有效的 SVG', 'error'); return; }
    newColorSvg = text;
    newColorFile = file.name;
    // 颜色名留空时用文件名兜底
    if (!$('#imc-name').value.trim()) {
      $('#imc-name').value = file.name.replace(/\.svg$/i, '');
    }
    setNewColorHint(file.name);
  }

  function resetNewColorInputs() {
    newColorSvg = '';
    newColorFile = '';
    $('#imc-name').value = '';
    $('#imc-file').value = '';
    setNewColorHint('');
  }

  $('#imc-add').addEventListener('click', () => {
    const name = $('#imc-name').value.trim();
    if (!name) { toast('请填写颜色名', 'error'); return; }
    if (!newColorSvg) { toast('请先选择该颜色的 SVG 文件', 'error'); return; }
    if (modalColors.some((c) => c.name === name)) { toast('已经有同名颜色了', 'error'); return; }
    modalColors.push({ name, svg: newColorSvg });
    resetNewColorInputs();
    renderIconColors();
  });

  bindNewColorDrop();

  // 把弹窗内的颜色版本与数据库对齐：多的删除、新的新增、改的更新
  async function saveIconColors(iconId) {
    const old = iconColorsOf(iconId);
    const keptIds = new Set(modalColors.filter((c) => c.id).map((c) => c.id));
    let failCount = 0;
    let firstMsg = '';
    const seenNames = new Set();

    // 1) 删除已移除的
    for (const o of old) {
      if (keptIds.has(o.id)) continue;
      try {
        await LOOMICON_DB.adminAction(adminPwd, 'delete_icon_color', { id: o.id });
      } catch (e) {
        failCount++; if (!firstMsg) firstMsg = e.message || String(e);
        console.error('delete color fail', e);
      }
    }
    // 2) 新增 / 更新（同时把顺序写成 0..n-1）
    let order = 0;
    for (const c of modalColors) {
      const name = (c.name || '').trim();
      if (!name) continue;                       // 名字空着就跳过，避免脏数据
      if (seenNames.has(name)) continue;         // 前端去重，避免撞 unique(icon_id,name)
      seenNames.add(name);
      const o = c.id ? old.find((x) => x.id === c.id) : null;
      try {
        if (o) {
          await LOOMICON_DB.adminAction(adminPwd, 'update_icon_color', {
            id: o.id, name, svg: c.svg, sort_order: order,
          });
        } else {
          await LOOMICON_DB.adminAction(adminPwd, 'create_icon_color', {
            icon_id: iconId, name, svg: c.svg, sort_order: order,
          });
        }
        order++;
      } catch (e) {
        failCount++; if (!firstMsg) firstMsg = e.message || String(e);
        console.error('save color fail', name, e);
      }
    }
    lastColorError = firstMsg;
    return { count: failCount, firstMsg };
  }

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