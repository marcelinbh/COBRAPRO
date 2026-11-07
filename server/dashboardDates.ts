import { adicionarDiasData, dataHojeBrasilia } from "./services/businessDate";

export function calendarioDashboard(now: Date = new Date()) {
  const hoje = dataHojeBrasilia(now);
  const [ano, mes] = hoje.split("-").map(Number);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const data = adicionarDiasData(hoje, i - 6);
    return { data, dia: `${data.slice(8, 10)}/${data.slice(5, 7)}` };
  });
  const meses = Array.from({ length: 6 }, (_, i) => {
    // Aritmética no primeiro dia, nunca em 29/30/31 (evita pular fevereiro).
    const inicio = new Date(Date.UTC(ano, mes - 1 + i - 5, 1)).toISOString().slice(0, 10);
    const proximoInicio = new Date(Date.UTC(ano, mes + i - 5, 1)).toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
      .format(new Date(`${inicio}T12:00:00Z`)).replace(".", "");
    return { inicio, fim: adicionarDiasData(proximoInicio, -1), mes: label };
  });
  return { hoje, em7Dias: adicionarDiasData(hoje, 7), ha30Dias: adicionarDiasData(hoje, -30), dias, meses };
}
