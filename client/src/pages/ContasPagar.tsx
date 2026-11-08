import { useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Receipt, Plus, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DespesasIntentStore, criarDespesaPayload, pagarDespesaPayload, estornarDespesaPayload,
  diaCivilBrt, dinheiroDespesa, moedaDespesa,
  type AcaoDespesa, type IntencaoDespesaPersistida, type PayloadDespesa, type StorageDespesas,
} from '../../../shared/despesasIntent';

// Mesmo Provider e contrato do appRouter integrado pelo coordenador; sem fallback.
const despesasTrpc = trpc;
const categorias = { aluguel: 'Aluguel', energia: 'Energia', agua: 'Água', internet: 'Internet', telefone: 'Telefone', salario: 'Salário', imposto: 'Imposto', fornecedor: 'Fornecedor', outros: 'Outros' };
const statuses = { pendente: 'Pendente', paga: 'Paga', atrasada: 'Atrasada', cancelada: 'Cancelada/estornada' };
const freshForm = (): PayloadDespesa['criar'] => ({ descricao: '', categoria: 'outros', valor: '', dataVencimento: diaCivilBrt(), observacoes: '' });
const dataLabel = (d: string | null) => d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : 'Data requer conferência';
const acoes: AcaoDespesa[] = ['criar', 'pagar', 'estornar'];

