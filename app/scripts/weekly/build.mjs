import {build} from 'esbuild';
import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('public/weekly',{recursive:true});
await build({entryPoints:['src/lib/weekly/analysis.worker.ts'],outfile:'public/weekly/worker.js',bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022'});
if(process.argv.includes('--publish')){
 await mkdir('../weekly',{recursive:true});
 await cp('public/weekly/research','../weekly/research',{recursive:true});
 await cp('public/weekly/shadow','../weekly/shadow',{recursive:true});
 for(const file of ['latest.json','validation.json','worker.js'])await copyFile(`public/weekly/${file}`,`../weekly/${file}`);
}
