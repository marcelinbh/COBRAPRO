import { confirmarConferenciaAssinatura42, type PagamentoAssinatura42, type ConferenciaAssinatura42 } from './assinaturas42';
import { carregarIntencaoAssinatura42, persistirIntencaoAssinatura42, concluirIntencaoAssinatura42, type Locks42 } from './assinaturas42Intent';
/** Geração muda também em A→B→A; nunca confiar no owner capturado por closure de React. */
export function criarEscopoAssinatura42() {
  let owner: number | null = null, generation = 0, mounted = false;
  return {
    owner(id: number | null) { if (owner !== id) { owner = id; generation++; } },
    montar() { mounted = true; generation++; },
    desmontar() { mounted = false; generation++; },
    capturar(id: number) { const g = generation; return () => mounted && owner === id && generation === g; },
  };
}
type Flow42 = {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>; locks: Locks42 | undefined;
  owner: number; atual: () => boolean; novo?: PagamentoAssinatura42;
  executar: (input: PagamentoAssinatura42) => Promise<unknown>;
  pendente: (input: PagamentoAssinatura42) => void;
  comprovado: (proof: ConferenciaAssinatura42) => void;
  erro: (error: unknown) => void; finalizado: () => void;
};
/** Conferir usa somente a RPC de fence; o fluxo não gera UUID nem faz retry implícito. */
export async function executarFluxoAssinatura42(options: Flow42): Promise<void> {
  const o = options;
  try {
    if (!o.atual()) return;
    const input = o.novo
      ? await persistirIntencaoAssinatura42(o.storage, o.locks, o.owner, o.novo, o.atual)
      : carregarIntencaoAssinatura42(o.storage, o.owner);
    if (!input) throw new Error('Nenhuma intenção preservada.');
    if (!o.atual()) return;
    o.pendente(input);
    const proof = confirmarConferenciaAssinatura42(await o.executar(input), input);
    if (!o.atual()) return;
    const removed = await concluirIntencaoAssinatura42(o.storage, o.locks, o.owner, input, proof, o.atual);
    if (!o.atual()) return;
    // Uma intenção rival jamais é apagada nem apresentada como liberada.
    if (!removed) throw new Error('Journal mudou durante a conferência; preserve a intenção atual.');
    o.comprovado(proof);
  } catch (error) { if (o.atual()) o.erro(error); }
  finally { if (o.atual()) o.finalizado(); }
}
