export function normalizeAccount(account){
 if(account.includes('@')) return account;
 return account.toLowerCase()+"@zhonghe.local";
}
