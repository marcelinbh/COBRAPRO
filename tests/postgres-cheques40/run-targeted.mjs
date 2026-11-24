import {mkdtempSync,readFileSync,writeFileSync,realpathSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute} from 'node:path';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){if(args[i]==='--unit-only')continue;if(['--artifacts','--pg-bin'].includes(args[i])&&args[i+1]){i++;continue;}throw Error('Usage: run-targeted.mjs [--unit-only] [--artifacts EXISTING_OUTSIDE_REPO] [--pg-bin PG17_BIN]');}
const inside=p=>{const rel=relative(realpathSync(repo),p);return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));};
const temp=realpathSync(tmpdir());if(inside(temp))throw Error('TMPDIR dentro do repo proibido');
const art=args.includes('--artifacts')?realpathSync(resolve(args[args.indexOf('--artifacts')+1])):mkdtempSync(temp+'/cobrapro-cheques40-targeted-');
if(inside(art))throw Error('Artifacts dentro do repo proibidos');
mkdirSync(art+'/home',{mode:0o700});
const env={PATH:'/usr/bin:/bin',HOME:art+'/home',LANG:'C.UTF-8',TMPDIR:temp};
if(args.includes('--pg-bin'))env.PG17_BIN=resolve(args[args.indexOf('--pg-bin')+1]);
const include=['server/services/cheques40.contract.test.ts','server/services/cheques40Rpc.test.ts','server/services/cheques40.recovery.test.ts','server/routers/cheques40.router.test.ts','client/src/lib/cheques40Intent.test.ts','server/services/chequesFinanceiros.test.ts','server/financialOperations.blocked.test.ts','server/tenantOwnership.financial.test.ts','server/routers/telefone41.router.test.ts','server/services/telefone41Rpc.test.ts','client/src/lib/telefone41Journal.test.ts','server/routers/assinaturas42.router.test.ts'];
if(!args.includes('--unit-only'))include.push('server/migrations/cheques40.postgres.test.ts');
// Config is external and contains no imports: Vite's bundled config and cache also stay outside repo.
const config={root:repo,envDir:false,cacheDir:art+'/vite-cache',resolve:{alias:{'@':repo+'client/src','@shared':repo+'shared'}},test:{environment:'node',include,maxWorkers:1,minWorkers:1,cache:{dir:art+'/vitest-cache'}}};
const configPath=art+'/vitest.config.mjs';writeFileSync(configPath,'export default '+JSON.stringify(config,null,2)+';\n');
console.log('ARTIFACTS '+art);
const manifest=JSON.parse(readFileSync(repo+'node_modules/vitest/package.json','utf8'));
console.log('Vitest '+manifest.version+' offline; no .env; targeted gates 40 + regression 41/42');
try{const log=execFileSync(process.execPath,[repo+'node_modules/vitest/vitest.mjs','run','--config',configPath,'--reporter=verbose'],{cwd:art,env,encoding:'utf8',timeout:600000,maxBuffer:16*1024*1024});writeFileSync(art+'/vitest.log',log);console.log(log);}
catch(error){writeFileSync(art+'/vitest.log',String(error.stdout??'')+'\n'+String(error.stderr??'')+'\n'+String(error));console.error(String(error.stdout??'')+'\n'+String(error.stderr??''));process.exitCode=1;}
