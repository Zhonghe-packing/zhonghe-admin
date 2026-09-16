import { appState, isBoss, supabaseClient, getConfig } from './supabase.js';
import { statusClass } from './dashboard.js';
import {
  $, closeModal, debounce, emptyState, errorMessage, escapeHtml, formatDate, formatMoney,
  openModal, paginate, renderPagination, setButtonLoading,
  showToast, wireModalDismiss
} from './utils.js';
import { importCustomersAndOrders, importSummaryText } from './importer.js?v=20260916-1';

export async function initOrders(root) {
  const state = {
    rows: [], customers: [], profiles: [], page: 1, search: '', status: '',
    selectedCustomerId: null, newCustomerMode: false
  };
  const pageSize = Number(getConfig().PAGE_SIZE) || 10;
  wireModalDismiss(root);

  async function loadReferences() {
    const [{ data: customers, error: customerError }, profilesResult] = await Promise.all([
      supabaseClient.from('customers').select('id,company,contact,phone,email,country,address,owner_id').order('company'),
      isBoss() ? supabaseClient.from('profiles').select('user_id,name,username,role').order('name') : Promise.resolve({ data: [], error: null })
    ]);
    if (customerError) throw customerError;
    if (profilesResult.error) throw profilesResult.error;
    state.customers = customers || [];
    state.profiles = profilesResult.data || [];
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

  const normalizeCompany = value => String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·•,，.。()（）\-—_]+/g, '');

  function setOwnerForCustomer(customer = null) {
    if (!isBoss()) return;
    const select = $('#order-owner', root);
    if (customer?.owner_id) select.value = customer.owner_id;
    select.disabled = Boolean(customer);
    $('#order-owner-hint', root).textContent = customer
      ? `负责人继承自客户：${ownerName(customer.owner_id)}`
      : '新客户与订单将归属同一负责人';
  }

  function clearCustomerSelection(keepSearch = true) {
    state.selectedCustomerId = null;
    $('#order-customer', root).value = '';
    $('#order-selected-customer', root).classList.add('is-hidden');
    $('#order-selected-customer', root).innerHTML = '';
    if (!keepSearch) $('#order-customer-search', root).value = '';
    setOwnerForCustomer(null);
  }

  function selectCustomer(customer) {
    state.newCustomerMode = false;
    state.selectedCustomerId = customer.id;
    $('#order-customer', root).value = customer.id;
    $('#order-customer-search', root).value = customer.company;
    $('#order-customer-results', root).classList.add('is-hidden');
    $('#order-new-customer-fields', root).classList.add('is-hidden');
    $('#order-customer-duplicate', root).classList.add('is-hidden');
    const missing = [customer.contact, customer.phone, customer.email, customer.address].filter(Boolean).length < 2;
    const selected = $('#order-selected-customer', root);
    selected.innerHTML = `
      <div><strong>${escapeHtml(customer.company)}</strong><small>${escapeHtml(customer.contact || '联系人待补充')} · ${escapeHtml(customer.phone || customer.email || '联系方式待补充')}</small></div>
      ${missing ? '<span class="incomplete-chip">资料待补充</span>' : '<span class="complete-chip">已有客户</span>'}
      <button id="order-change-customer" type="button">更换</button>`;
    selected.classList.remove('is-hidden');
    setOwnerForCustomer(customer);
  }

  function findCustomers(query) {
    const q = String(query || '').trim().toLowerCase();
    const normalized = normalizeCompany(q);
    if (!q) return [];
    return state.customers.filter(customer => {
      const fields = [customer.company, customer.contact, customer.phone, customer.email];
      return fields.some(value => String(value || '').toLowerCase().includes(q))
        || normalizeCompany(customer.company).includes(normalized);
    }).slice(0, 7);
  }

  function renderCustomerMatches(query) {
    const matches = findCustomers(query);
    const results = $('#order-customer-results', root);
    if (!String(query || '').trim() || state.newCustomerMode || state.selectedCustomerId) {
      results.classList.add('is-hidden');
      return;
    }
    results.innerHTML = matches.length
      ? matches.map(customer => `<button type="button" data-pick-customer="${customer.id}"><div><strong>${escapeHtml(customer.company)}</strong><small>${escapeHtml(customer.contact || '联系人待补充')} · ${escapeHtml(customer.phone || customer.email || '联系方式待补充')}</small></div><span>${escapeHtml(ownerName(customer.owner_id))}</span></button>`).join('')
      : `<div class="customer-no-result"><strong>没有找到“${escapeHtml(query)}”</strong><small>确认名称无误后，可点击右侧“新建客户”</small></div>`;
    results.classList.remove('is-hidden');
  }

  function startNewCustomer() {
    const company = $('#order-customer-search', root).value.trim();
    clearCustomerSelection(true);
    state.newCustomerMode = true;
    $('#order-customer-results', root).classList.add('is-hidden');
    $('#order-new-company', root).value = company;
    $('#order-new-contact', root).value = '';
    $('#order-new-phone', root).value = '';
    $('#order-new-email', root).value = '';
    $('#order-new-country', root).value = '';
    $('#order-new-address', root).value = '';
    $('#order-new-customer-fields', root).classList.remove('is-hidden');
    showDuplicateWarning(company);
    setTimeout(() => $('#order-new-company', root).focus(), 30);
  }

  function showDuplicateWarning(companyName) {
    const normalized = normalizeCompany(companyName);
    const likely = normalized.length >= 2
      ? state.customers.filter(customer => {
          const existing = normalizeCompany(customer.company);
          return existing === normalized || existing.includes(normalized) || normalized.includes(existing);
        }).slice(0, 3)
      : [];
    const warning = $('#order-customer-duplicate', root);
    if (!likely.length) {
      warning.classList.add('is-hidden');
      return;
    }
    warning.innerHTML = `<strong>可能已经存在同一客户：</strong>${likely.map(customer => `<button type="button" data-pick-customer="${customer.id}">${escapeHtml(customer.company)}</button>`).join('')}`;
    warning.classList.remove('is-hidden');
  }

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
        ${paged.items.map(row => `<tr><td><strong>${escapeHtml(row.order_no || '—')}</strong></td><td>${escapeHtml(customerName(row.customer_id))}<small>${escapeHtml(row.product || '—')}</small></td><td>${escapeHtml(row.quantity ?? '—')}</td><td><strong>${formatMoney(row.amount)}</strong></td><td><span class="status-tag status-tag--${statusClass(row.status)}">${escapeHtml(row.status || '待确认')}</span></td><td>${escapeHtml(ownerName(row.owner_id))}</td><td>${formatDate(row.created_at)}</td><td><div class="row-actions"><button data-archive-order="${row.id}" type="button">归档</button><button data-edit-order="${row.id}" type="button">编辑</button><button class="danger-link" data-delete-order="${row.id}" type="button">删除</button></div></td></tr>`).join('')}
        </tbody></table></div>
        <div class="mobile-card-list">${paged.items.map(row => `<article class="record-card"><header><div><strong>${escapeHtml(row.order_no || '未编号订单')}</strong><span>${escapeHtml(customerName(row.customer_id))}</span></div><span class="status-tag status-tag--${statusClass(row.status)}">${escapeHtml(row.status || '待确认')}</span></header><dl><div><dt>产品</dt><dd>${escapeHtml(row.product || '—')}</dd></div><div><dt>数量</dt><dd>${escapeHtml(row.quantity ?? '—')}</dd></div><div><dt>金额</dt><dd>${formatMoney(row.amount)}</dd></div><div><dt>负责人</dt><dd>${escapeHtml(ownerName(row.owner_id))}</dd></div></dl><footer><button data-edit-order="${row.id}" type="button">编辑</button><button class="danger-link" data-delete-order="${row.id}" type="button">删除</button></footer></article>`).join('')}</div>`;
    }
    renderPagination($('#order-pagination', root), paged.page, paged.totalPages, page => { state.page = page; render(); });
  }

  function openEditor(row = null) {
    $('#order-modal-title', root).textContent = row ? '编辑订单' : '新增订单';
    $('#order-id', root).value = row?.id || '';
    $('#order-no', root).value = row?.order_no || '';
    $('#order-product', root).value = row?.product || '';
    $('#order-quantity', root).value = row?.quantity ?? '';
    $('#order-amount', root).value = row?.amount ?? '';
    $('#order-status', root).value = row?.status || '待确认';
    $('#order-remark', root).value = row?.remark || '';
    state.newCustomerMode = false;
    $('#order-new-customer-fields', root).classList.add('is-hidden');
    $('#order-customer-results', root).classList.add('is-hidden');
    $('#order-customer-duplicate', root).classList.add('is-hidden');
    clearCustomerSelection(false);
    if (isBoss() && $('#order-owner', root).options.length) {
      $('#order-owner', root).value = row?.owner_id || $('#order-owner', root).options[0].value;
    }
    if (row?.customer_id) {
      const customer = state.customers.find(item => String(item.id) === String(row.customer_id));
      if (customer) selectCustomer(customer);
    }
    openModal('order-modal');
  }

  $('#order-add', root).addEventListener('click', () => openEditor());
  $('#order-customer-search', root).addEventListener('input', debounce(event => {
    if (state.selectedCustomerId) clearCustomerSelection(true);
    if (state.newCustomerMode) {
      $('#order-new-company', root).value = event.target.value.trim();
      showDuplicateWarning(event.target.value);
    } else renderCustomerMatches(event.target.value);
  }, 150));
  $('#order-new-company', root).addEventListener('input', debounce(event => showDuplicateWarning(event.target.value), 180));
  $('#order-new-customer', root).addEventListener('click', startNewCustomer);
  $('#order-cancel-new-customer', root).addEventListener('click', () => {
    state.newCustomerMode = false;
    $('#order-new-customer-fields', root).classList.add('is-hidden');
    $('#order-customer-duplicate', root).classList.add('is-hidden');
    renderCustomerMatches($('#order-customer-search', root).value);
  });
  $('#order-search', root).addEventListener('input', debounce(event => { state.search = event.target.value.trim(); state.page = 1; render(); }));
  $('#order-status-filter', root).addEventListener('change', event => { state.status = event.target.value; state.page = 1; render(); });
  $('#order-import', root).addEventListener('click', () => $('#order-import-input', root).click());
  $('#order-import-input', root).addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    const button = $('#order-import', root); setButtonLoading(button, true, '正在导入…');
    try {
      const summary = await importCustomersAndOrders(file);
      const warning = summary.warnings.length ? `；${summary.warnings[0]}${summary.warnings.length > 1 ? `（另有 ${summary.warnings.length - 1} 条提醒）` : ''}` : '';
      showToast(`${importSummaryText(summary)}${warning}`, summary.warnings.length ? 'info' : 'success');
      await loadReferences();
      await load();
    } catch (error) { showToast(errorMessage(error, '导入失败'), 'error'); }
    finally { setButtonLoading(button, false); }
  });

  $('#order-form', root).addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('#order-id', root).value;
    const button = $('#order-save', root); setButtonLoading(button, true, '正在保存…');
    try {
      let customer = state.customers.find(item => String(item.id) === String(state.selectedCustomerId));
      let customerCreated = false;

      if (state.newCustomerMode) {
        const company = $('#order-new-company', root).value.trim();
        if (!company) throw new Error('请填写新客户的公司名称');
        const normalized = normalizeCompany(company);
        const exactDuplicate = state.customers.find(item => normalizeCompany(item.company) === normalized);
        if (exactDuplicate) {
          selectCustomer(exactDuplicate);
          throw new Error(`“${exactDuplicate.company}”已经存在，系统已为你选中原客户，请确认后再次保存`);
        }
        const customerOwnerId = isBoss() ? $('#order-owner', root).value : appState.user.id;
        if (!customerOwnerId) throw new Error('请选择负责人');
        const customerPayload = {
          company,
          contact: $('#order-new-contact', root).value.trim() || null,
          phone: $('#order-new-phone', root).value.trim() || null,
          email: $('#order-new-email', root).value.trim() || null,
          country: $('#order-new-country', root).value.trim() || null,
          address: $('#order-new-address', root).value.trim() || null,
          remark: null,
          owner_id: customerOwnerId
        };
        const { data, error } = await supabaseClient.from('customers').insert(customerPayload).select('*').single();
        if (error) throw error;
        customer = data;
        customerCreated = true;
        state.customers.push(customer);
        state.selectedCustomerId = customer.id;
      }

      if (!customer) throw new Error('请先搜索选择已有客户，或在当前窗口新建客户');
      const payload = {
        order_no: $('#order-no', root).value.trim(), customer_id: customer.id,
        product: $('#order-product', root).value.trim(), quantity: Number($('#order-quantity', root).value) || 0,
        amount: Number($('#order-amount', root).value) || 0, status: $('#order-status', root).value,
        remark: $('#order-remark', root).value.trim() || null,
        owner_id: customer.owner_id
      };
      const query = id ? supabaseClient.from('orders').update(payload).eq('id', id) : supabaseClient.from('orders').insert(payload);
      const { error } = await query;
      if (error) {
        if (customerCreated) {
          selectCustomer(customer);
          throw new Error(`客户“${customer.company}”已创建并已选中，但订单保存失败：${errorMessage(error)}`);
        }
        throw error;
      }
      closeModal('order-modal');
      showToast(customerCreated ? '客户与订单已一起创建' : (id ? '订单信息已更新' : '订单已新增'));
      await load();
    } catch (error) {
      showToast(errorMessage(error), 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });

  root.addEventListener('click', async event => {
    const pickCustomerButton = event.target.closest('[data-pick-customer]');
    if (pickCustomerButton) {
      const customer = state.customers.find(item => String(item.id) === pickCustomerButton.dataset.pickCustomer);
      if (customer) selectCustomer(customer);
      return;
    }
    if (event.target.closest('#order-change-customer')) {
      clearCustomerSelection(false);
      $('#order-customer-search', root).focus();
      return;
    }
    const archive = event.target.closest('[data-archive-order]');
    if (archive) {
      location.hash = `#/files?order=${encodeURIComponent(archive.dataset.archiveOrder)}`;
      return;
    }
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
