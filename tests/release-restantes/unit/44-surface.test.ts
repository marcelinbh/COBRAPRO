import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read=(p:string)=>readFileSync(new URL(`../../../${p}`,import.meta.url),'utf8');
describe('superfície44 limitada',()=>{
 it('rotas financeiras antigas têm somente recusa; criação manual de parcela agora também é recusada',()=>{
  const source=read('server/routers.ts');
  for(const [section,name] of [['contratos','deletar'],['contratos','editar'],['contratos','editarJuros'],['parcelas','editarParcela'],['parcelas','deletarParcela'],['parcelas','criarParcela']]){
   const start=source.indexOf(`  ${name}: protectedProcedure`,source.indexOf(`const ${section}Router`));
   const end=source.indexOf('    }),',source.indexOf('.mutation(',start));
   const writer=source.slice(source.indexOf('.mutation(',start),end);
   expect(writer).toContain('PRECONDITION_FAILED');expect(writer).not.toMatch(/\.from\(|getDb\(|getSupabase|\.delete\(|\.update\(|\.insert\(/);
  }
 });
 it('diálogo não promete apagar livro e não tem mutação',()=>{
  const source=read('client/src/components/DeleteEmprestimoDialog.tsx');
  expect(source).not.toContain('useMutation');expect(source).not.toContain('.mutate(');expect(source).toContain('não serão apagados');
 });
 it('owner vem exclusivamente ctx.user e inputs fechados; namespace não vem do request',()=>{
  const source=read('server/routers/manutencaoEmprestimos.ts');
  expect(source.match(/ctx\.user\.id/g)).toHaveLength(3);expect(source).not.toContain('input.user');
  expect(read('server/services/manutencaoEmprestimos.ts')).toContain('client.rpc(facades44[name], args)');
 });
 it('UI persiste antes de rede e só encerra com prova terminal completa sob mesmo Web Lock',()=>{
  const source=read('client/src/components/ManutencaoCalendario.tsx');
  expect(source.indexOf('localStorage.setItem(storageKey, raw)')).toBeLessThan(source.indexOf('await execute.mutateAsync(intent)'));
  expect(source).toContain('if (!terminal || !pending || busy || flight.current || !navigator.locks) return');expect(source).toContain('navigator.locks.request(storageKey');expect(source).toContain('mesma UUID');
 });
 it('migration só instala 3 facades exatas, testemunha predecessores e não substitui guardas nem apaga livro',()=>{
  const source=read('drizzle/0044_manutencao_emprestimos.sql');
  expect(source).not.toMatch(/CREATE OR REPLACE|DELETE FROM public\.(?:parcelas|contratos|transacoes_caixa)|REFERENCES public\./);
  expect(source.match(/CREATE FUNCTION public\.rpc_\w+calendario44/g)).toHaveLength(3);expect(source).toContain('manutencao44_witness');expect(source).toContain('$new44$');
  expect(source.match(/pg_advisory_xact_lock\(hashtextextended\('manutencao44:'/g)).toHaveLength(2);
  expect(source).not.toMatch(/caixa37_travar\(|caixa37_validar_livro\(/);
  expect(source).toContain('PERFORM public.legados_travar');expect(source).toContain('IF v_depois IS DISTINCT FROM esperado');
 });
});
