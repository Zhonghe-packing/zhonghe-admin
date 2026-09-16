import { appState } from './supabase.js';
import { $, $$ } from './utils.js';
import { initDashboard, initStatistics } from './dashboard.js';
import { initCustomers } from './customers.js?v=20260916-2';
import { initOrders } from './orders.js?v=20260916-2';
import { initFiles } from './files.js?v=20260916-2';

const routes = {
  dashboard: { title: '首页', file: 'dashboard.html', init: initDashboard },
  customers: { title: '客户管理', file: 'customers.html', init: initCustomers },
  orders: { title: '订单管理', file: 'orders.html', init: initOrders },
  files: { title: '资料归档', file: 'files.html', init: initFiles },
  statistics: { title: '数据统计', file: 'statistics.html', init: initStatistics },
  profile: { title: '个人中心', file: 'profile.html', init: initProfile }
};

let started = false;

function routeName() {
  const name = location.hash.replace(/^#\//, '').split(/[/?]/)[0];
  return routes[name] ? name : 'dashboard';
}

async function loadRoute() {
  const name = routeName();
  const route = routes[name];
  const content = $('#page-content');
  if (!content) return;

  if (typeof appState.routeCleanup === 'function') {
    appState.routeCleanup();
    appState.routeCleanup = null;
  }

  appState.route = name;
  $('#topbar-title').textContent = route.title;
  $$('[data-route]').forEach(link => link.classList.toggle('is-active', link.dataset.route === name));
  content.innerHTML = '<div class="page-loader"><span class="spinner spinner--blue"></span><p>正在加载…</p></div>';

  try {
    const url = new URL(`./pages/${route.file}?v=20260916-2`, document.baseURI);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`页面加载失败 (${response.status})`);
    content.innerHTML = await response.text();
    window.scrollTo({ top: 0, behavior: 'instant' });
    appState.routeCleanup = await route.init?.(content) || null;
  } catch (error) {
    content.innerHTML = `<div class="fatal-state"><span>!</span><h2>页面暂时无法加载</h2><p>${error.message}</p><button type="button" onclick="location.reload()">刷新页面</button></div>`;
  }
}

function initProfile(root) {
  const profile = appState.profile || {};
  const user = appState.user || {};
  const avatar = root.querySelector('#profile-avatar');
  const name = profile.name || profile.username || '众和员工';
  avatar.textContent = name.slice(0, 2).toUpperCase();
  root.querySelector('#profile-name').textContent = name;
  root.querySelector('#profile-username').textContent = profile.username || '—';
  root.querySelector('#profile-role').textContent = profile.role === 'boss' ? '管理账号' : '销售账号';
  root.querySelector('#profile-role-detail').textContent = profile.role === 'boss' ? '管理账号（boss）' : '销售账号（sales）';
  root.querySelector('#profile-last-login').textContent = user.last_sign_in_at
    ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(user.last_sign_in_at))
    : '—';
  root.querySelector('[data-profile-logout]')?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('zh:logout')));
}

export function startRouter() {
  if (!started) {
    window.addEventListener('hashchange', loadRoute);
    started = true;
  }
  if (!location.hash || !routes[routeName()]) location.hash = '#/dashboard';
  else loadRoute();
}

export function stopRouter() {
  if (typeof appState.routeCleanup === 'function') appState.routeCleanup();
  appState.routeCleanup = null;
  appState.route = null;
}

export function navigate(route) {
  location.hash = `#/${routes[route] ? route : 'dashboard'}`;
}
