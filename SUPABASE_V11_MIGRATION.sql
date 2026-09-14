-- 众和销售助手 V1.1 数据库升级
-- 用途：为客户表增加地址字段。
-- 可重复运行，不会删除或覆盖现有数据。

alter table public.customers
add column if not exists address text;

comment on column public.customers.address
is '客户地址，由销售在客户维护或文件归档时补充';
