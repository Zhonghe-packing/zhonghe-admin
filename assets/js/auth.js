
import {client} from './supabase.js';

export function normalizeAccount(account){
 if(account.includes("@")) return account;
 return account.toLowerCase()+"@zhonghe.local";
}

export async function login(account,password){
 return await client.auth.signInWithPassword({
  email:normalizeAccount(account),
  password
 });
}

export async function getProfile(){
 const {data:{user}} = await client.auth.getUser();
 if(!user) return null;

 const {data,error}=await client
 .from("profiles")
 .select("*")
 .eq("user_id",user.id)
 .single();

 return {data,error};
}
