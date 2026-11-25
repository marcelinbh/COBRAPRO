import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {calendario44Schema} from '../../shared/manutencaoEmprestimos';
const read=(p:string)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
describe('incremento46 superfície e limites reais',()=>{
 it('agenda44 conserva validação de1..60 e28, leap/rollover',()=>{
  for(let n=1;n<=60;n++){
   const dates=Array.from({length:n},(_,i)=>new Date(Date.UTC(2026,i,28,12)).toISOString().slice(0,10));
   expect(calendario44Schema.safeParse({contratoId:1,idempotencyKey:'10000000-0000-4000-8000-000000000044',estadoHash:'a'.repeat(64),vencimentos:dates,motivo:'Teste46'}).success).toBe(true);
  }
  for(const dates of [['2027-02-29'],['2026-01-31','2026-02-28'],Array(61).fill('2026-01-28')])expect(calendario44Schema.safeParse({contratoId:1,idempotencyKey:'10000000-0000-4000-8000-000000000044',estadoHash:'a'.repeat(64),vencimentos:dates,motivo:'Teste46'}).success).toBe(false);
 });
 it('rota origem somente ctx.user; writers44 intactos e inputs fechados',()=>{
  const r=read('server/routers/manutencaoEmprestimos.ts');expect(r.match(/ctx\.user\.id/g)).toHaveLength(12);expect(r).not.toContain('input.user');expect(r).toContain('identificarCalendario46');expect(r).toContain('manterCalendario44(await cliente44(), ctx.user.id, input, true)');
 });
 it('UI nova substitui ação já montada; NovoContrato não foi adaptado para fabricar21',()=>{
  expect(read('client/src/pages/EmprestimoDetalhes.tsx')).toContain('<ManutencaoCalendario contratoId={emprestimo.id}');const ui=read('client/src/components/ManutencaoCalendario.tsx');expect(ui).toContain('cotarCalendario46.useQuery');expect(ui).toContain('scope.data.userId === userId');expect(ui).toContain('if (conferir || !supported');expect(ui).toContain('navigator.locks.request(storageKey');expect(ui).not.toContain('emprestimosProspectivos.criar');expect(ui).not.toContain('emprestimosMultimodal.receber');
 });
});
