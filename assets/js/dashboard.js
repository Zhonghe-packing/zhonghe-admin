import { appState, isBoss, supabaseClient } from './supabase.js';
import { emptyState, errorMessage, escapeHtml, formatDate, formatMoney } from './utils.js';

async function exactCount(table) {
  const { count, error } = await supabaseClient.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

export async function initDashboard(root) {
  root.querySelector('#welcome-name').textContent = appState.profile?.name || appState.profile?.username || '众和同事';
  root.querySelector('#welcome-role').textContent = isBoss() ? '管理账号 · 全局视图' : '销售账号 · 我的业务';

  const countEls = {
    customers: root.querySelector('#customer-count'),
    orders: root.querySelector('#order-count'),
    files: root.querySelector('#file-count')
  };

  const results = await Promise.allSettled([
    exactCount('customers'), exactCount('orders'), exactCount('files')
  ]);
  ['customers', 'orders', 'files'].forEach((key, index) => {
    countEls[key].textContent = results[index].status === 'fulfilled' ? results[index].value : '—';
  });

  const recent = root.querySelector('#recent-orders');
  const { data, error } = await supabaseClient
    .from('orders')
    .select('id,order_no,product,amount,status,created_at,customer_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    recent.innerHTML = `<p class="inline-error">${escapeHtml(errorMessage(error))}</p>`;
    return;
  }
  if (!data?.length) {
    recent.innerHTML = emptyState('还没有订单', '新增第一笔订单后，会显示在这里。', '▣');
    return;
  }

  const customerIds = [...new Set(data.map(item => item.customer_id).filter(Boolean))];
  let customerMap = new Map();
  if (customerIds.length) {
    const { data: customers } = await supabaseClient.from('customers').select('id,company').in('id', customerIds);
    customerMap = new Map((customers || []).map(item => [String(item.id), item.company]));
  }
  recent.innerHTML = data.map(order => `
    <a class="recent-order" href="#/orders">
      <span class="recent-order__icon">▣</span>
      <div><strong>${escapeHtml(order.order_no || '未编号订单')}</strong><small>${escapeHtml(customerMap.get(String(order.customer_id)) || order.product || '未关联客户')}</small></div>
      <div class="recent-order__meta"><strong>${formatMoney(order.amount)}</strong><small>${formatDate(order.created_at)}</small></div>
      <span class="status-tag status-tag--${statusClass(order.status)}">${escapeHtml(order.status || '待确认')}</span>
    </a>`).join('');
}

export async function initStatistics(root) {
  root.querySelector('#statistics-scope').textContent = isBoss()
    ? '汇总公司全部可见客户、订单与销售账号。'
    : '仅汇总当前账号负责的客户与订单。';

  const tasks = [exactCount('customers'), exactCount('orders')];
  if (isBoss()) {
    tasks.push((async () => {
      const { count, error } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'sales');
      if (error) throw error;
      return count || 0;
    })());
  }
  const counts = await Promise.allSettled(tasks);
  const items = [
    ['客户总数', counts[0].status === 'fulfilled' ? counts[0].value : '—', '◎', 'blue'],
    ['订单总数', counts[1].status === 'fulfilled' ? counts[1].value : '—', '▣', 'cyan']
  ];
  if (isBoss()) items.push(['销售数量', counts[2].status === 'fulfilled' ? counts[2].value : '—', '○', 'indigo']);
  root.querySelector('#statistics-metrics').innerHTML = items.map(([label, value, icon, color]) => `
    <article class="metric-card metric-card--${color}"><div class="metric-icon">${icon}</div><div><p>${label}</p><strong>${value}</strong><span>实时数据</span></div></article>`).join('');

  const { data, error } = await supabaseClient.from('orders').select('status');
  const bars = root.querySelector('#status-bars');
  if (error) {
    bars.innerHTML = `<p class="inline-error">${escapeHtml(errorMessage(error))}</p>`;
    return;
  }
  const statuses = ['待确认', '进行中', '已完成', '已取消'];
  const total = data?.length || 0;
  bars.innerHTML = statuses.map(status => {
    const count = (data || []).filter(row => (row.status || '待确认') === status).length;
    const percent = total ? Math.round(count / total * 100) : 0;
    return `<div class="status-bar"><div><span>${status}</span><strong>${count}</strong></div><div class="bar-track"><i class="bar-fill bar-fill--${statusClass(status)}" style="width:${percent}%"></i></div><small>${percent}%</small></div>`;
  }).join('');
}

export function statusClass(status = '') {
  return ({ '待确认': 'pending', '进行中': 'progress', '已完成': 'done', '已取消': 'cancelled' })[status] || 'pending';
}
