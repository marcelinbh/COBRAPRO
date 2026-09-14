import {
  deveExecutarNoHorario,
  obterDataBrasilia,
} from "./notificacoesAutomaticas";

export type ConfiguracaoRelatorioDiario = {
  ativo?: string;
  horario?: string;
  telefone?: string;
  ultimoEnvio?: string;
};

/**
 * Determina se o relatório deve ser enviado neste ciclo de automação.
 * O marcador diário impede reenvios quando o agendador é chamado várias vezes.
 */
export function deveEnviarRelatorioDiario(
  configuracao: ConfiguracaoRelatorioDiario,
  agora: Date = new Date()
): boolean {
  const dataHoje = obterDataBrasilia(agora);
  const telefone = configuracao.telefone?.trim() ?? "";
  const horario = configuracao.horario || "08:00";

  return (
    configuracao.ativo === "true" &&
    telefone.length > 0 &&
    configuracao.ultimoEnvio !== dataHoje &&
    deveExecutarNoHorario(horario, agora)
  );
}
