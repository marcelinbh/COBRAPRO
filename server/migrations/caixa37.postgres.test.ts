import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
it('PG17 LOCAL Caixa37: dois bancos novos, efeitos exatos e convivência financeira',()=>{
 execFileSync('node',['tests/postgres-caixa37/build.mjs','--check'],{cwd:process.cwd(),stdio:'pipe'});
 const output=execFileSync('node',['tests/postgres-caixa37/runner.mjs'],{cwd:process.cwd(),encoding:'utf8',timeout:600000});
 expect(output).toContain('PASS fresh1 L04 DEDICADO');
 expect(output).toContain('PASS fresh2 L04 DEDICADO');
},600000);
