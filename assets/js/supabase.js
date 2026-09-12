const config = window.ZH_CONFIG || {};

export const isConfigured = Boolean(
  config.SUPABASE_URL &&
  config.SUPABASE_ANON_KEY &&
  !config.SUPABASE_URL.startsWith('YOUR_') &&
  !config.SUPABASE_ANON_KEY.startsWith('YOUR_')
);

export const supabaseClient = isConfigured && window.supabase
  ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

export const appState = {
  session: null,
  user: null,
  profile: null,
  route: null,
  routeCleanup: null
};

export const getConfig = () => config;
export const isBoss = () => appState.profile?.role === 'boss';
