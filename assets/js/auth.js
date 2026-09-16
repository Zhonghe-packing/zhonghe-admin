import { appState, isConfigured, supabaseClient, getConfig } from './supabase.js';
import { startRouter, stopRouter, navigate } from './router.js?v=20260916-2';
import { $, $$, errorMessage, initials, roleLabel, setButtonLoading } from './utils.js';

const loading = $('#app-loading');
const loginView = $('#login-view');
const appView = $('#app-view');
const loginForm = $('#login-form');
const loginError = $('#login-error');
const loginButton = $('#login-button');

function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('is-hidden');
}

function clearError() {
  loginError.textContent = '';
  loginError.classList.add('is-hidden');
}

function showLogin() {
  loading.classList.add('is-hidden');
  appView.classList.add('is-hidden');
  loginView.classList.remove('is-hidden');
  $('#password').value = '';
  setTimeout(() => $('#username').focus(), 50);
}

async function loadProfile(user) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id,user_id,name,role,username,created_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('该账号尚未配置人员档案，请联系管理员');
  return data;
}

async function showApplication(session) {
  try {
    const profile = await loadProfile(session.user);
    appState.session = session;
    appState.user = session.user;
    appState.profile = profile;

    const displayName = profile.name || profile.username || '众和员工';
    const avatarText = initials(displayName);
    $('#sidebar-name').textContent = displayName;
    $('#sidebar-role').textContent = roleLabel(profile.role);
    $('#sidebar-avatar').textContent = avatarText;
    $$('.mobile-avatar').forEach(el => { el.textContent = avatarText; });
    $('#topbar-date').textContent = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    }).format(new Date());

    loading.classList.add('is-hidden');
    loginView.classList.add('is-hidden');
    appView.classList.remove('is-hidden');
    clearError();
    startRouter();
  } catch (error) {
    await supabaseClient.auth.signOut();
    showLogin();
    showError(errorMessage(error));
  }
}

async function signOut() {
  stopRouter();
  if (supabaseClient) await supabaseClient.auth.signOut();
  Object.assign(appState, { session: null, user: null, profile: null });
  location.hash = '';
  showLogin();
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearError();
  const username = $('#username').value.trim().toUpperCase();
  const password = $('#password').value;

  if (!isConfigured) {
    showError('系统尚未连接 Supabase，请先在 assets/js/config.js 填写项目地址和 anon key');
    return;
  }
  if (!/^[A-Z0-9_-]{1,32}$/.test(username)) {
    showError('请输入正确的公司账号');
    return;
  }
  if (!password) {
    showError('请输入密码');
    return;
  }

  setButtonLoading(loginButton, true, '正在登录…');
  const email = `${username}@${getConfig().AUTH_EMAIL_DOMAIN || 'zhonghe.local'}`;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  setButtonLoading(loginButton, false);

  if (error) {
    const message = /Invalid login credentials/i.test(error.message)
      ? '账号或密码错误，请重新输入'
      : errorMessage(error, '登录失败，请稍后重试');
    showError(message);
    return;
  }
  await showApplication(data.session);
});

$('#toggle-password').addEventListener('click', event => {
  const input = $('#password');
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  event.currentTarget.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
});

document.addEventListener('click', event => {
  if (event.target.closest('[data-action="logout"]')) signOut();
  if (event.target.closest('[data-action="profile"]')) navigate('profile');
});
document.addEventListener('zh:logout', signOut);

async function bootstrap() {
  if (!isConfigured) {
    showLogin();
    return;
  }
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) showLogin();
  else await showApplication(data.session);

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !loginView.classList.contains('is-hidden')) return;
    if (event === 'SIGNED_OUT') showLogin();
    if (event === 'TOKEN_REFRESHED') appState.session = session;
  });
}

bootstrap();
