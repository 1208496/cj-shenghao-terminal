export async function generationWithTimeout(start,{timeoutMs=120000,stop}){
  let timer;
  try{return await Promise.race([Promise.resolve().then(start),new Promise((_,reject)=>{
    timer=setTimeout(()=>{try{stop?.();}catch{}reject(Error('MODEL_TIMEOUT'));},timeoutMs);
  })]);}finally{clearTimeout(timer);}
}
