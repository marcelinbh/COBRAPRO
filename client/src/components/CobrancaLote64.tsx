import React, { useEffect, useRef, useState } from 'react';
import { preview64Schema, resultado64Schema, type Preparar64, type Preview64, type Resultado64, type Tipo64 } from '../../../shared/cobrancaLote64';

export type ApiLote64 = {
  preparar: (input: Preparar64) => Promise<Preview64>;
  enviar: (token: string) => Promise<Resultado64>;
  status: () => Promise<{ connected: boolean }>;
};
export const rotulosResultado64: Record<Resultado64['status'], string> = {
  aceito_evolution: 'Aceita pela Evolution — entrega ainda não confirmada',
  entregue: 'Entrega confirmada por recibo', lido: 'Leitura confirmada por recibo',
  nao_solicitado: 'Não solicitada', desconhecido: 'Resultado desconhecido — não reenviar automaticamente',
  em_processamento: 'Em processamento — aguarde e confira', ignorado: 'Não elegível nesta conferência',
};
const botao64 = 'min-h-11 max-w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Só handlers explícitos. Nada é enviado no mount, efeitos, prévia ou atualização de resultados. */
export function CobrancaLote64({ userId, contratoIds, api, onBusy }: {
  userId: number; contratoIds: number[]; api: ApiLote64; onBusy: (value: boolean) => void;
}) {
  const [tipo, setTipo] = useState<Tipo64>('atraso');
  const [preview, setPreview] = useState<Preview64 | null>(null);
  const [resultados, setResultados] = useState<Resultado64[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const lock = useRef(false), revision = useRef(0), live = useRef(false), tentou = useRef(false);
  const selectionKey = [...contratoIds].sort((a, b) => a - b).join(',');
  useEffect(() => {
    live.current = true; revision.current++;
    setPreview(null); setResultados([]); setConfirmado(false); setConnected(null); setTentouEnviar(false); tentou.current = false;
    return () => { live.current = false; revision.current++; lock.current = false; };
  }, [userId, selectionKey]);
  const atual = (ticket: number) => live.current && ticket === revision.current;
  const validarPreview = (raw: unknown) => {
    const value = preview64Schema.parse(raw);
    if (value.userId !== userId || value.items.length !== contratoIds.length ||
      new Set(value.items.map(item => item.contratoId)).size !== contratoIds.length ||
      value.items.some(item => !contratoIds.includes(item.contratoId))) throw Error('Conferência divergente');
    if (value.items.some(item => item.estado === 'pronto' && (!item.token || !item.mensagem || !item.contatoMascarado || !item.clienteNome))) throw Error('Prévia incompleta');
    return value;
  };
  const conferir = async () => {
    if (lock.current || !live.current) return;
    const ticket = ++revision.current; lock.current = true; setBusy(true); setAviso(''); setConfirmado(false);
    // Não há nova solicitação de envio neste caminho, mesmo depois de um timeout.
    try {
      const [raw, status] = await Promise.all([api.preparar({ contratoIds: [...contratoIds], tipo }), api.status()]);
      const value = validarPreview(raw);
      if (!atual(ticket)) return;
      setPreview(value); setConnected(status.connected === true);
      setResultados(value.items.flatMap(item => item.registro ? [item.registro] : []));
      if (tentou.current) setAviso('Conferência atualizada sem reenviar. Solicitações já registradas não são repetidas nesta tela.');
    } catch {
      if (atual(ticket)) { setPreview(null); setConnected(null); setAviso('Não foi possível confirmar a prévia ou a conexão. Nenhuma mensagem foi enviada por esta conferência.'); }
    } finally {
      if (atual(ticket)) { lock.current = false; setBusy(false); }
    }
  };
  const prontos = preview?.items.filter(item => item.estado === 'pronto' && !!item.token) ?? [];
  const enviar = async () => {
    if (lock.current || tentou.current || !live.current || !confirmado || !connected || !preview || prontos.length === 0) return;
    const ticket = revision.current; lock.current = true; tentou.current = true; setTentouEnviar(true);
    setBusy(true); onBusy(true); setAviso(''); setConfirmado(false);
    const obtidos: Resultado64[] = preview.items.flatMap(item => item.registro ? [item.registro] : []);
    try {
      for (const item of prontos) {
        if (!atual(ticket)) return;
        let result: Resultado64;
        try {
          result = resultado64Schema.parse(await api.enviar(item.token!));
          if (result.contratoId !== item.contratoId) throw Error('Resultado divergente');
        } catch {
          result = { contratoId: item.contratoId, status: 'desconhecido', motivo: 'A resposta não foi confirmada. Use Atualizar resultados, sem reenviar.', providerMessageId: null, outboxId: null };
          obtidos.push(result);
          if (atual(ticket)) {
            setResultados([...obtidos]);
            setAviso('O lote foi interrompido porque uma resposta não foi confirmada. Os contratos seguintes não foram solicitados por esta tela. Atualize os resultados, sem reenviar.');
          }
          break;
        }
        if (!atual(ticket)) return;
        obtidos.push(result); setResultados([...obtidos]);
      }
    } finally {
      if (atual(ticket)) { lock.current = false; setBusy(false); onBusy(false); }
    }
  };
  return <section aria-label="Conferência do lote WhatsApp" className="min-w-0 space-y-4 border-t border-border pt-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-auto">Tipo de mensagem
        <select value={tipo} disabled={busy} onChange={event => {
          if (lock.current) return;
          revision.current++; setTipo(event.target.value as Tipo64); setPreview(null); setResultados([]); setConfirmado(false); setConnected(null); setAviso(''); setTentouEnviar(false); tentou.current = false;
        }} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <option value="atraso">Vencidos</option><option value="vence_hoje">Vencem hoje</option><option value="preventivo">Lembrete de vencimento futuro</option>
        </select>
      </label>
      <button type="button" disabled={busy} onClick={() => { void conferir(); }} className={botao64}>{tentouEnviar ? 'Atualizar resultados sem reenviar' : 'Conferir mensagens'}</button>
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">Uma mensagem por contrato: a primeira parcela elegível para o tipo escolhido. A prévia usa o valor registrado da obrigação; não é uma cotação de multa ou juros atualizados. Confira esses acréscimos na ficha antes de cobrar.</p>
    {busy && <p role="status" className="text-sm">{tentouEnviar ? 'Processando solicitações confirmadas, uma por vez...' : 'Conferindo dados e conexão, sem enviar...'}</p>}
    {aviso && <p role="alert" className="rounded-lg border border-amber-500/30 p-3 text-sm leading-relaxed">{aviso}</p>}
    {connected !== null && <p role="status" className="text-sm">WhatsApp da sua empresa: {connected ? 'conectado na conferência' : 'conexão não confirmada'}. {!connected && <a href="/whatsapp" className="underline underline-offset-4">Abrir conexão QR existente</a>}</p>}
    {preview && <>
      <p className="text-sm">Data de referência em Brasília: <time dateTime={preview.dataReferencia}>{preview.dataReferencia.split('-').reverse().join('/')}</time>. {prontos.length} mensagens elegíveis nesta prévia.</p>
      <div className="grid min-w-0 gap-3 lg:grid-cols-2" aria-label="Prévias das mensagens">
        {preview.items.map(item => <article key={item.contratoId} aria-label={`Prévia do empréstimo ${item.contratoId}`} className="min-w-0 rounded-lg border border-border bg-background p-3 text-foreground space-y-2">
          <h4 className="break-words [overflow-wrap:anywhere] text-sm font-semibold">Empréstimo #{item.contratoId}{item.clienteNome ? ` — ${item.clienteNome}` : ''}</h4>
          {item.contatoMascarado && <p className="text-xs text-muted-foreground">Destino cadastrado: {item.contatoMascarado}</p>}
          {item.mensagem && <p className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg bg-muted/40 p-3 text-sm leading-relaxed">{item.mensagem}</p>}
          <p className="text-xs leading-relaxed text-muted-foreground">{item.motivo}</p>
          {item.registro && <p className="text-sm font-medium">{rotulosResultado64[item.registro.status]}</p>}
        </article>)}
      </div>
      {!tentouEnviar && <div className="space-y-3 rounded-lg border border-border p-3">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed">
          <input type="checkbox" checked={confirmado} disabled={busy || !connected || prontos.length === 0} onChange={event => setConfirmado(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-primary" />
          Conferi os destinatários e as mensagens e autorizo o envio das mensagens elegíveis pela conexão WhatsApp da minha empresa.
        </label>
        <button type="button" disabled={busy || !connected || !confirmado || prontos.length === 0} onClick={() => { void enviar(); }} className={`${botao64} border-primary bg-primary text-primary-foreground`}>Confirmar envio de {prontos.length} {prontos.length === 1 ? 'mensagem' : 'mensagens'}</button>
      </div>}
    </>}
    {resultados.length > 0 && <section aria-label="Resultados do lote" className="space-y-3 border-t border-border pt-3">
      <h4 className="font-semibold">Resultados das solicitações</h4>
      <p className="text-xs leading-relaxed text-muted-foreground">Aceite da Evolution não prova entrega nem leitura. Entrega e leitura só aparecem quando há recibo associado. Uma solicitação por contrato, tipo e dia: registro em andamento ou incerto não é reenviado automaticamente.</p>
      <ol className="space-y-2">{resultados.map(item => <li key={item.contratoId} className="min-w-0 rounded-lg border border-border p-3 text-sm break-words [overflow-wrap:anywhere]">
        <p className="font-medium">Empréstimo #{item.contratoId}: {rotulosResultado64[item.status]}</p><p className="mt-1 text-xs text-muted-foreground">{item.motivo}</p>
      </li>)}</ol>
    </section>}
  </section>;
}
