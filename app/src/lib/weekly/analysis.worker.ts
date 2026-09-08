import { buildLineupReport } from './report';
import { generateTradeTargets } from './trades';
self.onmessage=(event:MessageEvent)=>{
  try {
    const {kind,input}=event.data;
    const result=kind==='lineup' ? buildLineupReport(input) : kind==='trades' ? generateTradeTargets(input) : null;
    if(!result)throw new Error('Unknown analysis request');
    self.postMessage({result});
  } catch(e){self.postMessage({error:e instanceof Error ? e.message : 'Analysis failed'});}
};
