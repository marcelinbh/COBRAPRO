import {readFileSync,writeFileSync,mkdirSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),p=path.join(root,'tsconfig.release-restantes.json');
const config=JSON.parse(readFileSync(path.join(root,'tsconfig.json'),'utf8'));
config.compilerOptions.incremental=false;delete config.compilerOptions.tsBuildInfoFile;config.compilerOptions.target='ES2022';
// No writes to dependency store or active incremental cache.
writeFileSync(p,JSON.stringify(config,null,2)+'\n');
try{execFileSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'--project',p],{cwd:root,stdio:'inherit'});console.log('PASS TypeScript full project strict, targetES2022, no incremental writes');}finally{unlinkSync(p);}
