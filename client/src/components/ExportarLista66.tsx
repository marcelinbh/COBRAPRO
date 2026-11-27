import React, { useEffect, useRef, useState } from 'react';
import type { ListaSeguraEmprestimos } from '../../../shared/emprestimosListaSegura';
import { criarRelatorioLista66, type FiltrosLista66 } from '@/lib/relatorioLista66';

type Props = {
  data: ListaSeguraEmprestimos;
  items: ListaSeguraEmprestimos['items'];
  filtros: FiltrosLista66;
  disabled?: boolean;
};
type Formato = 'xlsx' | 'pdf';
type Feedback = { key: string; tipo: 'idle' | 'gerando' | 'sucesso' | 'erro'; mensagem: string };

// DTO limitado e composto de escalares: ordenação das chaves evita cancelamento
// por identidade ou pela ordem de propriedades de objetos equivalentes.
function chaveSnapshot({ data, items, filtros, disabled }: Props): string {
  return JSON.stringify({ data, items, filtros, disabled: !!disabled }, (_key, value) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
    }
    return value;
  });
}

function baixar(bytes: Uint8Array, formato: Formato, vigente: () => boolean): boolean {
  let url: string | undefined;
  let link: HTMLAnchorElement | undefined;
  let revogacaoAgendada = false;
  try {
    if (!vigente()) return false;
    const blob = new Blob([Uint8Array.from(bytes).buffer], {
      type: formato === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf',
    });
    if (!vigente()) return false;
    url = URL.createObjectURL(blob);
    link = document.createElement('a');
    link.href = url;
    link.download = `emprestimos-lista-parcial.${formato}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    if (!vigente()) return false;
    link.click();
    link.remove();
    link = undefined;
    const urlParaRevogar = url;
    // Somente limpeza de recurso; nunca altera estado nem acessa os dados.
    setTimeout(() => URL.revokeObjectURL(urlParaRevogar), 1000);
    revogacaoAgendada = true;
    return true;
  } finally {
    try {
      link?.remove();
    } finally {
      if (url && !revogacaoAgendada) URL.revokeObjectURL(url);
    }
  }
}

export function ExportarLista66(props: Props) {
  const key = chaveSnapshot(props);
  const renderAtual = useRef({ key, revisao: 0 });
  // Protege também o intervalo entre render e effect; nenhuma alteração de
  // estado React acontece durante o render. A revisão impede a volta A→B→A.
  if (renderAtual.current.key !== key) {
    renderAtual.current = { key, revisao: renderAtual.current.revisao + 1 };
  }
  const montado = useRef(false);
  const sequencia = useRef(0);
  const trava = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({ key, tipo: 'idle', mensagem: '' });

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      sequencia.current += 1;
      trava.current = null;
    };
  }, []);

  useEffect(() => {
    sequencia.current += 1;
    trava.current = null;
    setFeedback({ key, tipo: 'idle', mensagem: '' });
    return () => {
      sequencia.current += 1;
      trava.current = null;
    };
  }, [key]);

  const exportar = async (formato: Formato) => {
    if (!montado.current || props.disabled || trava.current !== null || renderAtual.current.key !== key) return;
    const ticket = ++sequencia.current;
    const revisao = renderAtual.current.revisao;
    trava.current = ticket;
    const vigente = () => montado.current && sequencia.current === ticket && trava.current === ticket &&
      renderAtual.current.key === key && renderAtual.current.revisao === revisao;
    const rotulo = formato === 'xlsx' ? 'Excel (.xlsx)' : 'PDF';
    setFeedback({ key, tipo: 'gerando', mensagem: `Gerando arquivo ${rotulo}…` });
    try {
      // O pai já confirmou a sessão e o owner. Não há uma segunda auth query.
      // Valida as referências originais; o modelo retorna escalares/arrays novos
      // destacados de data/items/filtros ANTES do primeiro await.
      const relatorio = criarRelatorioLista66(props.data, props.items, props.filtros, props.data.userId);
      const serializadores = await import('@/lib/exportarLista66');
      if (!vigente()) return;
      const bytes = formato === 'xlsx'
        ? await serializadores.gerarExcelLista66(relatorio)
        : await serializadores.gerarPdfLista66(relatorio);
      if (!vigente()) return;
      if (baixar(bytes, formato, vigente) && vigente()) {
        setFeedback({ key, tipo: 'sucesso', mensagem: `Download de ${rotulo} iniciado.` });
      }
    } catch {
      if (vigente()) setFeedback({ key, tipo: 'erro', mensagem: 'Não foi possível gerar o arquivo. Tente novamente.' });
    } finally {
      if (vigente()) trava.current = null;
    }
  };

  const atual = feedback.key === key ? feedback : { key, tipo: 'idle', mensagem: '' };
  const busy = atual.tipo === 'gerando';
  return <section aria-label="Exportação da lista de empréstimos — relatório parcial" className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
    <h3 className="text-sm font-semibold">Relatório parcial de empréstimos — validados somente</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">A exportação contém os cards visíveis conforme os filtros e mantém os empréstimos indisponíveis, com campos desconhecidos em branco. Coverage e totais validados são de TODO o escopo, incluindo o histórico, não apenas dos cards filtrados. Quando há indisponíveis, os totais não representam toda a carteira.</p>
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <button type="button" disabled={!!props.disabled || busy} aria-busy={busy} onClick={() => exportar('xlsx')} className="min-h-11 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto">Exportar Excel (.xlsx)</button>
      <button type="button" disabled={!!props.disabled || busy} aria-busy={busy} onClick={() => exportar('pdf')} className="min-h-11 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto">Exportar PDF</button>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true" className="text-sm leading-relaxed text-muted-foreground">{atual.mensagem}</p>
  </section>;
}
