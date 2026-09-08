export function sleeperRetryDelay(failures:number,status?:number,retryAfter?:string|null,now=Date.now()):number {
  const backoff=Math.min(60000,2000*2**Math.min(Math.max(failures,1),5));
  const seconds=retryAfter?.trim()?Number(retryAfter):NaN;
  const requested=Number.isFinite(seconds)?seconds*1000:retryAfter?Date.parse(retryAfter)-now:0;
  return Math.min(2147483647,Math.max(backoff,status===429?60000:0,Number.isFinite(requested)?requested:0));
}
