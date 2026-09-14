export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {})
  }).format(date).replaceAll('/', '-');
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(amount)
    : escapeHtml(value);
}

export function initials(name = 'ZH') {
  const text = String(name).trim();
  return text ? text.slice(0, 2).toUpperCase() : 'ZH';
}

export function roleLabel(role) {
  return role === 'boss' ? '管理账号' : '销售账号';
}

export function showToast(message, type = 'success') {
  const region = $('#toast-region');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}</span><p>${escapeHtml(message)}</p>`;
  region.append(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

export function setButtonLoading(button, loading, label = '处理中…') {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span>${label}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
  }
}

export function debounce(fn, delay = 240) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  setTimeout(() => modal.querySelector('input, select, textarea, button')?.focus(), 40);
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

export function wireModalDismiss(root = document) {
  root.querySelectorAll('[data-close-modal]').forEach(button => {
    button.addEventListener('click', () => closeModal(button.dataset.closeModal));
  });
  root.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal(modal.id);
    });
  });
}

export function paginate(items, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return { page: safePage, totalPages, items: items.slice(start, start + pageSize) };
}

export function renderPagination(container, page, totalPages, onChange) {
  if (!container) return;
  container.innerHTML = `
    <button type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
    <span>第 ${page} / ${totalPages} 页</span>
    <button type="button" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>下一页</button>`;
  container.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => onChange(Number(button.dataset.page)));
  });
}

export function emptyState(title, detail, icon = '◇') {
  return `<div class="empty-state"><span>${icon}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p></div>`;
}

export function errorMessage(error, fallback = '操作失败，请稍后重试') {
  const message = error?.message || fallback;
  if (/row-level security|policy/i.test(message)) return '权限策略拒绝了本次操作，请联系管理员检查 RLS 设置';
  if (/infinite recursion/i.test(message)) return '权限表策略发生递归，请管理员按项目检查清单修复 profiles 策略';
  if (/duplicate key/i.test(message)) return '该编号或记录已存在，请检查后重试';
  if (/invalid key/i.test(message)) return '文件存储路径无效，请刷新到最新版本后重新上传';
  if (/Failed to fetch|NetworkError/i.test(message)) return '网络连接失败，请检查网络后重试';
  return message;
}

export function safeFileName(name) {
  const value = String(name || '');
  const dot = value.lastIndexOf('.');
  const extension = dot >= 0
    ? value.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
    : '';

  // Storage 对象键只使用 ASCII。原始中文文件名仍保存于 files.file_name，
  // 因此列表显示和下载名称都不会改变。
  return extension ? `file.${extension}` : 'file';
}

export function readSpreadsheet(file) {
  return new Promise((resolve, reject) => {
    if (!window.XLSX) return reject(new Error('Excel 组件加载失败，请检查网络后刷新页面'));
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const workbook = window.XLSX.read(event.target.result, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(window.XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }));
      } catch (error) { reject(error); }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

export function pick(row, aliases) {
  for (const key of aliases) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return String(row[key]).trim();
  }
  return '';
}
