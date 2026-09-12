import {normalizeAccount} from './auth.js';

document.querySelector('#app').innerHTML=`
<div class="card" style="max-width:420px;margin:100px auto;text-align:center">
<h1>众和销售助手</h1>
<p>让销售更高效，让管理更简单</p>
<input placeholder="账号"><br><br>
<input placeholder="密码" type="password"><br><br>
<button>登录</button>
</div>`;
