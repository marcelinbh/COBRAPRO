import { withFinance53,assertNoOtherFinance53 } from '../../../shared/financialCoordination53';
import { useEffect, useRef, useState } from 'react';
import { capacidadeInclusaoUi52 } from '../../../shared/inclusao52';
import { hashKey } from '@tanstack/react-query';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  canonical51, proposta51, intent51, int32_51, hash51,
  type Proposta51, type Quote51, type Projection51,
} from '../../../shared/obrigacoes51';
import {
  chaveJournal51, chaveLock51, lerJournal51, operarJournal51, encerrarJournal51, pendenciasLegadas48, pendenciasOutrasSessoes51,
  moedaUi51, diaBrasilia51, validarCotacaoUi51, validarEstadoUi51, contasPropriasUi51, capacidadeUi51,
  type Scope51, type Snapshot51,
} from '@/lib/obrigacoes51Journal';

export type AlvoObrigacao51 = { tipo: 'contrato' } | { tipo: 'parcela'; parcelaId: number };
export type OperacoesObrigacao51Props = {
  contratoId: number;
  alvoInicial?: AlvoObrigacao51;
  acaoInicial?: Proposta51['acao'];
  label?: string;
  inline?: boolean;
  onSuccess?: () => void | Promise<void>;
};
const sessao51 = z.object({ userId: int32_51, sessionScope: hash51 }).strict();
let cacheEpoch51 = 0;
const emptySnapshot: Snapshot51 = { raw: null, pending: null, terminal: null, archivedIntent: null };
const labels: Record<Proposta51['acao'], string> = {
  adicionar: 'Adicionar parcela manual', editar: 'Editar valor e/ou data da parcela',
  cancelar: 'Cancelar obrigação (sem estorno)', arquivar: 'Arquivar alvo encerrado', quitar: 'Quitar contrato com dinheiro recebido',
};

/** Identidade vem exclusivamente de auth.me + query sessao; alvoInicial é só prefill, nunca autorização. */
export function OperacoesObrigacao51(props: OperacoesObrigacao51Props) {
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: true });
  const owner = !auth.isError && !auth.isLoading && !auth.isFetching ? auth.data?.id : undefined;
  const identity = useRef({ owner, epoch: ++cacheEpoch51 });
  if (identity.current.owner !== owner) identity.current = { owner, epoch: ++cacheEpoch51 };
  const generation = identity.current;
  const session = trpc.obrigacoes51.sessao.useQuery(undefined, {
    enabled: !!owner, retry: false, staleTime: 0, gcTime: 0,
    initialData: undefined, placeholderData: undefined,
    refetchOnMount: 'always', refetchOnWindowFocus: true,
    queryKeyHashFn: key => hashKey(['obrigacoes-sessao', generation.epoch, owner ?? null, key]),
    trpc: { abortOnUnmount: true },
  });
  let current: z.infer<typeof sessao51> | null = null;
  try {
    if (owner && !session.isError && !session.isLoading && !session.isFetching) {
      const v = sessao51.parse(session.data);
      if (v.userId === owner) current = v;
    }
  } catch { /* Sem autenticação comprovada, não montar writer nem adotar cache. */ }
  const target = props.alvoInicial ?? { tipo: 'contrato' as const };
  const live = useRef<object | null>(null);
  const identityText = `${generation.epoch}:${current?.userId ?? ''}:${current?.sessionScope ?? ''}:${props.contratoId}:${canonical51(target)}:${props.acaoInicial ?? ''}`;
  const renderToken = useRef({ identityText });
  if (renderToken.current.identityText !== identityText) renderToken.current = { identityText };
  const token = renderToken.current;
  live.current = current ? token : null;
  useEffect(() => {
    live.current = current ? token : null;
    return () => { if (live.current === token) live.current = null; };
  }, [token]);
  const [opened, setOpened] = useState<object | null>(null);
  const open = props.inline || opened === token;
  const body = current && open ? <ObrigacaoSessao51 key={identityText}
    {...props} ownerId={current.userId} sessionScope={current.sessionScope}
    atualExterno={() => live.current === token}
    onSuccess={async () => { if (live.current === token) await props.onSuccess?.(); }} /> :
    <div className="space-y-2"><p role="status">Conferindo a sessão atual da empresa...</p>
      <Button variant="outline" onClick={() => void session.refetch()}>Conferir sessão novamente</Button></div>;
  if (props.inline) return body;
  return <><Button variant="outline" size="sm" onClick={() => setOpened(token)}>
    {props.label ?? (target.tipo === 'parcela' ? 'Editar / cancelar parcela' : 'Operações do contrato / conferir')}
  </Button><Dialog open={!!open} onOpenChange={value => setOpened(value ? token : null)}>
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Operações da obrigação</DialogTitle></DialogHeader>{body}</DialogContent>
  </Dialog></>;
}

