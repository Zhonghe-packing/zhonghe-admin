
import {login,getProfile} from './auth.js';
import {getCustomers,getOrders,getFiles} from './data.js';

const app=document.getElementById("app");

function loginPage(){
 app.innerHTML=`
 <div class="login-box">
 <div class="logo-title">众和销售助手</div>
 <div class="slogan">让销售更高效，让管理更简单</div>
 <input id="account" placeholder="账号">
 <input id="password" type="password" placeholder="密码">
 <button id="loginBtn">登录</button>
 <p id="msg"></p>
 </div>`;
 document.getElementById("loginBtn").onclick=async()=>{
  const r=await login(
   account.value,
   password.value
  );
  if(r.error){
   msg.innerText=r.error.message;
   return;
  }
  location.reload();
 };
}

async function dashboard(){
 const profile=await getProfile();
 if(!profile.data){
  loginPage(); return;
 }
 const c=await getCustomers();
 const o=await getOrders();
 const f=await getFiles();

 app.innerHTML=`
 <div class="layout">
 <aside class="sidebar">
 <h2>众和销售助手</h2>
 <p>${profile.data.name}</p>
 <p>角色:${profile.data.role}</p>
 <hr>
 <p>客户管理</p>
 <p>订单管理</p>
 <p>资料归档</p>
 </aside>
 <main class="content">
 <h1>工作台</h1>
 <div class="grid">
 <div class="card">客户数量<br>${c.data?.length||0}</div>
 <div class="card">订单数量<br>${o.data?.length||0}</div>
 <div class="card">文件模块<br>${f.data?.length||0}</div>
 </div>
 </main>
 </div>`;
}

dashboard();
