import { appState, isBoss, supabaseClient } from './supabase.js';
import { pick, readSpreadsheet } from './utils.js';

export function normalizeCompanyName(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·•,，.。()（）\-—_]+/g, '');
}

function firstValue(rows, aliases) {
  for (const row of rows) {
    const value = pick(row.data, aliases);
    if (value) return value;
  }
  return '';
}

function numberValue(value) {
  const parsed = Number(String(value || '').replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function createImportOrderNo(sequence, occupied) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  let index = sequence;
  let candidate = '';
  do {
    candidate = `IMP-${date}-${String(index).padStart(3, '0')}`;
    index += 1;
  } while (occupied.has(candidate.toUpperCase()));
  return candidate;
}

export async function importCustomersAndOrders(file) {
  const rawRows = await readSpreadsheet(file);
  const rows = rawRows.map((data, index) => ({ data, rowNumber: index + 2 })).filter(item => {
    const company = pick(item.data, ['公司名称', '客户名称', '客户', '公司', 'company']);
    return company && !company.startsWith('【示例】');
  });
  if (!rows.length) throw new Error('没有找到可导入的数据。请使用下载的模板，并填写“公司名称”列');

  const [customerResult, orderResult, profileResult] = await Promise.all([
    supabaseClient.from('customers').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('orders').select('id,order_no'),
    isBoss()
      ? supabaseClient.from('profiles').select('user_id,name,username,role').eq('role', 'sales')
      : Promise.resolve({ data: [], error: null })
  ]);
  for (const result of [customerResult, orderResult, profileResult]) if (result.error) throw result.error;

  const customers = customerResult.data || [];
  const customerByName = new Map();
  customers.forEach(customer => {
    const key = normalizeCompanyName(customer.company);
    if (key && !customerByName.has(key)) customerByName.set(key, customer);
  });
  const profiles = profileResult.data || [];
  const ownerByUsername = new Map(profiles.map(profile => [String(profile.username || '').toUpperCase(), profile.user_id]));
  const occupiedOrderNumbers = new Set((orderResult.data || []).map(order => String(order.order_no || '').toUpperCase()).filter(Boolean));

  const groups = new Map();
  rows.forEach(item => {
    const company = pick(item.data, ['公司名称', '客户名称', '客户', '公司', 'company']);
    const key = normalizeCompanyName(company);
    if (!groups.has(key)) groups.set(key, { company, rows: [] });
    groups.get(key).rows.push(item);
  });

  const summary = {
    createdCustomers: 0,
    mergedCustomers: 0,
    createdOrders: 0,
    skippedOrders: 0,
    warnings: []
  };
  let generatedSequence = 1;

  for (const group of groups.values()) {
    const key = normalizeCompanyName(group.company);
    let customer = customerByName.get(key);
    if (customer) {
      summary.mergedCustomers += 1;
    } else {
      const username = firstValue(group.rows, ['负责人账号', '负责人', 'owner']).toUpperCase();
      const ownerId = isBoss() ? ownerByUsername.get(username) : appState.user.id;
      if (!ownerId) {
        summary.warnings.push(`“${group.company}”未填写有效的负责人账号，客户及其订单未导入`);
        continue;
      }
      const payload = {
        company: group.company,
        contact: null,
        phone: null,
        email: null,
        country: null,
        address: null,
        remark: null,
        owner_id: ownerId
      };
      const { data, error } = await supabaseClient.from('customers').insert(payload).select('*').single();
      if (error) throw new Error(`创建客户“${group.company}”失败：${error.message}`);
      customer = data;
      customerByName.set(key, customer);
      summary.createdCustomers += 1;
    }

    for (const item of group.rows) {
      const product = pick(item.data, ['生产内容', '产品', '产品名称', '设备名称', 'product']);
      let orderNo = pick(item.data, ['订单编号', '订单号', 'order_no']);
      if (!product && !orderNo) continue;
      if (!product) {
        summary.warnings.push(`第 ${item.rowNumber} 行缺少生产内容，订单未导入`);
        summary.skippedOrders += 1;
        continue;
      }
      if (!orderNo) {
        orderNo = createImportOrderNo(generatedSequence, occupiedOrderNumbers);
        generatedSequence += 1;
      }
      const orderKey = orderNo.toUpperCase();
      if (occupiedOrderNumbers.has(orderKey)) {
        summary.skippedOrders += 1;
        summary.warnings.push(`第 ${item.rowNumber} 行订单编号“${orderNo}”已存在，已跳过`);
        continue;
      }
      const payload = {
        order_no: orderNo,
        customer_id: customer.id,
        product,
        quantity: numberValue(pick(item.data, ['数量', 'quantity'])),
        amount: 0,
        status: '待确认',
        remark: null,
        owner_id: customer.owner_id
      };
      const { error } = await supabaseClient.from('orders').insert(payload);
      if (error) throw new Error(`导入订单“${orderNo}”失败：${error.message}`);
      occupiedOrderNumbers.add(orderKey);
      summary.createdOrders += 1;
    }
  }

  if (!summary.createdCustomers && !summary.mergedCustomers && !summary.createdOrders) {
    throw new Error(summary.warnings[0] || '没有可导入的客户或订单');
  }
  return summary;
}

export function importSummaryText(summary) {
  const parts = [];
  if (summary.createdCustomers) parts.push(`新增客户 ${summary.createdCustomers} 个`);
  if (summary.mergedCustomers) parts.push(`合并已有客户 ${summary.mergedCustomers} 个`);
  if (summary.createdOrders) parts.push(`新增订单 ${summary.createdOrders} 笔`);
  if (summary.skippedOrders) parts.push(`跳过订单 ${summary.skippedOrders} 笔`);
  return parts.join('，') || '导入完成';
}
