const SUPABASE_URL = "https://ozctrkjtcsqacgqkospq.supabase.co";

const SUPABASE_KEY = "sb_publishable_SCqqiMFdqhWSa_m8n1GfzA_Tdoin_da";


window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
