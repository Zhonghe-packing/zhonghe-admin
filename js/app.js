import {normalizeAccount} from './auth.js';
import {SUPABASE_URL,SUPABASE_ANON_KEY} from '../supabase/config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const btn=document.querySelector('#login');
if(btn){btn.onclick=async()=>{let account=normalizeAccount(document.querySelector('#account').value);let pass=document.querySelector('#password').value;let {data,error}=await client.auth.signInWithPassword({email:account,password:pass});if(error){msg.innerText=error.message;return;}let p=await client.from('profiles').select('*').eq('user_id',data.user.id).single();if(!p.data){msg.innerText='没有权限配置';return;}location.href='pages/dashboard.html';}}
