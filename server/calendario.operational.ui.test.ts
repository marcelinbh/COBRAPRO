import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as finance from "../shared/finance";
import { statusCalendarioParcela } from "../shared/parcelasCalendar";

const calendarioSource = readFileSync(new URL("../client/src/pages/Calendario.tsx", import.meta.url), "utf8");
const parcelasSource = readFileSync(new URL("../client/src/pages/Parcelas.tsx", import.meta.url), "utf8");
const tzOriginal = process.env.TZ;
afterEach(() => {
  vi.useRealTimers();
  if (tzOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = tzOriginal;
});

// Executa o código real sem imports de app: nenhuma RPC, banco, envio ou browser.
function carregar(source: string, contexto: Record<string, unknown>) {
  const parsed = ts.createSourceFile("operational.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const isolado = parsed.statements.filter(s => !ts.isImportDeclaration(s)).map(s => s.getText(parsed)).join("\n");
  const js = ts.transpileModule(isolado, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, any> = {};
  const requireLocal = (name: string) => {
    if (name === "react/jsx-runtime") return jsxRuntime;
    throw new Error(`Import não autorizado no teste: ${name}`);
  };
  new Function("exports", "require", ...Object.keys(contexto), js)(exports, requireLocal, ...Object.values(contexto));
  return exports;
}

const blocosMensagem = ts.createSourceFile("Parcelas.tsx", parcelasSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const mensagemSource = blocosMensagem.statements.filter(s => {
  if (ts.isFunctionDeclaration(s)) return s.name?.text === "gerarMensagemCobranca";
  return ts.isVariableStatement(s) && s.declarationList.declarations.some(d => d.name.getText(blocosMensagem).startsWith("TEMPLATE_"));
}).map(s => s.getText(blocosMensagem)).join("\n") + "\nexport { gerarMensagemCobranca };";
const { gerarMensagemCobranca } = carregar(mensagemSource, finance);

const fixtures = [
  { id: 1, clienteNome: "Cliente sintético", numeroParcela: 1, numeroParcelas: 3, dataVencimento: "2026-11-10", valorOriginal: "100", status: "pendente" },
  { id: 2, numeroParcela: 2, numeroParcelas: 3, dataVencimento: "2026-12-01", valorOriginal: "200", status: "pendente" },
  { id: 3, numeroParcela: 3, numeroParcelas: 3, dataVencimento: "2027-01-01", valorOriginal: "300", status: "pendente" },
];
const noOp = vi.fn();
const componente = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
function carregarCalendario(opcoes: { modo?: string; dia?: number; parcelas?: unknown[] } = {}) {
  let stateIndex = 0;
  return carregar(calendarioSource, {
    ...finance, statusCalendarioParcela,
    useMemo: (fn: () => unknown) => fn(),
    useState: (initial: unknown) => {
      const index = stateIndex++;
      const value = index === 2 ? (opcoes.modo ?? initial) : index === 5 ? (opcoes.dia ?? initial) : initial;
      return [value, noOp];
    },
    useTranslation: () => ({ t: (s: string) => s }),
    useLocation: () => ["/calendario", noOp],
    trpc: { parcelas: { list: { useQuery: () => ({ data: opcoes.parcelas ?? fixtures }) } } },
    toast: { success: noOp, error: noOp },
    ...Object.fromEntries(["Card", "CardContent", "CardHeader", "CardTitle", "Badge", "Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue", "ChevronLeft", "ChevronRight", "Calendar", "List", "LayoutGrid", "X", "MessageCircle", "CheckCircle"].map(name => [name, componente])),
    Button: ({ children, ...props }: any) => React.createElement("button", props, children),
  });
}

for (const fuso of ["America/Sao_Paulo", "UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
  describe(`calendário e mensagens reais — ${fuso}`, () => {
    it("agrupa DATEs sem deslocar dia, mês ou ano e sem modificar entradas", () => {
      process.env.TZ = fuso;
      const api = carregarCalendario();
      const inputs = fixtures.map(p => Object.freeze({ ...p }));
      const porDia = api.agruparParcelasCalendario(inputs);
      expect(Array.from(porDia.keys())).toEqual(["2026-11-10", "2026-12-01", "2027-01-01"]);
      expect(api.chaveCalendario(2026, 11, 1)).toBe("2026-12-01");
      expect(porDia.get(api.chaveCalendario(2027, 0, 1))).toEqual([inputs[2]]);
      expect(api.agruparParcelasCalendario([{ dataVencimento: "2026-02-29" }]).size).toBe(0);
    });
    it("semana civil cruza ano usando apenas UTC interno", () => {
      process.env.TZ = fuso;
      const api = carregarCalendario();
      expect(api.semanaCalendario("2026-12-31").map((d: Date) => d.toISOString().slice(0, 10))).toEqual([
        "2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02",
      ]);
      expect(api.semanaCalendario("2026-12-31", 1)[0].toISOString().slice(0, 10)).toBe("2027-01-03");
    });
    it.each([
      ["2026-12-01T00:00:00.999Z", "Novembro 2026", 30],
      ["2026-12-01T03:00:00.000Z", "Dezembro 2026", 1],
      ["2027-01-01T00:00:00.999Z", "Dezembro 2026", 31],
      ["2027-01-01T03:00:00.000Z", "Janeiro 2027", 1],
    ] as const)("mês inicial e destaque hoje em %s", (instante, titulo, dia) => {
      process.env.TZ = fuso;
      vi.useFakeTimers(); vi.setSystemTime(new Date(instante));
      const api = carregarCalendario();
      const html = renderToStaticMarkup(React.createElement(api.default));
      expect(html).toContain(titulo);
      expect(html).toContain(`text-primary">${dia}</div>`);
    });
    it("resumo do mês usa vencimentos civis, não instantes; visão lista e semanal renderizam", () => {
      process.env.TZ = fuso;
      vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-01T03:00:00Z"));
      for (const modo of ["mensal", "lista", "semanal"]) {
        const api = carregarCalendario({ modo });
        const html = renderToStaticMarkup(React.createElement(api.default));
        expect(html).toContain("200,00");
        if (modo !== "semanal") expect(html).not.toContain("300,00");
      }
    });
    it("semana ancora em hoje BRT e não no dia UTC do dispositivo", () => {
      process.env.TZ = fuso;
      vi.useFakeTimers(); vi.setSystemTime(new Date("2027-01-01T00:00:00.999Z"));
      const api = carregarCalendario({ modo: "semanal" });
      const html = renderToStaticMarkup(React.createElement(api.default));
      expect(html).toContain("27/12 — 2/1/2027");
      expect(html).toMatch(/text-primary"><div>Qui<\/div><div class="text-base">31<\/div>/);
    });
    it.each([
      ["2026-11-30", "2026-12-01T00:00:00.999Z", "SUA PARCELA VENCE HOJE", "vence hoje"],
      ["2026-11-30", "2026-12-01T03:00:00.000Z", "PARCELA EM ATRASO", "está em atraso"],
      ["2026-12-01", "2026-12-01T00:00:00.999Z", "LEMBRETE DE PARCELA", "vence em 01/12/2026"],
      ["2026-12-01", "2026-12-01T03:00:00.000Z", "SUA PARCELA VENCE HOJE", "vence hoje"],
      ["2026-12-31", "2027-01-01T00:00:00.999Z", "SUA PARCELA VENCE HOJE", "vence hoje"],
      ["2026-12-31", "2027-01-01T03:00:00.000Z", "PARCELA EM ATRASO", "está em atraso"],
      ["2027-01-01", "2027-01-01T00:00:00.999Z", "LEMBRETE DE PARCELA", "vence em 01/01/2027"],
      ["2027-01-01", "2027-01-01T03:00:00.000Z", "SUA PARCELA VENCE HOJE", "vence hoje"],
    ] as const)("mensagem civil %s no limite %s", (data, instante, titulo, descricao) => {
      process.env.TZ = fuso;
      vi.useFakeTimers(); vi.setSystemTime(new Date(instante));
      const msg = gerarMensagemCobranca("Cliente sintético", 1, 3, "1000", data, 0, 0, 0, 1000, null);
      expect(msg).toContain(titulo);
      expect(msg).toContain(data.split("-").reverse().join("/"));
      expect(carregarCalendario().mensagemCalendario({ ...fixtures[0], dataVencimento: data })).toContain(descricao);
    });
    it.each([
      ["2026-11-09", "PARCELA EM ATRASO", "09/11/2026", "Dias em Atraso:* 1"],
      ["2026-11-10", "SUA PARCELA VENCE HOJE", "10/11/2026", ""],
      ["2026-11-12", "LEMBRETE DE PARCELA", "12/11/2026", "Faltam:* 2 dias"],
    ] as const)("template da listagem compara civil %s", (data, titulo, formatada, dias) => {
      process.env.TZ = fuso;
      vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T00:00:00.999Z"));
      // diasAtraso deliberadamente incompatível: o texto deve confiar no DATE/hoje BRT.
      for (const vencimento of [data, new Date(data)]) {
        const msg = gerarMensagemCobranca("Cliente sintético", 1, 3, "1000", vencimento, 99, 0, 0, 1000, null);
        expect(msg).toContain(titulo); expect(msg).toContain(formatada); expect(msg).toContain(dias);
        expect(msg).not.toMatch(/Total a Pagar|Multa:\*|Juros:\*/);
        expect(msg).toContain("referência, não cotação");
        if (data > "2026-11-10") expect(msg).not.toMatch(/VENCE HOJE|Regularize hoje/);
      }
    });
    it.each([
      ["2026-11-09", "está em atraso"], ["2026-11-10", "vence hoje"], ["2026-11-12", "vence em 12/11/2026"],
    ])("lembrete manual do calendário %s não promete total", (data, descricao) => {
      process.env.TZ = fuso;
      vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T00:00:00.999Z"));
      const api = carregarCalendario();
      const msg = api.mensagemCalendario({ ...fixtures[0], dataVencimento: data });
      expect(msg).toContain(descricao); expect(msg).not.toContain("R$"); expect(msg).toContain("cotação atual");
      if (data > "2026-11-10") expect(msg).not.toContain("vence hoje");
    });
  });
}

describe("proteções do fluxo de mensagem", () => {
  it("Cobrar na listagem não abre link sem cotação; mantém o diálogo seguro", () => {
    expect(parcelasSource).not.toMatch(/<a\s+href=\{whatsappUrl\}/);
    expect(parcelasSource).toContain("<Button disabled size=");
    expect(parcelasSource).toContain("Cobrar bloqueado");
    expect(parcelasSource).toContain("não há cotação autoritativa vinculada à mensagem");
    expect(parcelasSource).toContain("Valor original · sem cotação");
    expect(parcelasSource).toContain("<RecebimentoValidado");
    expect(parcelasSource).not.toContain("<PagamentoDialog");
    const seletor = readFileSync(new URL("../client/src/components/RecebimentoValidado.tsx", import.meta.url), "utf8");
    expect(seletor).toContain("recebimentosLegados.origem.useQuery");
    expect(seletor).toContain("<EmprestimoSeguroReceber");
    expect(seletor).toContain("<ParcelaLegadaReceber");
  });
  it("lembretes individuais e em grupo usam a mesma regra, preservando envio manual existente", () => {
    expect(calendarioSource).toContain("const msg = mensagemCalendario(parcela)");
    expect(calendarioSource).toContain("const msg = mensagemCalendario(p)");
    expect(calendarioSource).not.toMatch(/(?:getFullYear|getMonth|getDate|getDay|toDateString)\(/);
    expect(calendarioSource).not.toContain("sua parcela ${p.numeroParcela}/${p.totalParcelas} de");
  });
  it("calendário conserva estados financeiros terminais e parciais sem escrita", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T15:00:00Z"));
    for (const status of ["parcial", "paga", "renegociada", "cancelada"]) {
      const p = Object.freeze({ ...fixtures[0], status });
      const api = carregarCalendario({ modo: "lista", parcelas: [p] });
      renderToStaticMarkup(React.createElement(api.default));
      expect(p.status).toBe(status);
      expect(statusCalendarioParcela(status, p.dataVencimento, finance.dataHojeBrasilia())).toBe(status);
    }
  });
});
