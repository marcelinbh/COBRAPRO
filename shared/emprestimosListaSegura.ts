// PROPOSTA NÃO APLICADA. Exclusivo da listagem; não é uma autorização financeira.
export const AVISO_LISTA_INCOMPLETA = "Consulta parcial: valores validados somente. Há empréstimos indisponíveis; os totais não representam toda a carteira. Relatórios desta consulta são incompletos. Não cadastre novamente uma dívida existente.";
/** Contagens da projeção51; arquivo é atributo sobreposto. DATE do mesmo snapshot60. */
export type ResumoParcelasLista63 = {
  total: number;
  abertas: number;
  pagas: number;
  canceladas: number;
  transferidas: number;
  arquivadas: number;
  proximoVencimento: string | null;
  dataReferencia: string;
};
export type EmprestimoValidadoLista = {
  kind: "validated";
  id: number;
  clienteId: number;
  clienteNome: string;
  modalidade: string;
  status: string;
  statusFinanceiroOriginal: string;
  statusObrigacao: "ativo" | "quitado" | "encerrado_por_cancelamento";
  arquivado: boolean;
  obrigacaoAdicional: string;
  obrigacaoAtual: string;
  capital: number;
  totalReceber: number;
  totalPago: number;
  /** Ausência em consumidores anteriores não é zero nem prova de vencimento. */
  resumoParcelas?: ResumoParcelasLista63;
};
export type EmprestimoIndisponivelLista = {
  kind: "unavailable";
  id: number;
  message: "Empréstimo indisponível: não foi possível confirmar seus vínculos.";
};
export type TotaisValidadosLista = { capital: number; totalReceber: number; totalPago: number };
export type ListaSeguraEmprestimos = {
  version: "loan_list_read_v1";
  /** Owner da sessão no servidor; não é input nem autorização de escrita. */
  userId: number;
  items: (EmprestimoValidadoLista | EmprestimoIndisponivelLista)[];
  coverage: {
    scopedContracts: number;
    validatedContracts: number;
    unavailableContracts: number;
    complete: boolean;
    label: "validados somente";
  };
  totals: { label: "validados somente"; values: TotaisValidadosLista | null };
  warning: typeof AVISO_LISTA_INCOMPLETA | null;
  /** Mapa paralelo67; não clona cards nem modifica a prova financeira60. */
  organizacao67?: import('./emprestimosListaControles67').OrganizacaoLista67;
};

/** A decisão usa o código tRPC, não o status HTTP do batch (que pode ser 207). */
export function deveUsarListaSegura(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const data = (error as { data?: unknown }).data;
  return !!data && typeof data === "object" &&
    (data as { code?: unknown }).code === "PRECONDITION_FAILED";
}
