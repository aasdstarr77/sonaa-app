export const API_BASE = 'https://sonaa-backend-v2.vercel.app/api';
export async function api(path, options={}) {
 const {token,body,headers,...rest}=options;
 let response;
 try { response=await fetch(API_BASE+path,{...rest,headers:{Accept:'application/json','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(headers||{})},body:body===undefined?undefined:JSON.stringify(body)}); }
 catch (_) { throw new Error('تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مرة أخرى.'); }
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const e=new Error(data.message||data.error||'حدث خطأ من الخادم ('+response.status+')');e.status=response.status;throw e;}
 return data;
}