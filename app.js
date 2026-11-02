import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ================= 配置区（请修改这里） =================
const SUPABASE_URL = 'https://dghurfubpdiqbrnwdama.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IwYfTgeWF5JQkxViArSPdw_sPg5fE5i';
// ========================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM 元素
const loginView = document.getElementById('login-view');
const portalView = document.getElementById('portal-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userEmailSpan = document.getElementById('user-email');
const displayNameSpan = document.getElementById('display-name');
const sidebarMenu = document.getElementById('sidebar-menu');
const appsContainer = document.getElementById('apps-container');
const themeToggle = document.getElementById('theme-toggle');
const logoutBtn = document.getElementById('logout-btn');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const iframeModal = document.getElementById('iframe-modal');
const modalIframe = document.getElementById('modal-iframe');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.getElementById('modal-close');

let currentUser = null;
let currentApps = [];
let currentPrefs = null;

// ================= 认证逻辑 =================

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    loginError.textContent = '';
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        loginError.textContent = error.message;
    }
});

logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
});

// 监听登录状态
supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        currentUser = session.user;
        loginView.classList.add('hidden');
        portalView.classList.remove('hidden');
        userEmailSpan.textContent = currentUser.email;
        displayNameSpan.textContent = currentUser.email.split('@')[0];
        
        await loadUserData();
    } else {
        currentUser = null;
        loginView.classList.remove('hidden');
        portalView.classList.add('hidden');
        sidebarMenu.innerHTML = '';
        appsContainer.innerHTML = '';
    }
});

// ================= 数据加载与渲染 =================

async function loadUserData() {
    // 1. 加载用户偏好
    const { data: prefs } = await supabase.from('user_prefs').select('*').maybeSingle();
    currentPrefs = prefs || { theme: 'light', sidebar_collapsed: {}, content_collapsed: {} };
    
    applyTheme(currentPrefs.theme);

    // 2. 加载应用列表（RLS 会自动过滤掉无权限的）
    const { data: apps, error } = await supabase.from('apps').select('*').order('sort');
    if (error) {
        console.error('加载应用失败:', error);
        return;
    }
    currentApps = apps || [];
    
    renderSidebar(currentApps);
    renderContent(currentApps);
}

// 新增一个辅助函数，用来区分图片和文字
function getIconHtml(iconStr, isSidebar = false) {
    if (!iconStr) return '📦';
    // 如果是网址，就渲染成图片
    if (iconStr.startsWith('http://') || iconStr.startsWith('https://')) {
        return `<img src="${iconStr}" class="app-icon-img" alt="icon">`;
    }
    // 如果是左侧菜单，且是 Emoji，就照常显示
    return iconStr;
}

// 渲染左侧菜单
function renderSidebar(apps) {
    const groups = {};
    groupApps.forEach(app => {
            const item = document.createElement('a');
            item.className = 'menu-item';
            
            // 左侧菜单为了清爽，如果是图片链接就不显示图片，只显示名字；如果是Emoji就显示
            const iconPrefix = app.icon && !app.icon.startsWith('http') ? `${app.icon} ` : '';
            item.innerHTML = `${iconPrefix}${app.name}`; 
            
            item.onclick = () => openApp(app);
            itemsContainer.appendChild(item);
        });

    sidebarMenu.innerHTML = '';
    for (const [groupName, groupApps] of Object.entries(groups)) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'menu-group';
        
        // 检查数据库中是否记录了折叠状态
        const isCollapsed = currentPrefs?.sidebar_collapsed?.[groupName] === true;
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'menu-group-title';
        // 加上箭头和组名
        titleDiv.innerHTML = `<span class="arrow ${isCollapsed ? 'collapsed' : ''}">▼</span> ${groupName}`;
        
        const itemsContainer = document.createElement('div');
        itemsContainer.className = `menu-group-items ${isCollapsed ? 'hidden-group' : ''}`;

        groupApps.forEach(app => {
            const item = document.createElement('a');
            item.className = 'menu-item';
            item.textContent = `${app.icon} ${app.name}`;
            item.onclick = () => openApp(app);
            itemsContainer.appendChild(item);
        });

        // 点击标题切换折叠状态
        titleDiv.onclick = () => {
            const nowCollapsed = !itemsContainer.classList.contains('hidden-group');
            itemsContainer.classList.toggle('hidden-group');
            titleDiv.querySelector('.arrow').classList.toggle('collapsed', nowCollapsed);
            
            // 存入云存档
            const sidebarPrefs = currentPrefs?.sidebar_collapsed || {};
            sidebarPrefs[groupName] = nowCollapsed;
            savePrefs({ sidebar_collapsed: sidebarPrefs });
        };

        groupDiv.appendChild(titleDiv);
        groupDiv.appendChild(itemsContainer);
        sidebarMenu.appendChild(groupDiv);
    }
}

