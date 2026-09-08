import {useEffect,useState} from 'react';
export function useAnalysis<T>(kind:'lineup'|'trades',input:unknown|null) {
  const [state,setState]=useState<{result:T|null;busy:boolean;error:string}>({result:null,busy:false,error:''});
  const [completedInput,setCompletedInput]=useState<unknown>(null);
  useEffect(()=>{
    if(!input){setState({result:null,busy:false,error:''});return;}
    let active=true;
    setState({result:null,busy:true,error:''});
    let worker:Worker;
    try{worker=new Worker(new URL('./weekly/worker.js',window.location.href),{type:'module'});}
    catch{setState({result:null,busy:false,error:'Analysis worker could not start. Refresh the page in a supported browser.'});return;}
    const timeout=setTimeout(()=>{worker.terminate();setState({result:null,busy:false,error:'Analysis exceeded its time limit. Update inputs or try again.'});},90000);
    worker.onmessage=event=>{if(!active)return;setCompletedInput(input);clearTimeout(timeout);setState({result:event.data.result??null,busy:false,error:event.data.error??''});worker.terminate();};
    worker.onerror=()=>{if(!active)return;setCompletedInput(input);clearTimeout(timeout);setState({result:null,busy:false,error:'Analysis could not load. Reload forecasts and refresh the page.'});worker.terminate();};
    worker.postMessage({kind,input});
    return ()=>{active=false;clearTimeout(timeout);worker.terminate();};
  },[kind,input]);
  return {...state,result:completedInput===input?state.result:null};
}
