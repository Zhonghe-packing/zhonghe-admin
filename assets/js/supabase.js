
import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';

export const client = window.supabase.createClient(
 SUPABASE_URL,
 SUPABASE_ANON_KEY
);
