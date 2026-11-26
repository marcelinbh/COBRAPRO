import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { moedaDespesa } from '../../../shared/despesasIntent';

const moeda = (s: string) => s.startsWith('-') ? `-${moedaDespesa(s.slice(1))}` : moedaDespesa(s);

/** A chave React do caller deve mudar em toda transição de sessão, inclusive A -> B -> A. */
export default function ConferenciaDespesasCaixa({ userId, atual }: { userId: number; atual: () => boolean }) {
  const [leituraId] = useState(() => globalThis.crypto.randomUUID());
  const [open, setOpen] = useState(false);
  const [contaId, setContaId] = useState('');
  const q = trpc.contasPagar.conferirCaixa.useQuery({ leituraId }, {
    enabled: open && atual(), retry: false, staleTime: 0, gcTime: 0,
    placeholderData: undefined, trpc: { abortOnUnmount: true },
  });
  // Cache depois de erro/refetch não é uma conferência atual bem-sucedida.
  const data = atual() && !q.isError && !q.error && !q.isFetching && q.data?.empresaId === userId ? q.data : undefined;
  const contas = data?.contas.filter(c => !contaId || String(c.id) === contaId);
  const divergencias = data?.divergencias.filter(d => !contaId || d.contaCaixaId == null || String(d.contaCaixaId) === contaId);
  return <Dialog open={open && atual()} onOpenChange={v => { if (atual()) setOpen(v); }}>
    <DialogTrigger asChild><Button variant="outline" size="sm" disabled={!atual()}>Conferir despesas e caixa</Button></DialogTrigger>
    <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Conferência de despesas por conta própria</DialogTitle></DialogHeader>
      <p className="text-sm">O saldo é automático: base + entradas − saídas já persistidas. Abrir esta tela não cria lançamentos. Esta leitura mostra divergências antes de qualquer decisão; não recalcula um saldo bancário nem transforma a diferença em ajuste manual.</p>
      <Button variant="outline" disabled={!atual() || q.isFetching} onClick={() => { if (atual()) void q.refetch(); }}>{q.isFetching ? 'Conferindo...' : 'Atualizar conferência'}</Button>
      {(q.isError || q.error) && <p role="alert">Conferência indisponível: {q.error?.message} Nenhum total antigo é apresentado como conferido.</p>}
      {q.isFetching && <p role="status">Lendo registros próprios e verificando mudança entre observações...</p>}
      {!q.isFetching && !q.isError && !q.error && !data && <p role="status">Aguardando conferência da sessão atual.</p>}
      {data && <>
        <p className="text-xs text-muted-foreground">{data.escopo} Atualizado em {new Date(data.geradoEm).toLocaleString('pt-BR')}. Leituras REST repetidas não são snapshot transacional e não autorizam correção.</p>
        <label className="text-sm">Conta própria
          <select className="block w-full rounded border bg-background p-2" value={contaId} onChange={e => setContaId(e.target.value)}>
            <option value="">Todas as contas próprias</option>
            {data.contas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.ativa ? '' : ' (inativa)'}</option>)}
          </select>
        </label>
        <section aria-label="Saldo automático pelo livro" className="space-y-2">
          {contas?.map(c => <div key={c.id} className="border rounded p-3 text-sm">
            <p className="font-semibold">{c.nome} · #{c.id}{c.ativa ? '' : ' · inativa'}</p>
            <p>Base: {moeda(c.saldoBase)} · Entradas: {moeda(c.entradas)} · Saídas: {moeda(c.saidas)}</p>
            <p>Saldo do livro: {moeda(c.saldoLivro)} · Apontamentos de despesas: {c.divergencias}</p>
          </div>)}
        </section>
        <section aria-label="Divergências de despesas" className="space-y-2">
          <h3 className="font-semibold">Apontamentos de despesas: {divergencias?.length ?? 0}</h3>
          {divergencias?.length === 0 && <p>Nenhuma divergência de despesas identificada nos vínculos analisados. Isto não certifica saldo bancário, pagamentos legados ou outros fluxos financeiros.</p>}
          {divergencias?.map((d, i) => <div key={`${d.tipo}-${d.despesaId}-${i}`} className="border rounded p-3 text-sm">
            <p>{d.despesaId == null ? 'Movimento sem obrigação identificada' : `Despesa #${d.despesaId}`} · {d.contaCaixaId == null ? 'Conta não confirmada' : `Conta #${d.contaCaixaId}`} · {d.tipo}</p>
            <p>{d.mensagem}</p>
            {(d.esperado != null || d.encontrado != null) && <p>Valor de referência: {d.esperado == null ? 'não comprovado' : moeda(d.esperado)} · Livro vinculado: {d.encontrado == null ? 'não comprovado' : moeda(d.encontrado)}</p>}
          </div>)}
        </section>
        <p className="text-sm">Para resultado de pagamento incerto, use a intenção original e seu UUID em Contas a Pagar. Histórico sem prova exige revisão documental; não há botão para fabricar uma saída, apagar uma duplicidade ou ajustar o saldo-base.</p>
      </>}
    </DialogContent>
  </Dialog>;
}