export function ObrigacaoSessao51({ contratoId, ownerId, sessionScope, alvoInicial = { tipo: 'contrato' },
  acaoInicial, onSuccess, atualExterno = () => true,
}: OperacoesObrigacao51Props & { ownerId: number; sessionScope: string; atualExterno?: () => boolean }) {
  const scope: Scope51 = { ownerId, sessionScope, contratoId };
  const key = chaveJournal51(scope);
  const generation = useRef({ key }).current;
  const active = useRef<object | null>(generation);
  const flight = useRef(false);
  const disk = useRef<string | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot51>(emptySnapshot);
  const [journalError, setJournalError] = useState(''), [message, setMessage] = useState('');
  const [legacy, setLegacy] = useState<string[]>([]);
  const [previousSessionPending, setPreviousSessionPending] = useState<string[]>([]);
  const [action, setAction] = useState<Proposta51['acao']>(acaoInicial ?? (alvoInicial.tipo === 'parcela' ? 'editar' : 'adicionar'));
  const [parcelId, setParcelId] = useState(alvoInicial.tipo === 'parcela' ? String(alvoInicial.parcelaId) : '');
  const [targetKind, setTargetKind] = useState<AlvoObrigacao51['tipo']>(alvoInicial.tipo);
  const [value, setValue] = useState(''), [date, setDate] = useState(''), [reason, setReason] = useState('');
  const [accountId, setAccountId] = useState(''); // Nunca default conta de origem/primeira conta.
  const [consent, setConsent] = useState(false), [reviewed, setReviewed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [capability, setCapability] = useState(false), [state, setState] = useState<Projection51 | null>(null);
  const [accounts, setAccounts] = useState<ReturnType<typeof contasPropriasUi51> | null>(null);
  const [dataError, setDataError] = useState(''), [quoteError, setQuoteError] = useState('');
  const [quotation, setQuotation] = useState<{ q: Quote51; fingerprint: string } | null>(null);
  const utils = trpc.useUtils();
  const cacheId = useRef(++cacheEpoch51).current;
  const options = { enabled: false, retry: false as const, staleTime: 0, gcTime: 0,
    initialData: undefined, placeholderData: undefined, refetchOnWindowFocus: false,
    queryKeyHashFn: (queryKey: readonly unknown[]) => hashKey(['obrigacoes-dados', cacheId, ownerId, sessionScope, key, queryKey]),
    trpc: { abortOnUnmount: true },
  };
  const capabilitySource = trpc.obrigacoes51.capacidade.useQuery(undefined, options);
  const expandedSource = trpc.obrigacoes51.capacidadeInclusao.useQuery(undefined, options);
  const stateSource = trpc.obrigacoes51.estado.useQuery({ contratoId }, options);
  const accountsSource = trpc.caixa.contasParaOperacao37.useQuery(undefined, options);
  const execute = trpc.obrigacoes51.executar.useMutation({ retry: false });
  const recover = trpc.obrigacoes51.conferir.useMutation({ retry: false });
  const current = () => active.current === generation && atualExterno();
  const pending = snapshot.pending;
  const terminal = snapshot.terminal;
  let proposal: Proposta51 | null = null;
  try {
    const alvo: AlvoObrigacao51 = targetKind === 'contrato' ? { tipo: 'contrato' } : { tipo: 'parcela', parcelaId: Number(parcelId) };
    if (action === 'adicionar') {
      if (!consent) throw Error('Classificação precisa ser reconhecida.');
      proposal = proposta51.parse({ acao: action, valor: moedaUi51(value), dataVencimento: date, classificacao: 'obrigacao_adicional_nao_desembolsada' });
    } else if (action === 'editar') proposal = proposta51.parse({ acao: action, parcelaId: Number(parcelId),
      ...(value.trim() ? { novoValor: moedaUi51(value) } : {}), ...(date ? { novaDataVencimento: date } : {}) });
    else if (action === 'cancelar') {
      if (!consent) throw Error('Reconheça a renúncia sem estorno.');
      proposal = proposta51.parse({ acao: action, alvo, reconhecoSemEstorno: true });
    } else if (action === 'arquivar') proposal = proposta51.parse({ acao: action, alvo });
    else {
      if (!consent || !accounts?.some(c => c.id === Number(accountId))) throw Error('Escolha conta própria e confirme dinheiro real.');
      proposal = proposta51.parse({ acao: 'quitar', contaCaixaId: Number(accountId), valorRecebido: moedaUi51(value), reconhecoDinheiroReal: true });
    }
  } catch { /* Formulário incompleto não é autorização, total zero ou conta implícita. */ }
  const fingerprint = canonical51({ proposal, reason: reason.trim(), consent, accountId, state });
  const formLive = useRef(fingerprint); formLive.current = fingerprint;
  const q = quotation?.fingerprint === fingerprint ? quotation.q : null;
  const authorization = useRef({ q, proposal, reviewed, capability, expanded, state, accounts, reason, fingerprint, ready, journalError, pending });
  authorization.current = { q, proposal, reviewed, capability, expanded, state, accounts, reason, fingerprint, ready, journalError, pending };
  useEffect(() => { setReviewed(false); }, [fingerprint]);
  function syncDisk() {
    const loaded = lerJournal51(localStorage, scope);
    disk.current = loaded.raw; setSnapshot(loaded);
    setLegacy(pendenciasLegadas48(localStorage, scope));
    setPreviousSessionPending(pendenciasOutrasSessoes51(localStorage, scope));
    return loaded;
  }
  useEffect(() => {
    active.current = generation;
    try { syncDisk(); setReady(true); }
    catch (e) { setJournalError(`Não foi possível validar o journal: ${(e as Error).message} Preserve o armazenamento; nenhum envio autorizado.`); }
    return () => { active.current = null; };
  }, [generation]);
  async function loadData() {
    if (!current() || flight.current || !ready || pending) return;
    flight.current = true; setBusy(true); setCapability(false); setExpanded(false); setState(null); setAccounts(null);
    setQuotation(null); setReviewed(false); setDataError('');
    authorization.current.capability = false; authorization.current.expanded = false; authorization.current.q = null;
    try {
      const [cap, projection, metadata, expandedProof] = await Promise.allSettled([
        capabilitySource.refetch(), stateSource.refetch(), accountsSource.refetch(), expandedSource.refetch(),
      ]);
      if (!current()) return;
      const errors: string[] = [];
      if (expandedProof.status === 'fulfilled' && !expandedProof.value.isError && !expandedProof.value.isFetching && !expandedProof.value.isLoading && capacidadeInclusaoUi52(expandedProof.value.data)) setExpanded(true);
      try { if (cap.status !== 'fulfilled' || cap.value.isError || cap.value.isFetching || cap.value.isLoading) throw Error();
        capacidadeUi51.parse(cap.value.data); setCapability(true);
      } catch { errors.push('Módulo em atualização: novas operações aguardam disponibilidade comprovada. A conferência de intenção existente continua disponível.'); }
      try { if (projection.status !== 'fulfilled' || projection.value.isError || projection.value.isFetching || projection.value.isLoading) throw Error();
        setState(validarEstadoUi51(projection.value.data, scope));
      } catch { errors.push('Estado efetivo da obrigação indisponível. Não será presumido saldo zero ou parcela aberta.'); }
      try { if (metadata.status !== 'fulfilled' || metadata.value.isError || metadata.value.isFetching || metadata.value.isLoading) throw Error();
        setAccounts(contasPropriasUi51(metadata.value.data, ownerId));
      } catch { errors.push('Contas próprias indisponíveis para quitação; nenhuma conta será selecionada automaticamente.'); }
      setDataError(errors.join(' '));
    } finally { flight.current = false; if (current()) setBusy(false); }
  }
  useEffect(() => { if (ready && !pending && !journalError) void loadData(); }, [ready, !!pending]);
  async function quote() {
    const a = authorization.current;
    if ((a.proposal?.acao === 'adicionar' && !a.expanded) || !current() || flight.current || !a.ready || a.pending || a.journalError || !a.capability || !a.state || !a.proposal || legacy.length) return;
    const captured = a.proposal, fingerprintNow = a.fingerprint;
    flight.current = true; setBusy(true); setQuotation(null); setReviewed(false); setQuoteError('');
    authorization.current.q = null;
    try {
      const result = await utils.client.obrigacoes51.cotar.query({ contratoId, ownerId, sessionScope, proposta: captured });
      if (!current() || formLive.current !== fingerprintNow) return;
      const validated = validarCotacaoUi51(result, scope, captured);
      setQuotation({ q: validated, fingerprint: fingerprintNow });
    } catch (e) { if (current() && formLive.current === fingerprintNow) setQuoteError(`Cotação não disponível: ${(e as Error).message} Nada enviado; o erro não identifica por si só a origem do contrato.`); }
    finally { flight.current = false; if (current()) setBusy(false); }
  }
  function authorizedNew() {
    const a = authorization.current;
    if (legacy.length || previousSessionPending.length || (a.proposal?.acao === 'adicionar' && !a.expanded)) return false;
    if (!current() || !a.ready || a.pending || a.journalError || !a.capability || !a.state || !a.q || !a.proposal || !a.reviewed ||
      a.fingerprint !== formLive.current || a.reason.trim().length < 3 || a.reason.trim().length > 500) return false;
    try {
      validarEstadoUi51(a.state, scope); validarCotacaoUi51(a.q, scope, a.proposal, diaBrasilia51());
      if (a.proposal.acao === 'quitar' && !a.accounts?.some(c => c.id === (a.proposal as Extract<Proposta51, { acao: 'quitar' }>).contaCaixaId)) return false;
      return true;
    } catch { return false; }
  }
  async function send(mode: 'novo' | 'repetir' | 'conferir') {
    if (!current() || flight.current || !ready || journalError) return;
    if (mode === 'novo' ? !authorizedNew() : !pending || !!terminal) return;
    flight.current = true; setBusy(true); setMessage('');
    try {
      const a = authorization.current;
      const nova = mode === 'novo' ? intent51.parse({ contratoId, ownerId, sessionScope,
        proposta: a.proposal, estadoHash: a.q!.estadoHash, dataCalculo: a.q!.dataCalculo,
        idempotencyKey: crypto.randomUUID(), motivo: a.reason.trim(),
      }) : undefined;
      const loaded = await operarJournal51({ storage: localStorage, locks: navigator.locks ? {request:(name,fn)=>withFinance53(navigator.locks,scope.ownerId,name,async()=>{if(!lerJournal51(localStorage,scope).pending)assertNoOtherFinance53(localStorage,scope.ownerId,chaveJournal51(scope),true);return fn();})} : undefined, scope,
        expected: disk.current, atual: current, mode, nova, autorizarNovo: authorizedNew,
        onPersisted: saved => { if (current()) { disk.current = saved.raw; setSnapshot(saved); setQuotation(null); setReviewed(false); } },
        post: exact => mode === 'conferir' ? recover.mutateAsync(exact) : execute.mutateAsync(exact),
      });
      if (!current()) return;
      disk.current = loaded.raw; setSnapshot(loaded); setQuotation(null); setReviewed(false);
      setMessage(loaded.terminal?.status === 'confirmed' ? 'Operação confirmada e prova arquivada. Valores da prova são históricos, não o saldo atual.' : 'Não execução comprovada: esta UUID foi fechada permanentemente pelo servidor.');
    } catch (e) {
      if (current()) {
        setMessage(`${(e as Error).message} Resultado não confirmado não prova rollback. Preserve UUID e pedido; confira a mesma intenção.`);
        try { syncDisk(); } catch (error) { setJournalError((error as Error).message); }
      }
    } finally { flight.current = false; if (current()) setBusy(false); }
  }
  async function finish() {
    if (!current() || flight.current || !snapshot.pending || !snapshot.terminal || !disk.current) return;
    flight.current = true; setBusy(true);
    let confirmed = false;
    try {
      const loaded = await encerrarJournal51(localStorage, navigator.locks ? {request:(name,fn)=>withFinance53(navigator.locks,scope.ownerId,name,fn)} : undefined, scope, disk.current, current);
      if (!current()) return;
      disk.current = loaded.raw; setSnapshot(loaded); setQuotation(null); setReviewed(false); setConsent(false);
      setCapability(false); setState(null); setValue(''); setDate(''); setReason(''); setAccountId('');
      confirmed = loaded.terminal?.status === 'confirmed';
      setMessage(confirmed ? 'Confirmação encerrada. Histórico e prova preservados; uma nova operação exige nova cotação e novo gesto.' : 'Fence arquivado. Nova operação exige nova cotação e novo gesto.');
    } catch (e) { if (current()) setMessage((e as Error).message); }
    finally { flight.current = false; if (current()) setBusy(false); }
    if (confirmed && current()) {
      // Falha de UI/invalidação jamais retorna para executar/conferir financeiro.
      let refreshFailed = false;
      try { await utils.invalidate(); } catch { refreshFailed = true; }
      try { if (current()) await onSuccess?.(); } catch { refreshFailed = true; }
      if (refreshFailed && current()) setMessage('Operação confirmada e prova preservada. Atualização da tela pendente; não repita o financeiro.');
    }
  }
  async function reread() {
    if (!current() || flight.current || !navigator.locks) return;
    flight.current = true; setBusy(true);
    try { await withFinance53(navigator.locks,scope.ownerId,chaveLock51(scope), async () => { if (current()) { syncDisk(); setJournalError(''); setReady(true); } }); }
    catch (e) { if (current()) setJournalError((e as Error).message); }
    finally { flight.current = false; if (current()) setBusy(false); }
  }
  const displayIntent = pending ?? snapshot.archivedIntent;
  return <section className="space-y-4" aria-label="Operações da obrigação">
    <p>Contrato #{contratoId}. {alvoInicial.tipo === 'parcela' ? `Alvo inicial: parcela #${alvoInicial.parcelaId}.` : 'Alvo inicial: contrato completo.'} A elegibilidade é conferida no servidor.</p>
    <p className="text-sm text-muted-foreground">Adicionar parcela cria obrigação adicional não desembolsada, sem saída de dinheiro. Cancelar é renúncia, não estorno: recebimentos anteriores, caixa e histórico são preservados. Arquivar só oculta um alvo encerrado, sem apagá-lo. Quitação registra dinheiro realmente recebido no caixa escolhido em uma única operação global.</p>
    {journalError && <p role="alert">{journalError}</p>}
    {legacy.length > 0 && <p role="alert">Existe manutenção de juros/valores pendente neste contrato: {legacy.join(', ')}. Confira e arquive pelo botão “Manutenção / cancelamento — juros, valores e descontos”. Nada será migrado, adotado ou apagado. {pending ? 'A intenção atual exata ainda pode ser conferida.' : 'Novas operações aguardam somente essa pendência concreta.'}</p>}
    {previousSessionPending.length > 0 && <p role="alert">Há intenção deste contrato em sessão anterior: {previousSessionPending.join(', ')}. Retome a sessão original para conferir. Não apague nem adote o journal; nova UUID não contorna pendência incerta. {pending && 'A intenção exata desta sessão continua recuperável.'}</p>}
    {!ready && <p role="status">Lendo a intenção durável...</p>}
    <Button variant="outline" disabled={busy} onClick={() => void reread()}>Reler intenção preservada</Button>
    {message && <p role="status">{message}</p>}
    {pending ? <div className="rounded border p-3 space-y-3">
      <p className="break-all">UUID preservada: <code>{pending.idempotencyKey}</code>. Data de cálculo: {pending.dataCalculo}.</p>
      <p>Pedido exato: {labels[pending.proposta.acao]} • {JSON.stringify(pending.proposta)} • Motivo: {pending.motivo}</p>
      {terminal ? <><p role="status">{terminal.status === 'confirmed' ? `Confirmada. Operação ${terminal.resultado.operationId}. Caixa ${terminal.resultado.caixaPreservado ? 'preservado' : `recebeu R$ ${terminal.resultado.valorRecebido} na conta #${terminal.resultado.contaDestinoId}`}.` : 'Fence terminal válido: não execução comprovada, não é recebimento ou estorno.'} Prova exata arquivada com leitura de volta.</p>
        <Button disabled={busy} onClick={() => void finish()}>Encerrar confirmação / fence arquivado</Button></> : <>
        <p>Resposta incerta, ausência e timeout não liberam outro pedido. Fechar a tela não cancela dinheiro. Conferência utiliza o mesmo lock e a intenção original; não exige capacidade para criar novas operações.</p>
        <div className="flex flex-wrap gap-2"><Button disabled={busy || !!journalError} variant="outline" onClick={() => void send('conferir')}>Conferir mesma intenção</Button>
          <Button disabled={busy || !!journalError} variant="outline" onClick={() => void send('repetir')}>Repetir pedido exato</Button></div></>}
    </div> : <>
      {snapshot.terminal && displayIntent && <p role="status">Última intenção arquivada: {snapshot.terminal.status === 'confirmed' ? 'confirmada' : 'fechada sem execução'} • <code>{displayIntent.idempotencyKey}</code>. Este registro histórico não autoriza novo envio.</p>}
      {dataError && <p role="alert">{dataError}</p>}
      <Button variant="outline" disabled={busy || !ready || !!journalError} onClick={() => void loadData()}>Conferir disponibilidade e estado novamente</Button>
      {state ? <div className="rounded border p-3"><p>Estado efetivo: {state.statusObrigacao} • {state.arquivado ? 'arquivado' : 'não arquivado'}. Obrigação adicional: R$ {state.obrigacaoAdicional}.</p>
        {state.parcelas.map(p => <p key={p.parcelaId}>Parcela #{p.parcelaId}: {p.statusObrigacao} • R$ {p.obrigacaoAtual} • adicional R$ {p.componenteAdicional} • financeiro original {p.statusFinanceiroOriginal}{p.arquivada ? ' • arquivada' : ''}</p>)}</div> : <p role="status">Estado da obrigação ainda não comprovado. Nenhum valor será presumido.</p>}
      <fieldset disabled={busy || !ready || !!journalError || legacy.length > 0} className="space-y-3">
        <label className="block">Operação<select aria-label="Operação da obrigação" className="w-full rounded border bg-background p-2" value={action} onChange={e => { setAction(e.target.value as Proposta51['acao']); setConsent(false); setReviewed(false); setQuotation(null); setValue(''); setDate(''); setAccountId(''); }}>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {(action === 'cancelar' || action === 'arquivar') && <label className="block">Alvo<select aria-label="Alvo da operação" className="w-full rounded border bg-background p-2" value={targetKind} onChange={e => setTargetKind(e.target.value as AlvoObrigacao51['tipo'])}><option value="contrato">Contrato completo</option><option value="parcela">Somente a parcela escolhida</option></select></label>}
        {(action === 'editar' || ((action === 'cancelar' || action === 'arquivar') && targetKind === 'parcela')) && <label className="block">Parcela<select aria-label="Parcela alvo" className="w-full rounded border bg-background p-2" value={parcelId} onChange={e => setParcelId(e.target.value)}><option value="">Escolha uma parcela</option>{state?.parcelas.map(p => <option key={p.parcelaId} value={p.parcelaId}>#{p.parcelaId} • {p.statusObrigacao} • R$ {p.obrigacaoAtual}</option>)}</select></label>}
        {action === 'quitar' && <><p>Quitação GLOBAL do contrato, não apenas da parcela. Digite o total efetivamente recebido; o servidor exige igualdade com o total devido e confirma a conta escolhida. Nas origens com conta vinculada, outra conta é recusada, nunca substituída.</p>
          <label className="block">Conta do caixa que recebeu<select aria-label="Conta que recebeu o dinheiro" className="w-full rounded border bg-background p-2" value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">Selecione explicitamente</option>{accounts?.map(c => <option key={c.id} value={c.id}>{c.nome} (#{c.id})</option>)}</select></label></>}
        {(action === 'adicionar' || action === 'editar' || action === 'quitar') && <label className="block">{action === 'editar' ? 'Novo valor da parcela (opcional se alterar a data)' : action === 'quitar' ? 'Dinheiro realmente recebido (R$)' : 'Valor da obrigação adicional (R$)'}<Input aria-label="Valor da operação" value={value} inputMode="decimal" placeholder="100,00" onChange={e => setValue(e.target.value)} /></label>}
        {(action === 'adicionar' || action === 'editar') && <label className="block">{action === 'editar' ? 'Novo vencimento individual (opcional se alterar valor)' : 'Vencimento explícito da obrigação A no próximo período canônico'}<Input aria-label="Data de vencimento da operação" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>}
        {action === 'editar' && <p className="text-sm">Valor e data informados juntos serão aplicados no mesmo pedido, somente na parcela selecionada. O servidor valida principal e vizinhos do calendário.</p>}
        <label className="block">Motivo auditável<Input aria-label="Motivo da operação" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></label>
        {(action === 'adicionar' || action === 'cancelar' || action === 'quitar') && <label className="flex items-start gap-2"><input aria-label="Reconhecer natureza da operação" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{action === 'adicionar' ? 'Reconheço obrigação adicional NÃO desembolsada. Não representa novo empréstimo, principal enviado, juros contratuais ou caixa.' : action === 'cancelar' ? 'Autorizo renúncia à obrigação selecionada SEM estorno, devolução presumida do capital ou apagamento do histórico.' : `Confirmo dinheiro real recebido na conta explicitamente escolhida ${accountId ? `#${accountId}` : '(a selecionar)'}, para quitar o contrato inteiro.`}</label>}
        <Button variant="outline" disabled={!proposal || !capability || (action === 'adicionar' && !expanded) || !state || busy || reason.trim().length < 3} onClick={() => void quote()}>Obter cotação e prévia</Button>
      </fieldset>
      {action === 'adicionar' && !expanded && <p role="alert">Inclusão expandida indisponível: capacidade52 exata necessária. Price, legado não mensal e contratos pagos/parciais permanecem fora do recorte. Conferência de intenção existente permanece disponível.</p>}
      {quoteError && <p role="alert">{quoteError}</p>}
      {q && <div className="rounded border p-3 space-y-2" aria-label="Prévia autoritativa da obrigação"><p>{labels[q.proposta.acao]} • data Brasília: {q.dataCalculo}. Total anterior R$ {q.totalAntes} → total posterior R$ {q.totalDepois}. Obrigação adicional R$ {q.obrigacaoAdicional}.</p><p>Parcelas afetadas: {q.idsAfetados.join(', ')}. {q.caixaPreservado ? 'Caixa e recebimentos anteriores preservados.' : `Entrada real R$ ${q.valorExigido} na conta #${q.contaDestinoId} (${accounts?.find(c => c.id === q.contaDestinoId)?.nome ?? 'nome indisponível'}).`}</p><p className="break-all text-xs">Snapshot: {q.estadoHash}. A cotação não reserva valores; mudança de estado/dia exige nova cotação.</p>
        <label className="flex items-center gap-2"><input aria-label="Confirmar prévia exata" type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Revisei a proposta, o alvo, a data, os valores e a conta desta prévia.</label></div>}
      <Button disabled={busy || !authorizedNew() || legacy.length > 0} onClick={() => void send('novo')}>Confirmar operação cotada</Button>
    </>}
    {busy && <p role="status">Conferindo operação. Não crie outro pedido; fechar não cancela execução.</p>}
  </section>;
}
