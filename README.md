# 众和销售助手

上海众和包装机械有限公司内部销售管理系统。前端为静态 HTML、CSS、JavaScript，可直接部署到 GitHub Pages；数据、登录和文件存储使用 Supabase。

## 上线前检查

### 0. V1.1 数据库升级

如果是从早期版本升级，请先在 Supabase SQL Editor 运行根目录中的 `SUPABASE_V11_MIGRATION.sql`。它只会为客户表增加 `address` 地址字段，不会删除或覆盖现有数据。

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

## Excel 合并导入

客户管理页和订单管理页都提供“下载导入模板”，并使用同一套导入逻辑。模板文件位于 `assets/templates/zhonghe-customer-order-import-template.xlsx`。

模板列名：`公司名称`、`联系人`、`电话`、`邮箱`、`国家/地区`、`地址`、`客户备注`、`订单编号`、`生产内容`、`数量`、`金额`、`状态`、`订单备注`、`负责人账号`。

- 同一公司名称会自动合并为一个客户，多行可以创建多笔订单；
- 已有客户只补充原本为空的联系方式，不覆盖现有内容；
- 只导入客户时，订单相关列全部留空；
- 填写生产内容但未填订单编号时，系统会自动生成导入订单编号；
- 已存在的订单编号会跳过，避免重复创建；
- 销售账号导入的新客户自动归属本人；老板导入新客户时必须填写有效的销售负责人账号；
- 模板中的“【示例】”行不会被系统导入，可直接覆盖；
- 支持 `.xlsx`、`.xls`、`.csv`，系统读取第一个工作表。

## 文件归档

- 支持 PDF、PNG、JPG、WEBP、Excel、Word；
- 默认单文件上限 20MB，可在 `config.js` 修改界面限制；
- Storage 路径格式：`负责人UUID/年-月/随机UUID.扩展名`，对象键仅使用 ASCII，避免中文文件名触发 `Invalid key`；
- `file_url` 字段保存对象路径，下载时临时生成签名链接，适合私有 Bucket。
- 中文原文件名保存在 `files.file_name`，列表显示和下载名称均保持不变；
- 选择资料不完整的客户时，上传窗口会显示可跳过的客户资料补充区；填写内容会在上传前同步到客户档案。
- 订单列表的“归档”按钮会直接打开上传窗口，并自动关联对应订单、客户和负责人。

## V1.1 订单录入流程

- “新增订单”窗口可以直接搜索已有客户，不再要求提前跳转到客户管理页面；
- 找到已有客户后直接关联原 `customer_id`，该客户的多笔订单会集中归档；
- 未找到时可在同一窗口新建客户，老板只填写公司名称和负责人即可；
- 新建名称与已有客户完全一致时会阻止重复创建，相似名称会显示提醒；
- 订单负责人自动继承客户负责人，避免客户和订单归属不同销售。

## 安全说明

- 项目中不包含任何员工密码；
- 数据可见范围由 Supabase RLS 决定，前端显示逻辑不是权限边界；
- 不要把 Supabase `service_role` key、数据库密码或员工密码提交到 GitHub；
- 建议将 `order-files` 设为 Private bucket。
