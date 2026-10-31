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
    currentPrefs = prefs || { theme: 'light', sidebar_collapsed: {} };
    
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

// 渲染左侧菜单
function renderSidebar(apps) {
    const groups = {};
    apps.forEach(app => {
        if (!groups[app.group_name]) groups[app.group_name] = [];
        groups[app.group_name].push(app);
    });

    sidebarMenu.innerHTML = '';
    for (const [groupName, groupApps] of Object.entries(groups)) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'menu-group';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'menu-group-title';
        titleDiv.textContent = groupName;
        groupDiv.appendChild(titleDiv);

        groupApps.forEach(app => {
            const item = document.createElement('a');
            item.className = 'menu-item';
            item.textContent = `${app.icon} ${app.name}`;
            item.onclick = () => openApp(app);
            groupDiv.appendChild(item);
        });
        sidebarMenu.appendChild(groupDiv);
    }
}

// 渲染右侧卡片
function renderContent(apps) {
    const groups = {};
    apps.forEach(app => {
        if (!groups[app.group_name]) groups[app.group_name] = [];
        groups[app.group_name].push(app);
    });

    appsContainer.innerHTML = '';
    for (const [groupName, groupApps] of Object.entries(groups)) {
        const section = document.createElement('div');
        section.className = 'app-group-section';
        
        const title = document.createElement('h3');
        title.textContent = groupName;
        section.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'card-grid';

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

// 移动端侧边栏控制
menuToggle.addEventListener('click', () => {
    sidebar.classList.add('open');
    sidebarOverlay.classList.remove('hidden');
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