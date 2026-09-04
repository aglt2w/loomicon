// 加这1行：函数提升声明，消除浏览器未定义警告
function checkAuthStatus() {};

// ########## Supabase 解锁密码（如未配置 supabase，用此 fallback） ##########
// ###################################################

// 全局分类元数据（含 is_locked）+ 解锁状态
let dbCategories = [];          // [{id, name, slug, is_locked, sort_order}]
let isUnlocked = false;         // 是否已解锁
const UNLOCK_KEY = 'loomIconAuth';

// 获取所有密码验证相关元素
const authBtn = document.querySelector('.auth-btn');
const authModal = document.querySelector('.auth-modal');
const authCloseBtn = document.querySelector('.auth-close-btn');
const authInput = document.querySelector('.auth-input');
const authError = document.querySelector('.auth-error');
const authRemember = document.querySelector('.remember-checkbox');
const authSubmitBtn = document.querySelector('.auth-submit-btn');
const authMask = document.querySelector('.auth-modal-mask');

// 1. 打开密码弹窗
authBtn.addEventListener('click', () => {
  authModal.style.display = 'block';
  setTimeout(() => {
    authModal.classList.add('show');
  }, 10);
  authInput.focus();
  authInput.value = '';
  authError.textContent = '';

  const authCache = localStorage.getItem(UNLOCK_KEY);
  if (authCache) {
    const { expireTime } = JSON.parse(authCache);
    authRemember.checked = new Date().getTime() < expireTime;
  }
});

// 2. 关闭弹窗
function closeAuthModal() {
  authModal.classList.remove('show');
  setTimeout(() => {
    authModal.style.display = 'none';
  }, 300);
  authInput.value = '';
  authError.textContent = '';
}

authCloseBtn.addEventListener('click', closeAuthModal);
authMask.addEventListener('click', closeAuthModal);
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeAuthModal());

authInput.addEventListener('keydown', (e) => e.key === 'Enter' && submitAuth());
authSubmitBtn.addEventListener('click', submitAuth);