// 渲染右侧卡片
function renderContent(apps) {
    const groups = {};
    groupApps.forEach(app => {
            const card = document.createElement('div');
            card.className = 'app-card';
            card.onclick = () => openApp(app);
            
            // 使用辅助函数渲染图标
            card.innerHTML = `
                <div class="card-icon-wrapper">${getIconHtml(app.icon)}</div>
                <div class="app-name">${app.name}</div>
                <div class="app-desc">${app.description || '暂无描述'}</div>
            `;
            grid.appendChild(card);
        });

    appsContainer.innerHTML = '';
    for (const [groupName, groupApps] of Object.entries(groups)) {
        const section = document.createElement('div');
        section.className = 'app-group-section';
        
        // 检查数据库中是否记录了折叠状态
        const isCollapsed = currentPrefs?.content_collapsed?.[groupName] === true;

        const title = document.createElement('h3');
        title.innerHTML = `<span class="arrow ${isCollapsed ? 'collapsed' : ''}">▼</span> ${groupName}`;
        section.appendChild(title);

        const grid = document.createElement('div');
        grid.className = `card-grid ${isCollapsed ? 'hidden-group' : ''}`;

        groupApps.forEach(app => {
            const card = document.createElement('div');
            card.className = 'app-card';
            card.onclick = () => openApp(app);
            
            card.innerHTML = `
                <div class="app-icon">${app.icon || '📦'}</div>
                <div class="app-name">${app.name}</div>
                <div class="app-desc">${app.description || '暂无描述'}</div>
            `;
            grid.appendChild(card);
        });

        // 点击标题切换折叠状态
        title.onclick = () => {
            const nowCollapsed = !grid.classList.contains('hidden-group');
            grid.classList.toggle('hidden-group');
            title.querySelector('.arrow').classList.toggle('collapsed', nowCollapsed);

            // 存入云存档
            const contentPrefs = currentPrefs?.content_collapsed || {};
            contentPrefs[groupName] = nowCollapsed;
            savePrefs({ content_collapsed: contentPrefs });
        };

        section.appendChild(grid);
        appsContainer.appendChild(section);
    }
}

// ================= 交互逻辑 =================

// 打开应用
function openApp(app) {
    // 移动端点击后关闭侧边栏
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.add('hidden');
    }

    // 记录最近访问（可选，后续扩展）
    // saveRecent(app.id);

    if (app.open_mode === 'iframe') {
        modalTitle.textContent = app.name;
        modalIframe.src = app.url;
        iframeModal.classList.remove('hidden');
    } else {
        window.open(app.url, '_blank', 'noopener');
    }
}

// 主题切换
themeToggle.addEventListener('click', () => {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    savePrefs({ theme: newTheme });
});

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

async function savePrefs(patch) {
    if (!currentUser) return;
    await supabase.from('user_prefs').upsert({
        user_id: currentUser.id,
        ...patch,
        updated_at: new Date().toISOString()
    });
    // 更新本地状态
    currentPrefs = { ...currentPrefs, ...patch };
}

// 移动端侧边栏控制 & 桌面端侧边栏收起
menuToggle.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        // 手机端逻辑：滑出覆盖
        sidebar.classList.add('open');
        sidebarOverlay.classList.remove('hidden');
    } else {
        // 电脑端逻辑：整条侧边栏收起/展开
        sidebar.classList.toggle('collapsed');
    }
});

sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.add('hidden');
});

// 关闭 iframe 弹窗
modalClose.addEventListener('click', () => {
    iframeModal.classList.add('hidden');
    modalIframe.src = ''; // 清空以停止加载
});
