import type { CotacaoRenovacaoProspectiva, EntradaRenovacaoProspectiva, ResultadoRenovacaoProspectiva } from "../../../server/services/renovacaoProspectivaRpc";
export type RenovacaoProspectivaIntencao = { versao: 1; payload: EntradaRenovacaoProspectiva; confirmacao?: ResultadoRenovacaoProspectiva };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = /^[0-9a-f]{64}$/;
export function renovacaoProspectivaNovaIntencao(q: CotacaoRenovacaoProspectiva, key: string): RenovacaoProspectivaIntencao {
  if (!q.elegivel || !uuid.test(key)) throw new Error("Cotação/UUID obrigatórios.");
  return { versao: 1, payload: { idempotencyKey: key, contratoId: q.contratoId, parcelaId: q.parcelaId,
    valorRecebido: q.totalExigido, totalExigido: q.totalExigido, dataPagamento: q.dataPagamento,
    estadoHash: q.estadoHash, cotacaoHash: q.cotacaoHash } };
}
export function renovacaoProspectivaLerIntencao(storage: Pick<Storage, "getItem">, key: string, scope: { contratoId: number; parcelaId: number }): RenovacaoProspectivaIntencao | null {
  const text = storage.getItem(key); if (!text) return null;
  const p = JSON.parse(text), i = p?.payload;
  const fields = ["idempotencyKey", "contratoId", "parcelaId", "valorRecebido", "totalExigido", "dataPagamento", "estadoHash", "cotacaoHash"];
  if (p?.versao !== 1 || !i || !uuid.test(i.idempotencyKey ?? "") ||
    Object.keys(i).length !== fields.length || Object.keys(i).some(k => !fields.includes(k)) ||
    i.contratoId !== scope.contratoId || i.parcelaId !== scope.parcelaId ||
    !/^(0|[1-9]\d{0,9})\.\d{2}$/.test(i.valorRecebido ?? "") || i.valorRecebido === "0.00" || i.valorRecebido !== i.totalExigido ||
    !/^\d{4}-\d{2}-\d{2}$/.test(i.dataPagamento ?? "") || !hash.test(i.estadoHash ?? "") || !hash.test(i.cotacaoHash ?? ""))
    throw new Error("Intenção armazenada inválida/fora do contrato. Confira o histórico; não gere segunda operação.");
  return p as RenovacaoProspectivaIntencao;
}
export function renovacaoProspectivaGuardarIntencao(storage: Pick<Storage, "setItem">, key: string, p: RenovacaoProspectivaIntencao) {
  // Storage indisponível => throw antes de qualquer RPC financeira.
  storage.setItem(key, JSON.stringify(p));
}