// Toast 提示
function showAuthToast(text, type = 'success') {
  const oldToast = document.querySelector('.auth-toast');
  if (oldToast) oldToast.remove();
  const toast = document.createElement('div');
  toast.className = `auth-toast ${type}`;
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ========== 密码验证（Supabase 优先，失败用 fallback） ==========
async function submitAuth() {
  const inputPwd = authInput.value.trim();
  if (!inputPwd) {
    authError.textContent = '请输入密码';
    authInput.focus();
    return;
  }

  let ok = false;
  if (window.LOOMICON_DB && LOOMICON_DB.isConfigured()) {
    try {
      ok = await LOOMICON_DB.verifyUnlock(inputPwd);
    } catch (e) {
      console.warn('Supabase verify failed:', e);
    }
  }

  if (!ok) {
    authError.textContent = '密码错误，请重新输入';
    showAuthToast('密码错误，内部资源验证失败', 'error');
    authInput.focus();
    return;
  }

  authSuccess();
  closeAuthModal();
  refreshAfterAuth(); // 解锁后重新渲染下拉 + 图标
}

// 解锁成功：写 localStorage + body 类 + toast
function authSuccess() {
  document.body.classList.add('auth-ok');
  isUnlocked = true;
  showAuthToast('密码正确，内部资源验证成功');
  if (authRemember && authRemember.checked) {
    const expireTime = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(UNLOCK_KEY, JSON.stringify({
      isAuth: true,
      expireTime: expireTime
    }));
  }
}

// 解锁后刷新 UI（重新计算可见分类 + 重新渲染下拉和图标）
function refreshAfterAuth() {
  // 重新计算可见分类（解锁后上锁的也能显示）
  const visibleCats = getVisibleCategories();
  allCategories = ['全部图标', ...visibleCats.map(c => c.name)];
  if (dom.selectedText && !visibleCats.find(c => c.name === dom.selectedText.textContent)) {
    dom.selectedText.textContent = '全部图标';
  }
  renderSelectOptions();
  // 用完整数据渲染（renderIcons 会再次过滤）
  renderIcons(iconData);
}

// 当前解锁状态下可见的分类（排除「全部图标」本身，避免下拉重复）
function getVisibleCategories() {
  return dbCategories.filter(c => c.name !== '全部图标' && (!c.is_locked || isUnlocked));
}

// 页面加载校验本地免密缓存
function checkAuthStatus() {
  const authCache = localStorage.getItem(UNLOCK_KEY);
  if (!authCache) return;
  try {
    const { isAuth, expireTime } = JSON.parse(authCache);
    if (isAuth && new Date().getTime() < expireTime) {
      document.body.classList.add('auth-ok');
      isUnlocked = true;
    } else {
      localStorage.removeItem(UNLOCK_KEY);
    }
  } catch (e) {
    localStorage.removeItem(UNLOCK_KEY);
  }
}

// 👇 以下保留你原有的script.js代码（图标渲染、搜索、分类切换等）
// ... 你的原有JS代码 ...
// 图标数据源
let iconData = [];
let allCategories = [];

// DOM元素获取（整合优化，避免重复）
const dom = {
  selectWrapper: document.getElementById('custom-select-wrapper'),
  selectBtn: document.getElementById('custom-select-btn'),
  selectList: document.getElementById('custom-select-list'),
  selectedText: document.getElementById('selected-category'),
  searchInput: document.getElementById('search-input'),
  searchIcon: document.getElementById('search-icon'),
  iconContainer: document.getElementById('icon-categories-container')
};

// 替换后的SVG图标（保留你原有样式）
const downloadSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M3 19H21V21H3V19ZM13 13.1716L19.0711 7.1005L20.4853 8.51472L12 17L3.51472 8.51472L4.92893 7.1005L11 13.1716V2H13V13.1716Z"></path></svg>';
const copySvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z"></path></svg>';

// ========== 核心：数据加载（Supabase 优先，本地 JSON 兜底） ==========
async function loadIconData() {
  // 1. 优先尝试 Supabase
  if (window.LOOMICON_DB && LOOMICON_DB.isConfigured()) {
    try {
      await LOOMICON_DB.init();
      const { categories, icons } = await LOOMICON_DB.fetchAll();
      dbCategories = categories || [];
      iconData = (icons || []).map(item => ({
        id: item.id,
        name: item.name,
        svg: item.svg,
        category: (categories.find(c => c.id === item.category_id) || {}).name || '未分类',
        category_id: item.category_id,
      }));
      // 提取 allCategories（用可见分类）
      const visible = getVisibleCategories();
      allCategories = ['全部图标', ...visible.map(c => c.name)];
      console.log(`✅ Supabase 加载完成：${iconData.length} 个图标，${dbCategories.length} 个分类（可见 ${visible.length}）`);
      return;
    } catch (e) {
      console.warn('Supabase 加载失败，fallback 到本地 JSON：', e);
    }
  }

  // 2. fallback：本地 JSON
  try {
    const listRes = await fetch('./icon-list.json');
    if (!listRes.ok) throw new Error(`读取清单失败：${listRes.status}`);
    const iconList = await listRes.json();
    iconData = iconList.map(item => ({
      name: item.name,
      svg: item.svg,
      category: item.category,
    }));
    const catSet = new Set(iconData.map(i => i.category));
    // 本地 JSON 模式：默认把 LOGO / OMC表情 视为上锁
    dbCategories = ['全部图标', ...catSet].map((name, idx) => ({
      id: null,
      name,
      slug: name,
      is_locked: /^(LOGO|OMC表情)$/.test(name),
      sort_order: idx,
    }));
    const visible = getVisibleCategories();
    allCategories = ['全部图标', ...visible.map(c => c.name)];
    console.log(`✅ 本地 JSON 加载完成：${iconData.length} 个图标`);
  } catch (err) {
    console.error("加载图标失败:", err);
    iconData = [{
      name: "默认图标",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>',
      category: "默认分类"
    }];
  }
}

// ========== 下拉框修复：无冗余文本（保留修复逻辑） ==========
function renderSelectOptions() {
  if (!dom.selectList) return;
  dom.selectList.innerHTML = ''; // 清空冗余内容
  
  allCategories.forEach(cat => {
    const opt = document.createElement('div');
    opt.className = `select-option ${cat === '全部图标' ? 'active' : ''}`;
    opt.dataset.cat = cat;
    opt.textContent = cat; // 仅显示分类名，无冗余文本
    
    opt.addEventListener('click', function() {
      document.querySelectorAll('.select-option').forEach(o => o.classList.remove('active'));
      this.classList.add('active');
      dom.selectedText.textContent = cat;
      dom.selectWrapper.classList.remove('open');
      filterByCategory(cat);
      syncTitleAndGrid(); // 筛选后对齐标题
    });
    
    dom.selectList.appendChild(opt);
  });
  console.log('下拉选项生成完成，数量：', dom.selectList.children.length);
}

// ========== 保留你原有图标渲染逻辑（渲染到innerContainer） ==========
function renderIcons(data) {
  const grouped = {};
  data.forEach(icon => {
    if (!grouped[icon.category]) grouped[icon.category] = [];
    grouped[icon.category].push(icon);
  });

  // 未解锁：过滤上锁分类
  if (!isUnlocked) {
    const lockedNames = dbCategories.filter(c => c.is_locked).map(c => c.name);
    lockedNames.forEach(name => { delete grouped[name]; });
  }

  // 保留你原有：渲染到.icons-inner-container（核心！）
  const innerContainer = document.querySelector('.icons-inner-container');
  if (!innerContainer) {
    console.error('❌ 未找到.icons-inner-container容器，请检查HTML');
    return;
  }
  innerContainer.innerHTML = ''; // 清空内层容器
  
  // 遍历你的分类和图标
  Object.keys(grouped).forEach(cat => {
    const title = document.createElement('h2');
    title.className = 'category-title';
    title.textContent = cat;
    
    const grid = document.createElement('div');
    grid.className = 'icon-grid';
    
    // 生成你的图标卡片（保留原有createIconCard）
    grouped[cat].forEach(icon => {
      const card = createIconCard(icon);
      grid.appendChild(card);
    });
    
    const categoryWrapper = document.createElement('div');
    categoryWrapper.className = 'category-wrapper';
    // ########## 新增这1行：给分类容器加data-cat标识，让CSS精准隐藏 ##########
    categoryWrapper.dataset.cat = cat;
    // #######################################################################
    categoryWrapper.appendChild(title);
    categoryWrapper.appendChild(grid);
    
    innerContainer.appendChild(categoryWrapper);
  });
  
  // 空状态处理
  if (Object.keys(grouped).length === 0) {
    innerContainer.innerHTML = '<div class="empty-state">暂无匹配图标</div>';
  }
  
  syncTitleAndGrid(); // 渲染后对齐标题
}

// ========== 保留你原有createIconCard（下载/复制按钮样式） ==========
function createIconCard(icon) {
  const card = document.createElement('div');
  card.className = 'icon-card';
  // 在卡片上存一份图标数据，供“点击放大预览”使用
  card.dataset.name = icon.name;
  card.dataset.svg = encodeURIComponent(icon.svg);
  card.dataset.category = icon.category || '';
  card.innerHTML = `
    <div class="icon-svg">${icon.svg}</div>
    <div class="icon-name">${icon.name}</div>
    <div class="icon-actions">
      <button class="icon-btn download-btn" data-name="${icon.name}" data-svg="${encodeURIComponent(icon.svg)}">
        ${downloadSvg}
      </button>
      <button class="icon-btn copy-btn" data-name="${icon.name}" data-svg="${encodeURIComponent(icon.svg)}">
        ${copySvg}
      </button>
    </div>
  `;
  
  // 下载按钮逻辑（复用统一下载函数）
  card.querySelector('.download-btn').addEventListener('click', function() {
    downloadIcon(this.dataset.name, decodeURIComponent(this.dataset.svg));
  });
  
  // 复制按钮逻辑（保留你原有提示样式）
  card.querySelector('.copy-btn').addEventListener('click', function() {
    const name = this.dataset.name;
    const svg = decodeURIComponent(this.dataset.svg);
    copyIcon(name, svg);
  });
  
  return card;
  }


// ========== 保留你原有copyIcon（提示样式完全不变） ==========
function copyIcon(name, svg) {
  navigator.clipboard.writeText(svg).then(() => {
    const tip = document.createElement('div');
    tip.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #333;
        padding: 10px 20px;
        border-radius: 12px;
        font-size: 14px;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.3s ease;
        border: 1px solid rgba(245, 179, 44, 0.2);
        box-shadow: 0 4px 16px rgba(245, 179, 44, 0.15);
        transform: translateX(-50%) translateY(10px);
    `;
    tip.innerHTML = ` <span style="color: #F5B32C; font-weight: 600;">${name}</span> 图标SVG代码已复制！`;
    document.body.appendChild(tip);
    setTimeout(() => {
        tip.style.opacity = '1';
        tip.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    setTimeout(() => {
        tip.style.opacity = '0';
        tip.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => document.body.removeChild(tip), 300);
    }, 2000);
  }).catch(err => {
    console.error('复制失败:', err);
    const tip = document.createElement('div');
    tip.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #333;
        padding: 10px 20px;
        border-radius: 12px;
        font-size: 14px;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.3s ease;
        border: 1px solid rgba(220, 53, 69, 0.2);
        box-shadow: 0 4px 16px rgba(220, 53, 69, 0.1);
        transform: translateX(-50%) translateY(10px);
    `;
    tip.innerHTML = `❌ <span style="color: #dc3545; font-weight: 600;">${name}</span> 复制失败，请手动复制！`;
    document.body.appendChild(tip);
    setTimeout(() => {
        tip.style.opacity = '1';
        tip.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    setTimeout(() => {
        tip.style.opacity = '0';
        tip.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => document.body.removeChild(tip), 300);
    }, 2000);
  });
}

// ========== 统一下载函数（卡片 hover 按钮 + 放大预览弹窗共用） ==========
function downloadIcon(name, svg) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ========== 点击图标放大预览弹窗 ==========
const previewModal = document.getElementById('icon-preview-modal');
const previewSvgBox = document.getElementById('icon-preview-svg');
const previewNameEl = document.getElementById('icon-preview-name');
const previewCatEl = document.getElementById('icon-preview-cat');
const previewDownloadBtn = document.getElementById('icon-preview-download-btn');
const previewCopyBtn = document.getElementById('icon-preview-copy-btn');
const previewCloseBtn = document.getElementById('icon-preview-close');
const previewMask = document.getElementById('icon-preview-mask');
let previewIcon = null; // 当前弹窗中展示的图标 {name, svg, category}

// 打开放大预览
function openIconPreview(name, svg, category) {
  if (!previewModal) return;
  previewIcon = { name: name, svg: svg, category: category };
  previewNameEl.textContent = name;
  previewCatEl.textContent = category || '';
  previewCatEl.style.display = category ? 'inline-block' : 'none';
  previewSvgBox.innerHTML = svg; // 放大展示图标
  previewModal.style.display = 'block';
  document.body.style.overflow = 'hidden'; // 锁住背景滚动
  setTimeout(() => previewModal.classList.add('show'), 10);
}

// 关闭放大预览
function closeIconPreview() {
  if (!previewModal || previewModal.style.display === 'none') return;
  previewModal.classList.remove('show');
  document.body.style.overflow = '';
  setTimeout(() => {
    previewModal.style.display = 'none';
    previewSvgBox.innerHTML = '';
    previewIcon = null;
  }, 300);
}

// 绑定放大预览相关事件
function bindIconPreview() {
  // 弹窗按钮：复用卡片上的下载/复制图标，加文字说明
  if (previewDownloadBtn) {
    previewDownloadBtn.innerHTML = `${downloadSvg}<span>下载 SVG</span>`;
  }
  if (previewCopyBtn) {
    previewCopyBtn.innerHTML = `${copySvg}<span>复制 SVG</span>`;
  }

  // 事件委托：点击图标卡片（任意区域）打开放大预览
  // 下载/复制按钮除外 —— 它们保留原有 hover 快捷操作，不触发弹窗
  const innerContainer = document.querySelector('.icons-inner-container');
  if (innerContainer) {
    innerContainer.addEventListener('click', function(e) {
      if (e.target.closest('.icon-btn')) return;
      const card = e.target.closest('.icon-card');
      if (!card) return;
      const name = card.dataset.name;
      const svg = card.dataset.svg ? decodeURIComponent(card.dataset.svg) : '';
      if (name && svg) openIconPreview(name, svg, card.dataset.category || '');
    });
  }

  // 关闭：关闭按钮 / 点击遮罩 / Esc
  if (previewCloseBtn) previewCloseBtn.addEventListener('click', closeIconPreview);
  if (previewMask) previewMask.addEventListener('click', closeIconPreview);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeIconPreview();
  });

  // 弹窗内下载 / 复制（复用原有能力）
  if (previewDownloadBtn) {
    previewDownloadBtn.addEventListener('click', function() {
      if (previewIcon) downloadIcon(previewIcon.name, previewIcon.svg);
    });
  }
  if (previewCopyBtn) {
    previewCopyBtn.addEventListener('click', function() {
      if (previewIcon) copyIcon(previewIcon.name, previewIcon.svg);
    });
  }
}

