import { useEffect, useRef } from 'react';
import { alvoAcaoListaEmprestimo62, fichaProntaAcaoLista62, idContratoAcao62, type LeituraAcaoLista62 } from './acoesListaEmprestimo62';

/** Só desloca/foca o rodapé existente. Não abre abas, diálogos ou writers. */
export function useAcoesListaEmprestimo62({ id, ...leitura }: LeituraAcaoLista62 & { id: unknown }) {
  const idAtual = idContratoAcao62(id);
  const pronto = fichaProntaAcaoLista62(idAtual, leitura);
  const consumo = useRef<{ id: number | null; hash: string | null; pronto: boolean }>({ id: idAtual, hash: null, pronto });
  // Mesmo uma troca de ID ainda sem dados invalida o consumo da ficha anterior.
  if (consumo.current.id !== idAtual) consumo.current = { id: idAtual, hash: null, pronto };
  consumo.current.pronto = pronto;

  useEffect(() => {
    if (!pronto || typeof window === 'undefined' || typeof document === 'undefined' ||
      typeof window.addEventListener !== 'function') return;
    const focar = () => {
      if (!consumo.current.pronto || consumo.current.id !== idAtual || window.location.search) return;
      const hash = window.location.hash;
      const alvo = alvoAcaoListaEmprestimo62(window.location.pathname, hash, idAtual);
      if (!alvo || consumo.current.hash === hash) return;
      const elemento = document.getElementById(alvo);
      if (!elemento) return;
      consumo.current.hash = hash;
      elemento.scrollIntoView({ block: 'center' });
      elemento.focus({ preventScroll: true });
    };
    const aoMudarHash = () => {
      // Novo gesto de navegação na mesma ficha pode focar novamente; refetch não.
      if (!consumo.current.pronto || consumo.current.id !== idAtual) return;
      consumo.current.hash = null;
      focar();
    };
    focar();
    window.addEventListener('hashchange', aoMudarHash);
    return () => window.removeEventListener('hashchange', aoMudarHash);
  }, [idAtual, pronto]);
}
