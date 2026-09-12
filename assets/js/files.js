import { appState, isBoss, supabaseClient, getConfig } from './supabase.js';
import {
  $, closeModal, debounce, emptyState, errorMessage, escapeHtml, formatDate,
  openModal, paginate, renderPagination, safeFileName, setButtonLoading,
  showToast, wireModalDismiss
} from './utils.js';

export async function initFiles(root) {
  const state = { rows: [], customers: [], orders: [], profiles: [], page: 1, search: '' };
  const config = getConfig();
  const pageSize = Number(config.PAGE_SIZE) || 10;
  const bucket = config.STORAGE_BUCKET || 'order-files';
  wireModalDismiss(root);

  async function loadReferences() {
    const [customersResult, ordersResult, profilesResult] = await Promise.all([
      supabaseClient.from('customers').select('id,company,owner_id').order('company'),
      supabaseClient.from('orders').select('id,order_no,customer_id,owner_id').order('created_at', { ascending: false }),
      isBoss() ? supabaseClient.from('profiles').select('user_id,name,username,role').order('name') : Promise.resolve({ data: [], error: null })
    ]);
    for (const result of [customersResult, ordersResult, profilesResult]) if (result.error) throw result.error;
    state.customers = customersResult.data || [];
    state.orders = ordersResult.data || [];
    state.profiles = profilesResult.data || [];
    $('#file-customer', root).innerHTML = '<option value="">不关联客户</option>' + state.customers.map(item => `<option value="${item.id}">${escapeHtml(item.company)}</option>`).join('');
    $('#file-order', root).innerHTML = '<option value="">不关联订单</option>' + state.orders.map(item => `<option value="${item.id}">${escapeHtml(item.order_no || `订单 ${item.id}`)}</option>`).join('');
    if (isBoss()) {
      const sales = state.profiles.filter(item => item.role === 'sales');
      $('#file-owner', root).innerHTML = sales.map(item => `<option value="${escapeHtml(item.user_id)}">${escapeHtml(item.name || item.username)} (${escapeHtml(item.username)})</option>`).join('');
      $('#file-owner-field', root).classList.remove('is-hidden');
    }
  }

  async function load() {
    const { data, error } = await supabaseClient.from('files').select('*').order('created_at', { ascending: false });
    if (error) {
      $('#file-list', root).innerHTML = `<p class="inline-error">${escapeHtml(errorMessage(error))}</p>`;
      return;
    }
    state.rows = data || []; render();
  }

  const customerName = id => state.customers.find(item => String(item.id) === String(id))?.company || '—';
  const orderName = id => state.orders.find(item => String(item.id) === String(id))?.order_no || '—';
  const ownerName = id => state.profiles.find(item => item.user_id === id)?.name || state.profiles.find(item => item.user_id === id)?.username || (id === appState.user.id ? (appState.profile.name || appState.profile.username) : '—');
  const iconFor = name => /\.pdf$/i.test(name) ? 'PDF' : /\.(png|jpe?g|webp)$/i.test(name) ? 'IMG' : /\.xlsx?$/i.test(name) ? 'XLS' : /\.docx?$/i.test(name) ? 'DOC' : 'FILE';

  function filteredRows() {
    const q = state.search.toLowerCase();
    if (!q) return state.rows;
    return state.rows.filter(row => [row.file_name, row.file_type, row.remark, customerName(row.customer_id), orderName(row.order_id), ownerName(row.owner_id)]
      .some(value => String(value || '').toLowerCase().includes(q)));
  }

  function render() {
    const rows = filteredRows(); const paged = paginate(rows, state.page, pageSize); state.page = paged.page;
    $('#file-summary', root).textContent = `共 ${rows.length} 份资料${isBoss() ? ' · 公司全局归档' : ' · 当前负责人名下'}`;
    const list = $('#file-list', root);
    if (!paged.items.length) {
      list.innerHTML = emptyState(state.search ? '没有匹配的文件' : '还没有归档资料', state.search ? '请尝试其他关键词。' : '点击“上传资料”归档合同、报价单或技术文件。', '◇');
    } else {
      list.innerHTML = `
        <div class="table-wrap"><table><thead><tr><th>文件名</th><th>类型</th><th>关联订单</th><th>关联客户</th><th>负责人</th><th>上传时间</th><th>操作</th></tr></thead><tbody>
        ${paged.items.map(row => `<tr><td><div class="file-cell"><span>${iconFor(row.file_name)}</span><div><strong>${escapeHtml(row.file_name)}</strong><small>${escapeHtml(row.remark || '暂无说明')}</small></div></div></td><td>${escapeHtml(row.file_type || '其他')}</td><td>${escapeHtml(orderName(row.order_id))}</td><td>${escapeHtml(customerName(row.customer_id))}</td><td>${escapeHtml(ownerName(row.owner_id))}</td><td>${formatDate(row.created_at, true)}</td><td><div class="row-actions"><button data-download-file="${row.id}" type="button">下载</button><button class="danger-link" data-delete-file="${row.id}" type="button">删除</button></div></td></tr>`).join('')}
        </tbody></table></div>
        <div class="mobile-card-list">${paged.items.map(row => `<article class="record-card file-record"><header><div class="file-cell"><span>${iconFor(row.file_name)}</span><div><strong>${escapeHtml(row.file_name)}</strong><small>${escapeHtml(row.file_type || '其他')}</small></div></div></header><dl><div><dt>订单</dt><dd>${escapeHtml(orderName(row.order_id))}</dd></div><div><dt>客户</dt><dd>${escapeHtml(customerName(row.customer_id))}</dd></div><div><dt>上传时间</dt><dd>${formatDate(row.created_at, true)}</dd></div></dl><footer><button data-download-file="${row.id}" type="button">下载</button><button class="danger-link" data-delete-file="${row.id}" type="button">删除</button></footer></article>`).join('')}</div>`;
    }
    renderPagination($('#file-pagination', root), paged.page, paged.totalPages, page => { state.page = page; render(); });
  }

  $('#file-upload', root).addEventListener('click', () => {
    $('#file-form', root).reset(); $('#selected-file-name', root).textContent = 'PDF、图片、Excel 或 Word';
    if (isBoss() && $('#file-owner', root).options.length) $('#file-owner', root).selectedIndex = 0;
    openModal('file-modal');
  });
  $('#file-search', root).addEventListener('input', debounce(event => { state.search = event.target.value.trim(); state.page = 1; render(); }));
  $('#archive-file', root).addEventListener('change', event => { $('#selected-file-name', root).textContent = event.target.files[0]?.name || 'PDF、图片、Excel 或 Word'; });
  $('#file-customer', root).addEventListener('change', event => {
    const customerId = event.target.value;
    const options = state.orders.filter(order => !customerId || String(order.customer_id) === customerId);
    $('#file-order', root).innerHTML = '<option value="">不关联订单</option>' + options.map(item => `<option value="${item.id}">${escapeHtml(item.order_no || `订单 ${item.id}`)}</option>`).join('');
  });
  $('#file-order', root).addEventListener('change', event => {
    const order = state.orders.find(item => String(item.id) === event.target.value);
    if (order?.customer_id) $('#file-customer', root).value = order.customer_id;
  });

  $('#file-form', root).addEventListener('submit', async event => {
    event.preventDefault();
    const file = $('#archive-file', root).files[0];
    if (!file) return showToast('请选择文件', 'error');
    const allowed = /\.(pdf|png|jpe?g|webp|xls|xlsx|doc|docx)$/i;
    if (!allowed.test(file.name)) return showToast('仅支持 PDF、图片、Excel 和 Word 文件', 'error');
    const maxBytes = (Number(config.MAX_UPLOAD_MB) || 20) * 1024 * 1024;
    if (file.size > maxBytes) return showToast(`文件不能超过 ${config.MAX_UPLOAD_MB || 20}MB`, 'error');

    const ownerId = isBoss() ? $('#file-owner', root).value : appState.user.id;
    const dateFolder = new Date().toISOString().slice(0, 7);
    const storagePath = `${ownerId}/${dateFolder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const button = $('#file-save', root); setButtonLoading(button, true, '正在上传…');
    try {
      const { error: uploadError } = await supabaseClient.storage.from(bucket).upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) throw uploadError;
      const payload = {
        customer_id: $('#file-customer', root).value ? Number($('#file-customer', root).value) : null,
        order_id: $('#file-order', root).value ? Number($('#file-order', root).value) : null,
        file_name: file.name, file_url: storagePath, file_type: $('#file-type', root).value,
        remark: $('#file-remark', root).value.trim() || null, owner_id: ownerId
      };
      const { error: insertError } = await supabaseClient.from('files').insert(payload);
      if (insertError) {
        await supabaseClient.storage.from(bucket).remove([storagePath]);
        throw insertError;
      }
      closeModal('file-modal'); showToast('文件已上传并归档'); await load();
    } catch (error) { showToast(errorMessage(error, '文件上传失败'), 'error'); }
    finally { setButtonLoading(button, false); }
  });

  root.addEventListener('click', async event => {
    const download = event.target.closest('[data-download-file]');
    if (download) {
      const row = state.rows.find(item => String(item.id) === download.dataset.downloadFile);
      if (!row) return;
      if (/^https?:\/\//i.test(row.file_url || '')) return window.open(row.file_url, '_blank', 'noopener');
      const { data, error } = await supabaseClient.storage.from(bucket).createSignedUrl(row.file_url, 60, { download: row.file_name });
      if (error) return showToast(errorMessage(error, '下载链接生成失败'), 'error');
      const link = document.createElement('a'); link.href = data.signedUrl; link.download = row.file_name; link.rel = 'noopener'; link.click();
    }
    const remove = event.target.closest('[data-delete-file]');
    if (remove) {
      const row = state.rows.find(item => String(item.id) === remove.dataset.deleteFile);
      if (!confirm(`确定删除文件“${row?.file_name || ''}”吗？此操作无法撤销。`)) return;
      const { error: tableError } = await supabaseClient.from('files').delete().eq('id', remove.dataset.deleteFile);
      if (tableError) return showToast(errorMessage(tableError), 'error');
      if (row?.file_url && !/^https?:\/\//i.test(row.file_url)) {
        const { error: storageError } = await supabaseClient.storage.from(bucket).remove([row.file_url]);
        if (storageError) showToast('归档记录已删除，但存储文件清理失败，请联系管理员', 'error');
        else showToast('文件已删除');
      } else showToast('文件记录已删除');
      await load();
    }
  });

  try { await loadReferences(); } catch (error) { showToast(errorMessage(error), 'error'); }
  await load();
}
