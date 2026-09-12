/**
 * Supabase 项目配置
 * 在 Supabase 后台：Project Settings → API 中复制 Project URL 与 anon public key。
 * anon key 是公开客户端密钥，真正的数据权限由 RLS 控制；不要在此填写 service_role key。
 */
window.ZH_CONFIG = Object.freeze({
  SUPABASE_URL: 'https://ozctrkjtcsqacgqkospq.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Rya2p0Y3NxYWNncWtvc3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTI2NDcsImV4cCI6MjEwNDY4ODY0N30.ZfhAGXsstYBQztI8XgOPYHwcKpash623ji1LkzB6yyk',
  AUTH_EMAIL_DOMAIN: 'zhonghe.local',
  STORAGE_BUCKET: 'order-files',
  PAGE_SIZE: 10,
  MAX_UPLOAD_MB: 20
});
