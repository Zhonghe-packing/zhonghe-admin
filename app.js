function logout(){location.href='index.html'}

function showPage(page){
let c=document.getElementById('content');
if(page==='customers'){
c.innerHTML='<h2>客户管理</h2><p>客户数据读取 customers 表。</p><button>新增客户</button>';
}
if(page==='orders'){
c.innerHTML='<h2>订单管理</h2><p>订单数据读取 orders 表。</p><button>新增订单</button>';
}
if(page==='files'){
c.innerHTML='<h2>资料归档</h2><p>上传合同、报价单、技术资料。</p><button>上传文件</button>';
}
if(page==='stats'){
c.innerHTML='<h2>数据统计</h2><p>订单、客户、文件统计。</p>';
}
}
