
import {client} from './supabase.js';

export async function getCustomers(){
 return await client.from("customers").select("*").order("created_at",{ascending:false});
}

export async function getOrders(){
 return await client.from("orders").select("*").order("created_at",{ascending:false});
}

export async function getFiles(){
 return await client.storage.from("order-files").list();
}