export default function ContasPagar() {
  // Usar apenas o id do contexto de sessão; não persistir resposta de auth/tokens.
  const auth = trpc.auth.me.useQuery(undefined, { retry: false });
  const userId = auth.data?.id;
  const usuarioAtual = useRef(userId);
  usuarioAtual.current = userId;
  const [avisoStorage, setAvisoStorage] = useState('');
  const [intencoes, setIntencoes] = useState<IntencaoDespesaPersistida[]>([]);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [novo, setNovo] = useState(false);
  const [pagarId, setPagarId] = useState<number | null>(null);
  const [estornarId, setEstornarId] = useState<number | null>(null);
  const [contaCaixaId, setContaCaixaId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [form, setForm] = useState(freshForm);
  const store = useMemo(() => {
    if (!userId) return null;
    let storage: StorageDespesas | null = null;
    try { storage = window.sessionStorage; } catch { /* Store bloqueia recuperação incerta. */ }
    return new DespesasIntentStore(userId, storage, message => { setAvisoStorage(message); toast.error(message); });
  }, [userId]);
  function sync(s = store) { setIntencoes(s ? acoes.map(a => s.get(a)).filter((v): v is IntencaoDespesaPersistida => !!v) : []); }
  useEffect(() => { sync(store); }, [store]);
  const utils = trpc.useUtils();
  const expensesUtils = despesasTrpc.useUtils();
  const options = { enabled: !!userId, retry: false };
  const resumo = despesasTrpc.contasPagar.resumo.useQuery(undefined, options);
  const lista = despesasTrpc.contasPagar.listar.useQuery(filtroStatus === 'todos' ? undefined : { status: filtroStatus as 'pendente' | 'paga' | 'atrasada' | 'cancelada' }, options);
  const capacidades = despesasTrpc.contasPagar.capacidades.useQuery(undefined, options);
  const caixa = trpc.caixa.contas.useQuery(undefined, options);
  const criar = despesasTrpc.contasPagar.criar.useMutation({ retry: false });
  const pagar = despesasTrpc.contasPagar.pagar.useMutation({ retry: false });
  const estornar = despesasTrpc.contasPagar.estornar.useMutation({ retry: false });
  const habilitado = !!userId && capacidades.data?.prospectivasHabilitadas === true && !capacidades.isError;
  const locked = (action: AcaoDespesa) => busy || intencoes.some(i => i.action === action) || !!store?.blocked(action);
  const ativas = caixa.data?.filter(c => c.ativa !== false);
  const despesaPagar = lista.data?.find(d => d.id === pagarId);
  const despesaEstornar = lista.data?.find(d => d.id === estornarId);

  async function enviar(intent: IntencaoDespesaPersistida, s: DespesasIntentStore) {
    if (usuarioAtual.current !== intent.userId || inFlight.current || !s.acquire(intent.action)) return;
    inFlight.current = true; setBusy(true);
    try {
      const result = intent.action === 'criar' ? await criar.mutateAsync({ ...intent.payload, idempotencyKey: intent.idempotencyKey })
        : intent.action === 'pagar' ? await pagar.mutateAsync({ ...intent.payload, idempotencyKey: intent.idempotencyKey })
          : await estornar.mutateAsync({ ...intent.payload, idempotencyKey: intent.idempotencyKey });
      // Adapter valida confirmação integral no servidor; UI também não aceita falso sucesso/chave trocada.
      if (result.success !== true || result.acao !== intent.action || result.userId !== intent.userId || result.chaveIdempotencia.toLowerCase() !== intent.idempotencyKey.toLowerCase() || !result.operationId) throw new Error('Confirmação incompatível; requer conferência com a MESMA chave.');
      s.confirmed(intent.action, intent.idempotencyKey);
      if (usuarioAtual.current === intent.userId) {
        setNovo(false); setPagarId(null); setEstornarId(null); setMotivo(''); setForm(freshForm());
        toast.success(`${intent.action === 'criar' ? 'Despesa criada' : intent.action === 'pagar' ? 'Pagamento registrado' : 'Estorno registrado sem excluir a baixa'}. Operação ${result.operationId}`);
      }
      // Falha de atualização da consulta não altera o resultado já confirmado, nem dispara uma nova intenção.
      void Promise.allSettled([expensesUtils.contasPagar.listar.invalidate(), expensesUtils.contasPagar.resumo.invalidate(), utils.caixa.contas.invalidate(), utils.caixa.transacoes.invalidate(), utils.dashboard.kpis.invalidate()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Resultado desconhecido';
      if (usuarioAtual.current === intent.userId) toast.error(`${message} A intenção foi mantida: confira/reenvie a MESMA chave com o payload original. Não crie outra operação por timeout.`);
    } finally {
      s.release(intent.action); inFlight.current = false; setBusy(false);
      if (usuarioAtual.current === intent.userId) sync(s);
    }
  }
  function iniciar<A extends AcaoDespesa>(action: A, payload: PayloadDespesa[A]) {
    if (!store || !habilitado || inFlight.current || locked(action)) return;
    try {
      const intent = store.begin(action, payload);
      sync(store);
      void enviar(intent, store);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Intenção inválida.'); }
  }
  function novaDespesa() {
    const valor = dinheiroDespesa(form.valor.replace(',', '.'));
    const parsed = criarDespesaPayload.safeParse({ ...form, valor: valor ?? form.valor });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    iniciar('criar', parsed.data);
  }
  function baixa() {
    if (!despesaPagar?.podePagar || !lista.data || lista.isError || caixa.isError || !ativas?.some(c => String(c.id) === contaCaixaId)) { toast.error('Despesa/conta não elegível; requer conferência.'); return; }
    // Dia civil BRT calculado UMA vez ao formar a primeira intenção; retries usam o payload salvo.
    const parsed = pagarDespesaPayload.safeParse({ id: despesaPagar.id, contaCaixaId: Number(contaCaixaId), dataPagamento: diaCivilBrt() });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    iniciar('pagar', parsed.data);
  }
  function devolucao() {
    if (!despesaEstornar?.podeEstornar || !despesaEstornar.pagamentoOperationId || lista.isError) { toast.error('Pagamento original indisponível; requer conferência.'); return; }
    const parsed = estornarDespesaPayload.safeParse({ id: despesaEstornar.id, pagamentoOperationId: despesaEstornar.pagamentoOperationId, dataEstorno: diaCivilBrt(), motivo });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    iniciar('estornar', parsed.data);
  }

  return <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold flex gap-2"><Receipt />Contas a Pagar</h1><p className="text-sm text-muted-foreground">Despesas novas no trilho atômico; histórico somente consulta.</p></div>
      <Button disabled={!habilitado || locked('criar')} onClick={() => setNovo(true)}><Plus className="h-4 w-4 mr-2" />Nova despesa</Button>
    </div>
    <p className="text-sm border rounded-lg p-3">Legado requer conferência. Edição, cancelamento, exclusão e recorrência estão indisponíveis. Estorno acrescenta entrada do mesmo valor na conta original, sem apagar a saída; a obrigação fica encerrada.</p>
    {auth.isError ? <p role="alert">Erro ao identificar a sessão. Nenhuma operação disponível.</p> : auth.isLoading ? <p role="status">Carregando sessão...</p> : !userId ? <p role="alert">Autentique-se para consultar despesas.</p> : null}
    {userId && (capacidades.isError ? <p role="alert">Não foi possível verificar a disponibilidade do trilho. Escritas bloqueadas.</p> : capacidades.isLoading ? <p role="status">Verificando disponibilidade...</p> : !habilitado ? <p role="alert">Despesas prospectivas desabilitadas; nenhum lançamento será feito no legado.</p> : null)}
    {avisoStorage && <p role="alert" className="text-amber-500 border p-3 rounded-lg break-words">{avisoStorage}</p>}
    {intencoes.length > 0 && <section aria-label="Intenções a conferir" className="space-y-3 border border-amber-500 rounded-lg p-4">
      <h2 className="font-semibold">Intenções mantidas para conferência/retry</h2>
      <p className="text-sm">Uma falha não prova que houve rollback. Abaixo está o payload original; a data e o UUID não mudam após reload. Não existe descarte automático ou substituição por nova chave.</p>
      {intencoes.filter(i => i.userId === userId).map(i => <div key={i.idempotencyKey} className="space-y-2">
        <p className="text-sm break-all">{i.action} — UUID: {i.idempotencyKey}</p><pre className="text-xs whitespace-pre-wrap break-all bg-muted p-2">{JSON.stringify(i.payload, null, 2)}</pre>
        <Button variant="outline" disabled={busy || !habilitado || !store} onClick={() => store && void enviar(i, store)}>Reenviar intenção original (mesma chave)</Button>
      </div>)}
    </section>}
    <section aria-label="Resumo de despesas">
      {resumo.isError ? <div role="alert">Resumo indisponível: {resumo.error.message} <Button variant="outline" onClick={() => void resumo.refetch()}>Tentar consulta</Button></div>
        : resumo.isLoading || !resumo.data ? <p role="status">{userId ? 'Carregando resumo...' : 'Resumo indisponível sem sessão.'}</p>
          : <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[
            ['A pagar', resumo.data.totalPendente, resumo.data.qtdPendente], ['Em atraso', resumo.data.totalAtrasado, resumo.data.qtdAtrasado], ['Pagas (mês BRT)', resumo.data.totalPago, resumo.data.qtdPago],
          ].map(([label, total, qtd]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-sm">{label}</p><p className="text-xl font-bold">{moedaDespesa(String(total))}</p><p className="text-xs">{qtd} contas</p></CardContent></Card>)}</div>}
    </section>
    <div className="flex flex-wrap gap-2">{['todos', ...Object.keys(statuses)].map(s => <Button key={s} size="sm" variant={filtroStatus === s ? 'default' : 'outline'} onClick={() => setFiltroStatus(s)}>{s === 'todos' ? 'Todas' : statuses[s as keyof typeof statuses]}</Button>)}</div>
    <section aria-label="Lista de despesas" className="space-y-3">
      {lista.isError ? <div role="alert">Não foi possível consultar despesas: {lista.error.message} <Button variant="outline" onClick={() => void lista.refetch()}>Tentar consulta</Button></div>
        : lista.isLoading || !lista.data ? <p role="status">{userId ? 'Carregando despesas...' : 'Consulta indisponível sem sessão.'}</p>
          : lista.data.length === 0 ? <p>Nenhuma conta encontrada para este filtro.</p>
            : lista.data.map(d => <Card key={d.id}><CardContent className="p-4 space-y-2">
              <div className="flex justify-between gap-3"><div><p className="font-semibold">{d.descricao}</p><p className="text-xs text-muted-foreground">#{d.id} · {categorias[d.categoria as keyof typeof categorias] ?? d.categoria} · Vence: {dataLabel(d.dataVencimento)}</p></div><div className="text-right"><p className="font-bold">{moedaDespesa(d.valor)}</p><Badge variant="outline">{statuses[d.status as keyof typeof statuses] ?? d.status}</Badge></div></div>
              {d.observacoes && <p className="text-sm">{d.observacoes}</p>}
              {d.recorrente && <p className="text-xs">Recorrência histórica ({d.periodicidade ?? 'não informada'}); geração indisponível.</p>}
              {d.mensagemConferencia && <p className="text-sm text-amber-500">{d.mensagemConferencia}</p>}
              {d.podePagar && <Button size="sm" disabled={!habilitado || locked('pagar')} onClick={() => { setPagarId(d.id); setContaCaixaId(ativas?.length === 1 ? String(ativas[0].id) : ''); }}>Registrar pagamento atômico</Button>}
              {d.podeEstornar && <Button variant="outline" size="sm" disabled={!habilitado || locked('estornar')} onClick={() => { setEstornarId(d.id); setMotivo(''); }}><Undo2 className="h-4 w-4 mr-2" />Estornar pagamento original</Button>}
            </CardContent></Card>)}
    </section>
    <Dialog open={novo} onOpenChange={v => { if (!busy) setNovo(v); }}><DialogContent><DialogHeader><DialogTitle>Nova despesa avulsa atômica</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <Label htmlFor="despesa-descricao">Descrição</Label><Input id="despesa-descricao" disabled={locked('criar')} value={form.descricao} maxLength={255} onChange={e => setForm({ ...form, descricao: e.target.value })} />
        <Label>Categoria</Label><Select disabled={locked('criar')} value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v as PayloadDespesa['criar']['categoria'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categorias).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select>
        <Label htmlFor="despesa-valor">Valor exato (R$)</Label><Input id="despesa-valor" inputMode="decimal" placeholder="100,01" disabled={locked('criar')} value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
        <Label htmlFor="despesa-vencimento">Data civil de vencimento</Label><Input id="despesa-vencimento" type="date" disabled={locked('criar')} value={form.dataVencimento} onChange={e => setForm({ ...form, dataVencimento: e.target.value })} />
        <Label htmlFor="despesa-observacoes">Observações</Label><Textarea id="despesa-observacoes" disabled={locked('criar')} value={form.observacoes} maxLength={10000} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
        <p className="text-sm">Recorrência indisponível. Não há lançamentos automáticos.</p>
        <Button disabled={!habilitado || locked('criar')} onClick={novaDespesa}>{busy ? 'Aguardando confirmação...' : 'Criar despesa atômica'}</Button>
      </div>
    </DialogContent></Dialog>
    <Dialog open={pagarId !== null} onOpenChange={v => { if (!v && !busy) setPagarId(null); }}><DialogContent><DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
      <p>{despesaPagar?.descricao} — {despesaPagar ? moedaDespesa(despesaPagar.valor) : 'Requer conferência'}</p><p className="text-sm">A baixa utiliza o valor original, sem editar saldo-base. Data civil BRT fixada ao confirmar a primeira intenção.</p>
      {caixa.isError ? <p role="alert">Erro ao consultar contas de Caixa. Não é lista vazia.</p> : caixa.isLoading || !caixa.data ? <p role="status">Carregando contas de Caixa...</p> : !ativas?.length ? <p>Nenhuma conta ativa disponível.</p> : <><Label>Conta de Caixa</Label><Select disabled={locked('pagar')} value={contaCaixaId} onValueChange={setContaCaixaId}><SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger><SelectContent>{ativas.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent></Select></>}
      <Button onClick={baixa} disabled={!habilitado || locked('pagar') || !despesaPagar?.podePagar || lista.isError || caixa.isError || caixa.isLoading || !contaCaixaId}>Confirmar baixa integral</Button>
    </DialogContent></Dialog>
    <Dialog open={estornarId !== null} onOpenChange={v => { if (!v && !busy) setEstornarId(null); }}><DialogContent><DialogHeader><DialogTitle>Estornar baixa original (não excluir)</DialogTitle></DialogHeader>
      <p className="text-sm">Entrada de {despesaEstornar ? moedaDespesa(despesaEstornar.valor) : 'valor requer conferência'} na mesma conta #{despesaEstornar?.contaCaixaId}. A saída original será preservada e não haverá novo pagamento desta obrigação.</p>
      <p className="text-xs break-all">UUID original da baixa: {despesaEstornar?.pagamentoOperationId ?? 'Requer conferência'}</p><p className="text-xs">Saída original: {despesaEstornar?.transacaoSaidaId ?? 'Requer conferência'}</p>
      <Label htmlFor="despesa-motivo">Motivo obrigatório</Label><Textarea id="despesa-motivo" disabled={locked('estornar')} value={motivo} maxLength={2000} onChange={e => setMotivo(e.target.value)} />
      <Button onClick={devolucao} disabled={!habilitado || locked('estornar') || !despesaEstornar?.podeEstornar || lista.isError || !motivo.trim()}>Confirmar estorno do mesmo valor</Button>
    </DialogContent></Dialog>
  </div>;
}
