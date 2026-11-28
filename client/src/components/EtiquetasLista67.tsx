import React, { useEffect, useRef, useState } from 'react';
import type { ListaSeguraEmprestimos } from '../../../shared/emprestimosListaSegura';
import type { AplicarEtiquetasInput67, CatalogoEtiqueta67, EtiquetasConfirmadas67 } from '../../../shared/emprestimosListaControles67';
export type ApiEtiquetas67 = {
  criar: (input: { nome: string; cor: string }) => Promise<unknown>;
  remover: (input: { id: string }) => Promise<unknown>;
  aplicar: (input: AplicarEtiquetasInput67) => Promise<unknown>;
  atualizar: () => Promise<unknown>;
};
export type EditorLista67 = { contratoId: number; etiquetas: EtiquetasConfirmadas67 };
export type RenderEtiquetas67 = (props: { editor: EditorLista67 | null; fechar: () => void; onBusy: (v: boolean) => void }) => React.ReactNode;
/** Único editor; mutation somente por confirmação, nunca durante render/card. */
export function EtiquetasLista67({ data, editor, api, fechar, onBusy }: {
  data: ListaSeguraEmprestimos; editor: EditorLista67 | null; api: ApiEtiquetas67; fechar: () => void; onBusy: (v: boolean) => void;
}) {
  const [nomes, setNomes] = useState(editor?.etiquetas.nomes ?? []);
  const [nome, setNome] = useState(''); const [cor, setCor] = useState('#6b7280');
  const [busy, setBusy] = useState(false); const [aviso, setAviso] = useState(''); const [reconfirmar, setReconfirmar] = useState(false);
  const fence = useRef({ data, epoch: 0, mounted: true, owner: data.userId, ownerEpoch: 0, reconfirmar: false }); const pending = useRef<number | null>(null);
  if (fence.current.owner !== data.userId) { fence.current.owner = data.userId; fence.current.ownerEpoch++; }
  if (fence.current.data !== data) { fence.current.data = data; fence.current.epoch++; }
  useEffect(() => { fence.current.mounted = true; return () => { fence.current.mounted = false; fence.current.epoch++; fence.current.ownerEpoch++; }; }, []);
  const org = data.organizacao67;
  if (org?.state !== 'confirmed') return null;
  const catalogo: CatalogoEtiqueta67[] = org.catalogo;
  const executar = async (fn: () => Promise<unknown>) => {
    if (!fence.current.mounted || pending.current !== null || busy || reconfirmar || fence.current.reconfirmar) return;
    const epoch = ++fence.current.epoch, snapshot = data, ownerEpoch = fence.current.ownerEpoch;
    pending.current = epoch;
    // Refetch invalida a resposta, não a posse da tentativa; owner ABA/unmount invalidam ambas.
    const propria = () => fence.current.mounted && pending.current === epoch && fence.current.owner === snapshot.userId && fence.current.ownerEpoch === ownerEpoch;
    const atual = () => propria() && fence.current.epoch === epoch && fence.current.data === snapshot;
    const exigirReconfirmacao = () => { fence.current.reconfirmar = true; setReconfirmar(true); };
    setBusy(true); setAviso(''); onBusy(true);
    try {
      await fn();
      if (!atual()) return;
      setAviso('Confirmado. Atualizando a consulta segura...');
      exigirReconfirmacao(); await api.atualizar();
      if (atual()) fechar();
    } catch {
      if (atual()) { setAviso('Resultado não confirmado ou conflito. Atualize a consulta e reconfirme; não haverá repetição automática.'); exigirReconfirmacao(); }
    } finally { if (propria()) { if (!atual()) exigirReconfirmacao(); pending.current = null; setBusy(false); onBusy(false); } }
  };
  return <section aria-label="Editor único de etiquetas67" className="space-y-3 rounded-xl border border-border bg-card p-4">
    <h3 className="font-semibold">{editor ? `Etiquetas do empréstimo #${editor.contratoId}` : 'Catálogo próprio de etiquetas'}</h3>
    <p className="text-sm text-muted-foreground">Organização privada ALLscope dos validados; não altera contrato, obrigação ou caixa. Rótulos históricos sem catálogo têm apresentação neutra.</p>
    {aviso && <p role="alert">{aviso}</p>}
    <fieldset disabled={busy || reconfirmar} className="space-y-3">
      {editor && <>
        <div className="flex flex-wrap gap-3">{[...new Set([...editor.etiquetas.nomes, ...catalogo.map(c => c.nome)])].map(n => <label key={n} className="inline-flex min-h-11 items-center gap-2 break-words">
          <input type="checkbox" checked={nomes.includes(n)} onChange={() => setNomes(current => current.includes(n) ? current.filter(x => x !== n) : [...current, n])} />
          {n}{!catalogo.some(c => c.nome === n) && ' (histórico)'}
        </label>)}</div>
        <button type="button" className="min-h-11 rounded-lg border px-3" disabled={nomes.length > 32} onClick={() => void executar(() => api.aplicar({ contratoId: editor.contratoId, nomes, revisao: editor.etiquetas.revisao, estadoHash: editor.etiquetas.estadoHash }))}>Confirmar etiquetas</button>
      </>}
      <div className="flex flex-wrap items-end gap-3">
        <label>Nome da nova etiqueta<input aria-label="Nome da nova etiqueta" maxLength={80} value={nome} onChange={e => setNome(e.target.value)} className="block min-h-11 rounded border px-3" /></label>
        <label>Cor<input aria-label="Cor da nova etiqueta" type="color" value={cor} onChange={e => setCor(e.target.value)} className="block min-h-11" /></label>
        <button type="button" disabled={!nome.trim()} className="min-h-11 rounded-lg border px-3" onClick={() => void executar(() => api.criar({ nome: nome.trim(), cor }))}>Criar no catálogo próprio</button>
      </div>
      <ul>{catalogo.map(c => <li key={c.id} className="flex flex-wrap items-center gap-3 break-words"><span style={{ borderColor: c.cor }} className="rounded border px-2">{c.nome}</span><button type="button" className="min-h-11 px-3 underline" onClick={() => { if (window.confirm(`Remover “${c.nome}” do catálogo? Rótulos aplicados permanecem históricos.`)) void executar(() => api.remover({ id: c.id })); }}>Remover do catálogo: {c.nome}</button></li>)}</ul>
    </fieldset>
    <button type="button" disabled={busy} className="min-h-11 rounded-lg border px-3" onClick={() => { if (!pending.current) fechar(); }}>Fechar editor</button>
    {reconfirmar && <button type="button" disabled={busy} className="min-h-11 rounded-lg border px-3" onClick={() => { fechar(); void api.atualizar(); }}>Atualizar para reconfirmar</button>}
  </section>;
}
