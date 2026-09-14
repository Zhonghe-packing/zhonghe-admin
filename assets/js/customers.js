import { appState, isBoss, supabaseClient, getConfig } from './supabase.js';
import {
  $, closeModal, debounce, emptyState, errorMessage, escapeHtml, formatDate,
  openModal, paginate, pick, readSpreadsheet, renderPagination, setButtonLoading,
  showToast, wireModalDismiss
} from './utils.js';

export async function initCustomers(root) {
  const state = { rows: [], profiles: [], page: 1, search: '' };
  const pageSize = Number(getConfig().PAGE_SIZE) || 10;
  wireModalDismiss(root);

  async function loadProfiles() {
    if (!isBoss()) return;
    const { data, error } = await supabaseClient.from('profiles').select('user_id,name,username,role').order('name');
    if (error) throw error;
    state.profiles = data || [];
    const sales = state.profiles.filter(item => item.role === 'sales');
    $('#customer-owner', root).innerHTML = sales.map(item => `<option value="${escapeHtml(item.user_id)}">${escapeHtml(item.name || item.username)} (${escapeHtml(item.username)})</option>`).join('');
    $('#customer-owner-field', root).classList.remove('is-hidden');
  }

  async function load() {
    const list = $('#customer-list', root);
    const { data, error } = await supabaseClient.from('customers').select('*').order('created_at', { ascending: false });
    if (error) {
      list.innerHTML = `<p class="inline-error">${escapeHtml(errorMessage(error))}</p>`;
      return;
    }
    state.rows = data || [];
    render();
  }

  function ownerName(ownerId) {
    const profile = state.profiles.find(item => item.user_id === ownerId);
    return profile?.name || profile?.username || (ownerId === appState.user.id ? (appState.profile.name || appState.profile.username) : '—');
  }

  const customerIncomplete = row => !row.contact || (!row.phone && !row.email) || !row.address;

  function filteredRows() {
    const q = state.search.toLowerCase();
    if (!q) return state.rows;
    return state.rows.filter(row => [row.company, row.contact, row.phone, row.email, row.country, row.address, row.remark, ownerName(row.owner_id)]
      .some(value => String(value || '').toLowerCase().includes(q)));
  }

  function render() {
    const rows = filteredRows();
    const paged = paginate(rows, state.page, pageSize);
    state.page = paged.page;
    $('#customer-summary', root).textContent = `共 ${rows.length} 位客户${isBoss() ? ' · 公司全局数据' : ' · 当前负责人名下'}`;
    const list = $('#customer-list', root);
    if (!paged.items.length) {
      list.innerHTML = emptyState(state.search ? '没有匹配的客户' : '还没有客户', state.search ? '请尝试其他关键词。' : '点击“新增客户”建立第一份客户档案。', '◎');
    } else {
      list.innerHTML = `
        <div class="table-wrap"><table><thead><tr><th>公司名称</th><th>联系人</th><th>电话 / 邮箱</th><th>国家</th><th>负责人</th><th>创建日期</th><th>操作</th></tr></thead><tbody>
        ${paged.items.map(row => `<tr><td><strong>${escapeHtml(row.company)}</strong><small>${customerIncomplete(row) ? '资料待补充' : escapeHtml(row.remark || '资料完整')}</small></td><td>${escapeHtml(row.contact || '—')}</td><td>${escapeHtml(row.phone || '—')}<small>${escapeHtml(row.email || '—')}</small></td><td>${escapeHtml(row.country || '—')}<small>${escapeHtml(row.address || '地址待补充')}</small></td><td>${escapeHtml(ownerName(row.owner_id))}</td><td>${formatDate(row.created_at)}</td><td><div class="row-actions"><button data-edit-customer="${row.id}" type="button">编辑</button><button class="danger-link" data-delete-customer="${row.id}" type="button">删除</button></div></td></tr>`).join('')}
        </tbody></table></div>
        <div class="mobile-card-list">${paged.items.map(row => `<article class="record-card"><header><div><strong>${escapeHtml(row.company)}</strong><span>${customerIncomplete(row) ? '资料待补充' : escapeHtml(row.country || '资料完整')}</span></div><span class="owner-chip">${escapeHtml(ownerName(row.owner_id))}</span></header><dl><div><dt>联系人</dt><dd>${escapeHtml(row.contact || '—')}</dd></div><div><dt>电话</dt><dd>${escapeHtml(row.phone || '—')}</dd></div><div><dt>邮箱</dt><dd>${escapeHtml(row.email || '—')}</dd></div><div><dt>地址</dt><dd>${escapeHtml(row.address || '—')}</dd></div></dl><footer><button data-edit-customer="${row.id}" type="button">编辑</button><button class="danger-link" data-delete-customer="${row.id}" type="button">删除</button></footer></article>`).join('')}</div>`;
    }
    renderPagination($('#customer-pagination', root), paged.page, paged.totalPages, page => { state.page = page; render(); });
  }

  function openEditor(row = null) {
    $('#customer-modal-title', root).textContent = row ? '编辑客户' : '新增客户';
    $('#customer-id', root).value = row?.id || '';
    $('#customer-company', root).value = row?.company || '';
    $('#customer-contact', root).value = row?.contact || '';
    $('#customer-phone', root).value = row?.phone || '';
    $('#customer-email', root).value = row?.email || '';
    $('#customer-country', root).value = row?.country || '';
    $('#customer-address', root).value = row?.address || '';
    $('#customer-remark', root).value = row?.remark || '';
    if (isBoss() && $('#customer-owner', root).options.length) $('#customer-owner', root).value = row?.owner_id || $('#customer-owner', root).options[0].value;
    openModal('customer-modal');
  }

  $('#customer-add', root).addEventListener('click', () => openEditor());
  $('#customer-search', root).addEventListener('input', debounce(event => { state.search = event.target.value.trim(); state.page = 1; render(); }));
  $('#customer-import', root).addEventListener('click', () => $('#customer-import-input', root).click());
  $('#customer-import-input', root).addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const button = $('#customer-import', root);
    setButtonLoading(button, true, '正在导入…');
    try {
      const sheetRows = await readSpreadsheet(file);
      const profileByUsername = new Map(state.profiles.map(p => [String(p.username).toUpperCase(), p.user_id]));
      const defaultSalesOwner = state.profiles.find(p => p.role === 'sales')?.user_id;
      const payload = sheetRows.map(row => ({
        company: pick(row, ['公司名称', '公司', 'company']), contact: pick(row, ['联系人', 'contact']),
        phone: pick(row, ['电话', '手机', 'phone']), email: pick(row, ['邮箱', 'email']),
        country: pick(row, ['国家', '国家/地区', 'country']), address: pick(row, ['地址', '详细地址', 'address']) || null,
        remark: pick(row, ['备注', 'remark']),
        owner_id: isBoss() ? (profileByUsername.get(pick(row, ['负责人账号', '负责人', 'owner']).toUpperCase()) || defaultSalesOwner || appState.user.id) : appState.user.id
      })).filter(row => row.company);
      if (!payload.length) throw new Error('未找到有效数据，请确认表格包含“公司名称”列');
      const { error } = await supabaseClient.from('customers').insert(payload);
      if (error) throw error;
      showToast(`成功导入 ${payload.length} 位客户`);
      await load();
    } catch (error) { showToast(errorMessage(error, '导入失败'), 'error'); }
    finally { setButtonLoading(button, false); }
  });

  $('#customer-form', root).addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('#customer-id', root).value;
    const payload = {
      company: $('#customer-company', root).value.trim(), contact: $('#customer-contact', root).value.trim() || null,
      phone: $('#customer-phone', root).value.trim() || null, email: $('#customer-email', root).value.trim() || null,
      country: $('#customer-country', root).value.trim() || null, address: $('#customer-address', root).value.trim() || null,
      remark: $('#customer-remark', root).value.trim() || null,
      owner_id: isBoss() ? $('#customer-owner', root).value : appState.user.id
    };
    const button = $('#customer-save', root);
    setButtonLoading(button, true, '正在保存…');
    const query = id ? supabaseClient.from('customers').update(payload).eq('id', id) : supabaseClient.from('customers').insert(payload);
    const { error } = await query;
    setButtonLoading(button, false);
    if (error) return showToast(errorMessage(error), 'error');
    closeModal('customer-modal');
    showToast(id ? '客户信息已更新' : '客户已新增');
    await load();
  });

  root.addEventListener('click', async event => {
    const edit = event.target.closest('[data-edit-customer]');
    if (edit) openEditor(state.rows.find(row => String(row.id) === edit.dataset.editCustomer));
    const remove = event.target.closest('[data-delete-customer]');
    if (remove) {
      const row = state.rows.find(item => String(item.id) === remove.dataset.deleteCustomer);
      if (!confirm(`确定删除客户“${row?.company || ''}”吗？此操作无法撤销。`)) return;
      const { error } = await supabaseClient.from('customers').delete().eq('id', remove.dataset.deleteCustomer);
      if (error) return showToast(errorMessage(error), 'error');
      showToast('客户已删除');
      await load();
    }
  });

  try { await loadProfiles(); } catch (error) { showToast(errorMessage(error), 'error'); }
  await load();
}