// ========== 分类筛选（保留逻辑） ==========
function filterByCategory(cat) {
  const filtered = cat === '全部图标' ? iconData : iconData.filter(icon => icon.category === cat);
  renderIcons(filtered);
  syncTitleAndGrid();
}

// ========== 重置下拉选中状态 ==========
function resetSelect() {
  dom.selectedText.textContent = '全部图标';
  document.querySelectorAll('.select-option').forEach(o => {
    o.classList.remove('active');
    if (o.dataset.cat === '全部图标') o.classList.add('active');
  });
}

// ========== 标题对齐（保留你原有逻辑） ==========
function syncTitleAndGrid() {
  const categoryWrappers = document.querySelectorAll('.category-wrapper');
  
  categoryWrappers.forEach(wrapper => {
    const title = wrapper.querySelector('.category-title');
    const grid = wrapper.querySelector('.icon-grid');
    if (!title || !grid) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const leftOffset = gridRect.left - wrapperRect.left;
    
    title.style.marginLeft = `${Math.max(0, leftOffset)}px`;
  });
}

// ========== 事件绑定（整合修复后的下拉框 + 你原有搜索逻辑） ==========
function bindEvents() {
  // 下拉框展开/收起（list 已移出 search-container，需 JS 定位）
  if (dom.selectBtn && dom.selectWrapper && dom.selectList) {
    function positionSelectList() {
      const rect = dom.selectWrapper.getBoundingClientRect();
      const gap = 12;
      dom.selectList.style.top = (window.scrollY + rect.bottom + gap) + 'px';
      dom.selectList.style.left = (window.scrollX + rect.left) + 'px';
      dom.selectList.style.width = rect.width + 'px';
    }

    dom.selectBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const willOpen = !dom.selectList.classList.contains('open');
      if (willOpen) {
        positionSelectList();
        dom.selectWrapper.classList.add('open');
        dom.selectList.classList.add('open');
      } else {
        dom.selectWrapper.classList.remove('open');
        dom.selectList.classList.remove('open');
      }
    });

    // 点击其他区域关闭下拉框
    document.addEventListener('click', function() {
      dom.selectWrapper.classList.remove('open');
      dom.selectList.classList.remove('open');
    });

    // 阻止下拉列表冒泡
    dom.selectList.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    // 滚动或窗口变化时，重新定位；过长列表超出可视区域时直接关闭更稳妥
    window.addEventListener('scroll', function() {
      if (dom.selectList.classList.contains('open')) {
        positionSelectList();
      }
    }, { passive: true });
  }

  // 搜索框逻辑（保留你原有）
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', function() {
      const keyword = this.value.toLowerCase().trim();
      const filtered = iconData.filter(icon => icon.name.toLowerCase().includes(keyword));
      renderIcons(filtered);
      resetSelect();
      syncTitleAndGrid();
      if (this.value.trim() === '') {
        this.setAttribute('placeholder', '搜索图标...');
      } else {
        this.removeAttribute('placeholder');
      }
    });
    
    dom.searchIcon.addEventListener('click', function() {
      dom.searchInput.focus();
      const keyword = dom.searchInput.value.toLowerCase().trim();
      const filtered = iconData.filter(icon => icon.name.toLowerCase().includes(keyword));
      renderIcons(filtered);
      resetSelect();
      syncTitleAndGrid();
    });
  }

  // 窗口resize对齐标题
  window.addEventListener('resize', syncTitleAndGrid);
}

