# Supabase 上线检查清单

本文件不需要上传给普通员工阅读，但建议与源码一起保留，供管理员排查登录、写入和文件上传问题。

## 1. 必须核对的表字段

- `profiles.user_id`、`customers.owner_id`、`orders.owner_id`、`files.owner_id`：`uuid`
- `customers.id`、`orders.id`、`files.id`：前端兼容 `bigint`
- `orders.customer_id`、`files.customer_id`、`files.order_id`：应与对应主键类型一致
- `orders.quantity`、`orders.amount`：应为数字类型
- `files.file_url`：保存 Storage 对象路径，不要求 Bucket 公开

## 2. profiles 策略递归风险

不要在 `profiles` 表的 RLS 策略中直接使用以下写法查询 `profiles` 自身：

```sql
exists (
  select 1 from public.profiles
  where profiles.user_id = auth.uid()
    and profiles.role = 'boss'
)
```

这种写法可能触发 `infinite recursion detected in policy for relation "profiles"`。推荐通过 `security definer` 函数判断老板身份：

```sql
create or replace function public.is_boss()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'boss'
  );
$$;

revoke all on function public.is_boss() from public;
grant execute on function public.is_boss() to authenticated;
```

然后老板查看策略使用：

```sql
using (public.is_boss())
```

请先删除 Supabase 中原有的递归策略，再创建替代策略；原策略名称由实际后台设置决定，不要盲目执行未知的 `drop policy`。

## 3. 老板写入权限

需求中包含“老板手动创建”和由老板指定负责人。若现有策略只允许 `auth.uid() = owner_id`，老板给销售新建记录会被拒绝。

`customers`、`orders`、`files` 建议分别补充老板的 INSERT、UPDATE、DELETE 策略：

```sql
-- INSERT 的 with check
public.is_boss()

-- UPDATE 的 using 与 with check
public.is_boss()

-- DELETE 的 using
public.is_boss()
```

销售原有的 `auth.uid() = owner_id` 策略继续保留。PostgreSQL 的多个 permissive policy 会以 OR 组合。

## 4. Storage RLS

文件表 `files` 的 RLS 不会自动保护 `storage.objects`，必须在 Storage 中为 `order-files` 单独设置策略。前端对象路径第一段为负责人 UUID。

销售查看/上传/删除本人路径的条件可使用：

```sql
bucket_id = 'order-files'
and (storage.foldername(name))[1] = auth.uid()::text
```

老板策略可使用：

```sql
bucket_id = 'order-files'
and public.is_boss()
```

需要分别覆盖 `SELECT`、`INSERT`、`DELETE`；如果允许覆盖同名文件，再配置 `UPDATE`。本项目默认使用随机 UUID 文件名，不需要覆盖上传。

## 5. 快速验收顺序

1. 销售账号登录，只能读取本人客户、订单、文件。
2. 销售新增并修改客户，`owner_id` 应等于该账号 Auth UUID。
3. 老板登录，可以读取全部 `profiles` 与全部业务记录。
4. 老板选择某位销售新增客户，该销售重新登录后能看见该客户。
5. 销售上传一份 PDF，`files.file_url` 保存对象路径，下载成功。
6. 另一位销售无法读取或下载该文件。
7. 老板可以下载和删除任意销售的归档文件。

## 6. 常见报错

- `Invalid login credentials`：账号或密码错误，检查 Auth 中的实际密码。
- `infinite recursion detected...`：按第 2 节修复 `profiles` 策略。
- `new row violates row-level security policy`：缺少 INSERT/UPDATE 策略，或提交的 `owner_id` 不符合策略。
- `Bucket not found`：Bucket 名不是 `order-files`，或 `config.js` 名称不一致。
- Storage 上传成功但元数据写入失败：检查 `files` 的 INSERT 策略和字段类型。
- 页面提示尚未连接 Supabase：尚未填写 `config.js` 中的 URL 与 anon key。
