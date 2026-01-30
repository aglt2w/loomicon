// 加这1行：函数提升声明，消除浏览器未定义警告
function checkAuthStatus() {};

// ########## 仅需修改这行：你的内部验证密码 ##########
const AUTH_PASSWORD = "loomicon123"; 
// ###################################################

// 页面加载时先校验7天免密状态，有效则直接显示内部分类
checkAuthStatus();

// 获取所有密码验证相关元素
const authBtn = document.querySelector('.auth-btn');
const authModal = document.querySelector('.auth-modal');
const authCloseBtn = document.querySelector('.auth-close-btn');
const authInput = document.querySelector('.auth-input');
const authError = document.querySelector('.auth-error');
const authRemember = document.querySelector('.auth-remember input');
const authSubmitBtn = document.querySelector('.auth-submit-btn');
const authMask = document.querySelector('.auth-modal-mask');

// 1. 打开密码弹窗：修复动画触发（先显示→延迟加show类）
authBtn.addEventListener('click', () => {
  authModal.style.display = 'block'; // 第一步：先显示弹窗，让元素渲染
  // 新增：延迟10毫秒加show类，触发动画（浏览器完成渲染后执行）
  setTimeout(() => {
    authModal.classList.add('show');
  }, 10);
  authInput.focus();
  authInput.value = '';
  authError.textContent = '';
});

// 2. 关闭弹窗通用方法：修复反向动画（先删show类→动画结束后隐藏）
function closeAuthModal() {
  authModal.classList.remove('show'); // 第一步：删show类，执行反向动画
  // 新增：延迟300毫秒（和CSS动画时长一致），动画结束后再隐藏弹窗
  setTimeout(() => {
    authModal.style.display = 'none';
  }, 200);
  authInput.value = '';
  authError.textContent = '';
  authRemember.checked = false;
}

// 点击关闭按钮/遮罩层/ESC键，关闭弹窗
authCloseBtn.addEventListener('click', closeAuthModal);
authMask.addEventListener('click', closeAuthModal);
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeAuthModal());

// 回车/点击按钮，触发密码验证
authInput.addEventListener('keydown', (e) => e.key === 'Enter' && submitAuth());
authSubmitBtn.addEventListener('click', submitAuth);

// 密码验证核心逻辑
function submitAuth() {
  const inputPwd = authInput.value.trim();
  // 密码错误提示
  if (inputPwd !== AUTH_PASSWORD) {
    authError.textContent = '密码错误，请重新输入';
    authInput.focus();
    return;
  }
  // 密码正确：授权通过，显示内部分类
  authSuccess();
  closeAuthModal();
}

// 授权成功：给body加标识 + 存储7天免密状态（若勾选）
function authSuccess() {
  document.body.classList.add('auth-ok');
  if (authRemember.checked) {
    // 存储：授权状态 + 7天后的过期时间戳
    const expireTime = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem('loomIconAuth', JSON.stringify({
      isAuth: true,
      expireTime: expireTime
    }));
  }
}

// 页面加载校验：判断免密状态是否有效
function checkAuthStatus() {
  const authCache = localStorage.getItem('loomIconAuth');
  if (!authCache) return;

  try {
    const { isAuth, expireTime } = JSON.parse(authCache);
    // 状态有效且未过期，自动授权
    if (isAuth && new Date().getTime() < expireTime) {
      document.body.classList.add('auth-ok');
    } else {
      // 过期则清除缓存
      localStorage.removeItem('loomIconAuth');
    }
  } catch (e) {
    // 缓存异常，清除缓存
    localStorage.removeItem('loomIconAuth');
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

// ========== 核心：恢复加载你的icon-list.json（去掉模拟数据） ==========
async function loadIconData() {
  try {
    // 读取你离线打包的JSON文件（保留你原有路径）
    const listRes = await fetch('./icon-list.json');
    if (!listRes.ok) throw new Error(`读取清单失败：${listRes.status}`);
    const iconList = await listRes.json();
    
    // 直接映射你JSON里的字段，不修改任何数据
    iconData = iconList.map(item => ({
      name: item.name,          // 匹配你JSON里的name字段
      svg: item.svg,            // 匹配你JSON里的svg字段（完整SVG代码）
      category: item.category   // 匹配你JSON里的category字段
    }));

    console.log(`✅ 你的图标加载完成！共${iconData.length}个`);
  } catch (err) {
    console.error("加载图标失败:", err);
    // 仅兜底，不会覆盖你的数据
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
  
  // 下载按钮逻辑（保留你原有）
  card.querySelector('.download-btn').addEventListener('click', function() {
    const name = this.dataset.name;
    const svg = decodeURIComponent(this.dataset.svg);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
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
  // 下拉框展开/收起（修复后逻辑）
  if (dom.selectBtn && dom.selectWrapper) {
    dom.selectBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      dom.selectWrapper.classList.toggle('open');
    });
    
    // 点击其他区域关闭下拉框
    document.addEventListener('click', function() {
      dom.selectWrapper.classList.remove('open');
    });
    
    // 阻止下拉列表冒泡
    dom.selectList.addEventListener('click', function(e) {
      e.stopPropagation();
    });
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

// ========== 初始化（整合逻辑，确保加载你的JSON） ==========
(async function init() {
  await loadIconData(); // 加载你的icon-list.json
  allCategories = ['全部图标', ...new Set(iconData.map(item => item.category))]; // 提取你的分类
  renderSelectOptions(); // 生成修复后的下拉框
  renderIcons(iconData); // 渲染你的图标
  bindEvents(); // 绑定所有事件
  syncTitleAndGrid(); // 初始化标题对齐
})();