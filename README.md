# 众和销售助手

上海众和包装机械有限公司内部销售管理系统。前端为静态 HTML、CSS、JavaScript，可直接部署到 GitHub Pages；数据、登录和文件存储使用 Supabase。

## 上线前检查

### 1. Supabase 连接信息（已配置）

`assets/js/config.js` 已填写当前项目的 Project URL 与 anon public key。如以后更换 Supabase 项目，再到后台 **Project Settings → API** 复制并替换：

```js
SUPABASE_URL: 'https://你的项目编号.supabase.co',
SUPABASE_ANON_KEY: '你的 anon public key',
```

只能填写 `anon public` key，禁止把 `service_role` key 放进前端。

### 2. 检查后端权限

请查看 `SUPABASE_CHECKLIST.md`。尤其要确认：

- `profiles` 的老板策略没有直接查询自身表/递归；
- 老板如需代销售新建、修改或删除记录，必须有对应写入策略；
- `storage.objects` 已对 `order-files` 配置查看、权限，文件表 RLS 不能代替 Storage RLS。

## GitHub Pages 部署

1. 将本目录中的全部文件上传到 GitHub 仓库根目录。
2. 在仓库 **Settings → Pages** 中选择 **Deploy from a branch**。
3. 分支选择 `main`，目录选择 `/ (root)`，保存。
4. 等待部署完成，打开 Pages 地址。
5. 输入公司账号（如 `LB`）和 Auth 中保存的实际密码登录。

系统会在登录时自动把 `LB` 转为 `LB@zhonghe.local`，页面不会显示邮箱。

## Excel 导入列名

客户表支持：`公司名称`、`联系人`、`电话`、`邮箱`、`国家`、`备注`、`负责人账号`。

订单表支持：`订单编号`、`客户`、`产品`、`数量`、`金额`、`状态`、`备注`、`负责人账号`。客户名称必须与系统中已有客户完全一致。

支持 `.xlsx`、`.xls`、`.csv`，读取第一个工作表。销售账号导入的数据自动归属本人；老板账号可在“负责人账号”列填写销售账号。

## 文件归档

- 支持 PDF、PNG、JPG、WEBP、Excel、Word；
- 默认单文件上限 20MB，可在 `config.js` 修改界面限制；
- Storage 路径格式：`负责人UUID/年-月/随机UUID-安全文件名`；
- `file_url` 字段保存对象路径，下载时临时生成签名链接，适合私有 Bucket。

## 安全说明

- 项目中不包含任何员工密码；
- 数据可见范围由 Supabase RLS 决定，前端显示逻辑不是权限边界；
- 不要把 Supabase `service_role` key、数据库密码或员工密码提交到 GitHub；
- 建议将 `order-files` 设为 Private bucket。
