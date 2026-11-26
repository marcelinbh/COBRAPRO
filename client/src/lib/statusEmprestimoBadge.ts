export type StatusBadge = Readonly<{
  label: string;
  variant: 'default' | 'secondary' | 'destructive';
}>;

const semStatus: StatusBadge = { label: 'SEM STATUS', variant: 'secondary' };
const desconhecido: StatusBadge = { label: 'STATUS NÃO RECONHECIDO', variant: 'secondary' };

/** Somente rótulos: status explícito precede atraso; não lê saldo nem autoriza ações. */
export function badgeContrato(status: unknown, emAtraso = false): StatusBadge {
  switch (status) {
    case 'cancelado':
    case 'cancelada': return { label: 'CANCELADO', variant: 'secondary' };
    // O writer43 encerra a origem com renegociado. O 47 usa cancelado;
    // sem marcador de origem no DTO, não inferir reparcelamento para o 47.
    case 'renegociado': return { label: 'REPARCELADO', variant: 'secondary' };
    case 'quitado': return { label: 'QUITADO', variant: 'secondary' };
    case 'encerrado': return { label: 'ENCERRADO', variant: 'secondary' };
    case 'inadimplente': return { label: 'INADIMPLENTE', variant: 'destructive' };
    case 'atrasado': return { label: 'ATRASADO', variant: 'destructive' };
    case 'ativo': return emAtraso
      ? { label: 'ATRASADO', variant: 'destructive' }
      : { label: 'EM DIA', variant: 'default' };
    case null:
    case undefined:
    case '': return semStatus;
    default: return desconhecido;
  }
}

/** Traduz exatamente o status de parcela já entregue; não deriva pago de valor zero. */
export function badgeParcela(status: unknown, contratoStatus?: unknown): StatusBadge {
  switch (status) {
    case 'cancelada':
    case 'cancelado': return { label: contratoStatus === 'renegociado' ? 'Reparcelada' : 'Cancelada', variant: 'secondary' };
    case 'renovada': return { label: 'Renovada: principal transferido', variant: 'secondary' };
    case 'paga':
    case 'pago': return { label: 'Paga', variant: 'default' };
    case 'parcial': return { label: 'Parcial', variant: 'secondary' };
    case 'atrasada':
    case 'atrasado': return { label: 'Atrasada', variant: 'destructive' };
    case 'vencendo_hoje': return { label: 'Vence hoje', variant: 'secondary' };
    case 'pendente': return { label: 'Pendente', variant: 'secondary' };
    case null:
    case undefined:
    case '': return { label: 'Sem status', variant: 'secondary' };
    default: return { label: 'Status não reconhecido', variant: 'secondary' };
  }
}