// ========== 初始化（整合逻辑，Supabase 优先） ==========
(async function init() {
  await loadIconData(); // 内部已经设置 allCategories + iconData + dbCategories
  renderSelectOptions(); // 生成下拉框
  renderIcons(iconData);  // 渲染图标（内部按解锁状态过滤）
  bindEvents();          // 绑定所有事件
  bindIconPreview();     // 绑定点击放大预览
  syncTitleAndGrid();    // 初始化标题对齐
})();

// 验证按钮动画：移入一次扩散黑底（保持）+ 移出收缩消失（动画）+ 纯正圆
document.addEventListener('DOMContentLoaded', function() {
  const submitBtn = document.querySelector('.auth-submit-btn');
  if (submitBtn) {
    // 仅在【鼠标第一次移入】时记录坐标，触发扩散
    submitBtn.addEventListener('mouseenter', (e) => {
      const rect = submitBtn.getBoundingClientRect();
      // 计算并赋值一次鼠标落点坐标，之后不再更新
      const x = ((e.clientX - rect.left) / rect.width) * 100 + '%';
      const y = ((e.clientY - rect.top) / rect.height) * 100 + '%';
      submitBtn.style.setProperty('--x', x);
      submitBtn.style.setProperty('--y', y);
    });

    // 鼠标移出时无需额外操作，CSS过渡会自动触发收缩动画
    // 点击时复位坐标，确保下次移入重新扩散
    submitBtn.addEventListener('mousedown', () => {
      submitBtn.style.setProperty('--x', '50%');
      submitBtn.style.setProperty('--y', '50%');
    });
  }
});
