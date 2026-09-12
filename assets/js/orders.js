import { appState, isBoss, supabaseClient, getConfig } from './supabase.js';
import { statusClass } from './dashboard.js';
import {
  $, closeModal, debounce, emptyState, errorMessage, escapeHtml, formatDate, formatMoney,
  openModal, paginate, pick, readSpreadsheet, renderPagination, setButtonLoading,
  showToast, wireModalDismiss
} from './utils.js';

export async function initOrders(root) {
  const state = { rows: [], customers: [], profiles: [], page: 1, search: '', status: '' };
  const pageSize = Number(getConfig().PAGE_SIZE) || 10;
  wireModalDismiss(root);

  async function loadReferences() {
    const [{ data: customers, error: customerError }, profilesResult] = await Promise.all([
      supabaseClient.from('customers').select('id,company,owner_id').order('company'),
      isBoss() ? supabaseClient.from('profiles').select('user_id,name,username,role').order('name') : Promise.resolve({ data: [], error: null })
    ]);
    if (customerError) throw customerError;
    if (profilesResult.error) throw profilesResult.error;
    state.customers = customers || [];
    state.profiles = profilesResult.data || [];
    $('#order-customer', root).innerHTML = '<option value="">请选择客户</option>' + state.customers.map(item => `<option value="${item.id}">${escapeHtml(item.company)}</option>`).join('');
    if (isBoss()) {
      const sales = state.profiles.filter(item => item.role === 'sales');
      $('#order-owner', root).innerHTML = sales.map(item => `<option value="${escapeHtml(item.user_id)}">${escapeHtml(item.name || item.username)} (${escapeHtml(item.username)})</option>`).join('');
      $('#order-owner-field', root).classList.remove('is-hidden');
    }
  }

  async function load() {
    const { data, error } = await supabaseClient.from('orders').select('*').order('created_at', { ascending: false });
    if (error) {
      $('#order-list', root).innerHTML = `<p class="inline-error">${escapeHtml(errorMessage(error))}</p>`;
      return;
    }
    state.rows = data || [];
    render();
  }

  const customerName = id => state.customers.find(item => String(item.id) === String(id))?.company || '—';
  const ownerName = id => state.profiles.find(item => item.user_id === id)?.name || state.profiles.find(item => item.user_id === id)?.username || (id === appState.user.id ? (appState.profile.name || appState.profile.username) : '—');

  function filteredRows() {
    const q = state.search.toLowerCase();
    return state.rows.filter(row => {
      const matchesSearch = !q || [row.order_no, row.product, row.status, row.remark, customerName(row.customer_id), ownerName(row.owner_id)].some(value => String(value || '').toLowerCase().includes(q));
      return matchesSearch && (!state.status || (row.status || '待确认') === state.status);
    });
  }

  function render() {
    const rows = filteredRows();
    const paged = paginate(rows, state.page, pageSize);
    state.page = paged.page;
    $('#order-summary', root).textContent = `共 ${rows.length} 笔订单${isBoss() ? ' · 公司全局数据' : ' · 当前负责人名下'}`;
    const list = $('#order-list', root);
    if (!paged.items.length) {
      list.innerHTML = emptyState(state.search || state.status ? '没有匹配的订单' : '还没有订单', state.search || state.status ? '请调整搜索或筛选条件。' : '点击“新增订单”登记第一笔业务。', '▣');
    } else {
      list.innerHTML = `
        <div class="table-wrap"><table><thead><tr><th>订单编号</th><th>客户 / 产品</th><th>数量</th><th>金额</th><th>状态</th><th>负责人</th><th>日期</th><th>操作</th></tr></thead><tbody>
        ${paged.items.map(row => `<tr><td><strong>${escapeHtml(row.order_no || '—')}</strong></td><td>${escapeHtml(customerName(row.customer_id))}<small>${escapeHtml(row.product || '—')}</small></td><td>${escapeHtml(row.quantity ?? '—')}</td><td><strong>${formatMoney(row.amount)}</strong></td><td><span class="status-tag status-tag--${statusClass(row.status)}">${escapeHtml(row.status || '待确认')}</span></td><td>${escapeHtml(ownerName(row.owner_id))}</td><td>${formatDate(row.created_at)}</td><td><div class="row-actions"><button data-edit-order="${row.id}" type="button">编辑</button><button class="danger-link" data-delete-order="${row.id}" type="button">删除</button></div></td></tr>`).join('')}
        </tbody></table></div>
        <div class="mobile-card-list">${paged.items.map(row => `<article class="record-card"><header><div><strong>${escapeHtml(row.order_no || '未编号订单')}</strong><span>${escapeHtml(customerName(row.customer_id))}</span></div><span class="status-tag status-tag--${statusClass(row.status)}">${escapeHtml(row.status || '待确认')}</span></header><dl><div><dt>产品</dt><dd>${escapeHtml(row.product || '—')}</dd></div><div><dt>数量</dt><dd>${escapeHtml(row.quantity ?? '—')}</dd></div><div><dt>金额</dt><dd>${formatMoney(row.amount)}</dd></div><div><dt>负责人</dt><dd>${escapeHtml(ownerName(row.owner_id))}</dd></div></dl><footer><button data-edit-order="${row.id}" type="button">编辑</button><button class="danger-link" data-delete-order="${row.id}" type="button">删除</button></footer></article>`).join('')}</div>`;
    }
    renderPagination($('#order-pagination', root), paged.page, paged.totalPages, page => { state.page = page; render(); });
  }

  function openEditor(row = null) {
    $('#order-modal-title', root).textContent = row ? '编辑订单' : '新增订单';
    $('#order-id', root).value = row?.id || '';
    $('#order-no', root).value = row?.order_no || '';
    $('#order-customer', root).value = row?.customer_id || '';
    $('#order-product', root).value = row?.product || '';
    $('#order-quantity', root).value = row?.quantity ?? '';
    $('#order-amount', root).value = row?.amount ?? '';
    $('#order-status', root).value = row?.status || '待确认';
    $('#order-remark', root).value = row?.remark || '';
    if (isBoss() && $('#order-owner', root).options.length) $('#order-owner', root).value = row?.owner_id || $('#order-owner', root).options[0].value;
    openModal('order-modal');
  }

  $('#order-add', root).addEventListener('click', () => {
    if (!state.customers.length) return showToast('请先新增客户，再创建订单', 'info');
    openEditor();
  });
  $('#order-search', root).addEventListener('input', debounce(event => { state.search = event.target.value.trim(); state.page = 1; render(); }));
  $('#order-status-filter', root).addEventListener('change', event => { state.status = event.target.value; state.page = 1; render(); });
  $('#order-import', root).addEventListener('click', () => $('#order-import-input', root).click());
  $('#order-import-input', root).addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    const button = $('#order-import', root); setButtonLoading(button, true, '正在导入…');
    try {
      const sheetRows = await readSpreadsheet(file);
      const customerByName = new Map(state.customers.map(item => [item.company.toLowerCase(), item]));
      const profileByUsername = new Map(state.profiles.map(item => [String(item.username).toUpperCase(), item.user_id]));
      const payload = sheetRows.map(row => {
        const company = pick(row, ['客户', '客户名称', '公司名称', 'company']).toLowerCase();
        const customer = customerByName.get(company);
        return {
          order_no: pick(row, ['订单编号', '订单号', 'order_no']), customer_id: customer?.id || null,
          product: pick(row, ['产品', '产品名称', 'product']), quantity: Number(pick(row, ['数量', 'quantity'])) || 0,
          amount: Number(String(pick(row, ['金额', 'amount'])).replaceAll(',', '')) || 0,
          status: pick(row, ['状态', 'status']) || '待确认', remark: pick(row, ['备注', 'remark']) || null,
          owner_id: isBoss() ? (profileByUsername.get(pick(row, ['负责人账号', '负责人', 'owner']).toUpperCase()) || customer?.owner_id || appState.user.id) : appState.user.id
        };
      }).filter(row => row.order_no && row.product && row.customer_id);
      if (!payload.length) throw new Error('未找到有效数据，请检查“订单编号、客户、产品”列，且客户须已存在');
      const { error } = await supabaseClient.from('orders').insert(payload);
      if (error) throw error;
      showToast(`成功导入 ${payload.length} 笔订单`); await load();
    } catch (error) { showToast(errorMessage(error, '导入失败'), 'error'); }
    finally { setButtonLoading(button, false); }
  });

  $('#order-form', root).addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('#order-id', root).value;
    const payload = {
      order_no: $('#order-no', root).value.trim(), customer_id: Number($('#order-customer', root).value),
      product: $('#order-product', root).value.trim(), quantity: Number($('#order-quantity', root).value) || 0,
      amount: Number($('#order-amount', root).value) || 0, status: $('#order-status', root).value,
      remark: $('#order-remark', root).value.trim() || null,
      owner_id: isBoss() ? $('#order-owner', root).value : appState.user.id
    };
    const button = $('#order-save', root); setButtonLoading(button, true, '正在保存…');
    const query = id ? supabaseClient.from('orders').update(payload).eq('id', id) : supabaseClient.from('orders').insert(payload);
    const { error } = await query; setButtonLoading(button, false);
    if (error) return showToast(errorMessage(error), 'error');
    closeModal('order-modal'); showToast(id ? '订单信息已更新' : '订单已新增'); await load();
  });

  root.addEventListener('click', async event => {
    const edit = event.target.closest('[data-edit-order]');
    if (edit) openEditor(state.rows.find(row => String(row.id) === edit.dataset.editOrder));
    const remove = event.target.closest('[data-delete-order]');
    if (remove) {
      const row = state.rows.find(item => String(item.id) === remove.dataset.deleteOrder);
      if (!confirm(`确定删除订单“${row?.order_no || ''}”吗？此操作无法撤销。`)) return;
      const { error } = await supabaseClient.from('orders').delete().eq('id', remove.dataset.deleteOrder);
      if (error) return showToast(errorMessage(error), 'error');
      showToast('订单已删除'); await load();
    }
  });

  try { await loadReferences(); } catch (error) { showToast(errorMessage(error), 'error'); }
  await load();
}
