import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import React from "react";
import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";

const source = readFileSync(new URL("./NotificacoesAutomaticas.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("NotificacoesAutomaticas.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const components: Record<string, string> = {};
let component = "";
const helpers: string[] = [];
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node)) {
    if (node.name?.text === "NotificacoesAutomaticas") component = node.getText(ast).replace(/^export default\s+/, "");
    if (["getCategoria", "getStatusEnvio"].includes(node.name?.text ?? "")) helpers.push(node.getText(ast));
  }
  if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) components[node.tagName.text] = node.tagName.text;
  ts.forEachChild(node, visit);
}
visit(ast);
if (!component) throw new Error("Componente real não encontrado");
const js = ts.transpileModule(`${helpers.join("\n")}\nconst real = (${component});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;

function harness() {
  const rule = { tipo: "no_vencimento", label: "No vencimento", ativo: false, mensagem_template: "Olá {nome}" };
  const queries: Record<string, any> = {
    me: { data: { id: 17, role: "user" }, isLoading: false, isFetching: false, isError: false, error: null },
    getGlobalAtivo: { data: false, isLoading: false, error: null },
    getAutomacao: { data: { ativo: false, horario: "09:00" }, isLoading: false, error: null },
    listar: { data: [rule], isLoading: false, error: null },
    historico: { data: [], isLoading: false, error: null },
    saude: { data: { pendentes: 0, enviando: 0, falhas: 0, ambiguas: 0, ultimoEnvioEm: null }, isLoading: false, error: null },
    getStatus: { data: { connected: true }, isLoading: false, error: null },
  };
  const options: Record<string, any> = {};
  const mutations: Record<string, any> = {};
  const queryOptions: Record<string, any> = {};
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  const requests: Record<string, any[]> = {};
  for (const name of ["salvarAutomacao", "toggle", "salvar", "testar", "dispararDoDia"]) {
    const state: any = { isPending: false, error: null, variables: undefined };
    requests[name] = [];
    let unsubscribe: (() => void) | undefined;
    state.mutate = vi.fn((input: any) => {
      unsubscribe?.();
      let resolve!: (value: any) => void;
      let reject!: (error: Error) => void;
      const deferred = new Promise((ok, fail) => { resolve = ok; reject = fail; });
      const observer = new MutationObserver(client, { ...options[name], mutationFn: () => deferred });
      unsubscribe = observer.subscribe(next => {
        state.isPending = next.isPending; state.error = next.error; state.variables = next.variables;
      });
      const completion = observer.mutate(input).catch(() => undefined);
      requests[name].push({ input, resolve, reject, completion, observer });
    });
    state.reset = vi.fn(() => {
      unsubscribe?.(); unsubscribe = undefined;
      state.error = null; state.isPending = false; state.variables = undefined;
    });
    mutations[name] = state;
  }
  const invalidations: Record<string, any> = {};
  const endpoints: Record<string, any> = {};
  for (const name of Object.keys(queries)) {
    endpoints[name] = { useQuery: (_input: any, config: any) => { queryOptions[name] = config; return queries[name]; } };
    invalidations[name] = { invalidate: vi.fn() };
  }
  for (const name of Object.keys(mutations)) endpoints[name] = { useMutation: (callbacks: any) => {
    options[name] = { ...callbacks };
    for (const callback of ["onMutate", "onSuccess", "onError", "onSettled"])
      if (callbacks[callback]) options[name][callback] = vi.fn(callbacks[callback]);
    return mutations[name];
  } };
  const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() };
  const values: any[] = [];
  const previousDeps: any[][] = [];
  const cleanups: Record<number, (() => void) | undefined> = {};
  let index = 0;
  let effects: (() => void)[] = [];
  const context = {
    ...components, React, toast, VARIAVEIS: [{ var: "{nome}", desc: "Nome" }],
    i18n: { t: (key: string) => key },
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: "pt" } }),
    useState: (initial: any) => {
      const slot = index++;
      if (!(slot in values)) values[slot] = typeof initial === "function" ? initial() : initial;
      return [values[slot], (next: any) => { values[slot] = typeof next === "function" ? next(values[slot]) : next; }];
    },
    useRef: (initial: any) => {
      const slot = index++;
      if (!(slot in values)) values[slot] = { current: initial };
      return values[slot];
    },
    useEffect: (effect: () => void | (() => void), deps: any[]) => {
      const slot = index++;
      if (!previousDeps[slot] || deps.some((dep, i) => !Object.is(dep, previousDeps[slot][i]))) effects.push(() => {
        cleanups[slot]?.();
        cleanups[slot] = effect() || undefined;
      });
      previousDeps[slot] = deps;
    },
    trpc: {
      useUtils: () => ({ notificacoes: invalidations }),
      auth: { me: endpoints.me },
      notificacoes: endpoints, whatsappEvolution: { getStatus: endpoints.getStatus },
    },
  };
  const real = new Function(...Object.keys(context), `${js}; return real;`)(...Object.values(context));
  const render = () => { index = 0; effects = []; const tree = real(); effects.forEach(effect => effect()); return tree; };
  const settle = async (name: string, data: any, error = false, request = requests[name].length - 1) => {
    const pending = requests[name][request];
    if (!pending) throw new Error(`Mutação ${name} não iniciada`);
    if (error) pending.reject(data); else pending.resolve(data);
    await pending.completion;
  };
  const unmount = () => { Object.values(cleanups).forEach(cleanup => cleanup?.()); };
  return { render, mutations, options, queries, toast, invalidations, queryOptions, requests, settle, unmount, client };
}
function elements(tree: any): any[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!React.isValidElement(tree)) return [];
  return [tree, ...elements((tree.props as any).children)];
}
function text(tree: any): string {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (React.isValidElement(tree)) return text((tree.props as any).children);
  return typeof tree === "string" || typeof tree === "number" ? String(tree) : "";
}
function element(tree: any, type: string, filter: (props: any) => boolean = () => true) {
  const found = elements(tree).find(node => node.type === type && filter(node.props));
  if (!found) throw new Error(`Elemento ${type} não encontrado`);
  return found as any;
}
function button(tree: any, label: string) { return element(tree, "Button", props => text(props.children).includes(label)); }
function confirmation(tree: any) { return element(tree, "Dialog", props => text(props.children).includes("Confirmar processamento da minha fila")); }
function alerts(tree: any) { return elements(tree).filter(node => node.props.role === "alert").map(node => text(node)).join("\n"); }
const result = { dryRun: false, elegiveis: 5, enfileiradas: 2, processadas: 4, enviadas: 1, falhas: 0, aguardandoReconexao: 2, ambiguas: 0, canceladas: 1 };

describe("notificações — controles e handlers reais sem serviço externo", () => {
  it.each(["", "09:01"])("OFF preserva 09:00 salvo apesar do rascunho %j e não ativa nem dispara automaticamente", async draft => {
    const h = harness();
    h.queries.getGlobalAtivo.data = true;
    h.queries.getAutomacao.data.ativo = true;
    let tree = h.render();
    element(tree, "Input", props => props.id === "horario-automacao").props.onChange({ target: { value: draft } });
    tree = h.render();
    expect(element(tree, "Input", props => props.id === "horario-automacao").props.value).toBe(draft);
    const toggle = element(tree, "Switch", props => props["aria-label"] === "Ativar automação geral");
    expect(toggle.props.disabled).toBe(false);
    toggle.props.onCheckedChange(false);
    expect(h.mutations.salvarAutomacao.mutate).toHaveBeenCalledTimes(1);
    expect(h.mutations.salvarAutomacao.mutate).toHaveBeenCalledWith({ ativo: false, horario: "09:00" });
    await h.settle("salvarAutomacao", { success: true });
    h.queries.getGlobalAtivo.data = false;
    h.queries.getAutomacao.data = { ativo: false, horario: "09:00" };
    tree = h.render();
    expect(element(tree, "Switch", props => props["aria-label"] === "Ativar automação geral").props.checked).toBe(false);
    expect(h.mutations.salvarAutomacao.mutate).toHaveBeenCalledTimes(1);
    expect(h.mutations.dispararDoDia.mutate).not.toHaveBeenCalled();
    expect(h.mutations.testar.mutate).not.toHaveBeenCalled();
    expect(h.mutations.toggle.mutate).not.toHaveBeenCalled();
    expect(h.queries.getAutomacao.data.horario).toBe("09:00");
    h.unmount(); h.client.clear();
  });
  it("master desligado permite editar e salvar sem alterar ativo nem ativar automação", () => {
    const h = harness();
    let tree = h.render();
    const edit = button(tree, "common.edit");
    expect(edit.props.disabled).toBe(false);
    edit.props.onClick(); tree = h.render();
    element(tree, "Textarea", props => props.id === "msg").props.onChange({ target: { value: "Rascunho novo" } });
    tree = h.render(); button(tree, "common.save").props.onClick();
    expect(h.mutations.salvar.mutate).toHaveBeenCalledTimes(1);
    expect(h.mutations.salvar.mutate).toHaveBeenCalledWith({ tipo: "no_vencimento", ativo: false, mensagem_template: "Rascunho novo" });
    expect(h.mutations.salvarAutomacao.mutate).not.toHaveBeenCalled();
    expect(h.mutations.dispararDoDia.mutate).not.toHaveBeenCalled();
    expect(h.toast.success).not.toHaveBeenCalled();
  });
  it("master desligado permite ligar só a regra; falha do toggle exibe erro real", async () => {
    const h = harness();
    const tree = h.render();
    const toggle = element(tree, "Switch", props => props["aria-label"] === "Ativar regra No vencimento");
    expect(toggle.props.disabled).toBe(false);
    toggle.props.onCheckedChange(true);
    expect(h.mutations.toggle.mutate).toHaveBeenCalledTimes(1);
    expect(h.mutations.toggle.mutate).toHaveBeenCalledWith({ tipo: "no_vencimento", ativo: true });
    expect(h.mutations.salvarAutomacao.mutate).not.toHaveBeenCalled();
    await h.settle("toggle", new Error("Regra indisponível"), true);
    expect(h.toast.error).toHaveBeenCalledWith("Regra indisponível");
  });
  it("validar dispara dryRun=true com somente esse campo mesmo desconectado", () => {
    const h = harness(); h.queries.getStatus.data.connected = false;
    const tree = h.render();
    expect(button(tree, "Validar sem enviar").props.disabled).toBe(false);
    expect(button(tree, "Processar minha fila").props.disabled).toBe(true);
    button(tree, "Validar sem enviar").props.onClick();
    expect(h.mutations.dispararDoDia.mutate).toHaveBeenCalledTimes(1);
    expect(h.mutations.dispararDoDia.mutate).toHaveBeenCalledWith({ dryRun: true });
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.toast.info).not.toHaveBeenCalled();
  });
  it("processar abre confirmação, cancelar não envia, falso guard impede confirmar oculto", () => {
    const h = harness(); let tree = h.render();
    button(tree, "Confirmar envio da minha fila").props.onClick();
    expect(h.mutations.dispararDoDia.mutate).not.toHaveBeenCalled();
    button(tree, "Processar minha fila").props.onClick(); tree = h.render();
    expect(confirmation(tree).props.open).toBe(true);
    expect(text(confirmation(tree))).toContain("mensagens reais");
    expect(text(confirmation(tree))).toContain("suas regras ativas e seus próprios clientes");
    expect(text(confirmation(tree))).toContain("Mensagens ambíguas e testes manuais não são reenviados");
    button(confirmation(tree), "Cancelar").props.onClick(); tree = h.render();
    expect(confirmation(tree).props.open).toBe(false);
    expect(h.mutations.dispararDoDia.mutate).not.toHaveBeenCalled();
  });
  it("somente confirmar envia dryRun=false; duplo clique síncrono é bloqueado", () => {
    const h = harness(); button(h.render(), "Processar minha fila").props.onClick();
    const send = button(confirmation(h.render()), "Confirmar envio da minha fila");
    send.props.onClick(); send.props.onClick();
    expect(h.mutations.dispararDoDia.mutate).toHaveBeenCalledTimes(1);
    expect(h.mutations.dispararDoDia.mutate).toHaveBeenCalledWith({ dryRun: false });
    expect(h.toast.info).not.toHaveBeenCalled();
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.mutations.testar.mutate).not.toHaveBeenCalled();
    expect(h.mutations.salvarAutomacao.mutate).not.toHaveBeenCalled();
  });
  it("resultado vem só da resposta; zero aceitas não é apresentado como envio bem-sucedido", async () => {
    const h = harness(); button(h.render(), "Processar minha fila").props.onClick();
    button(confirmation(h.render()), "Confirmar envio da minha fila").props.onClick();
    expect(text(h.render())).not.toContain("Resultado do processamento");
    await h.settle("dispararDoDia", { ...result, enviadas: 0 });
    const tree = h.render();
    expect(confirmation(tree).props.open).toBe(false);
    expect(text(tree)).toContain("Resultado do processamento");
    expect(text(tree)).toContain("Aceitas pela Evolution: 0");
    expect(text(tree)).toContain("não comprova entrega ou leitura");
    expect(h.toast.info).toHaveBeenCalledWith("Fila processada: 0 solicitação(ões) aceita(s) pela Evolution.");
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.invalidations.historico.invalidate).toHaveBeenCalledOnce();
    expect(h.invalidations.saude.invalidate).toHaveBeenCalledOnce();
  });
  it("validação descreve limitações sem afirmar envio e mostra contadores retornados", async () => {
    const h = harness(); button(h.render(), "Validar sem enviar").props.onClick();
    await h.settle("dispararDoDia", { ...result, dryRun: true, enviadas: 0, enfileiradas: 0 });
    const tree = h.render();
    expect(text(tree)).toContain("Validação sem envio");
    expect(text(tree)).toContain("Elegíveis: 5");
    expect(text(tree)).toContain("apenas itens já pendentes");
    expect(h.toast.info).toHaveBeenCalledWith("Validação concluída sem enviar mensagens.");
  });
  it("falhas e ambiguidades são atenção, nunca toast de sucesso ou retry", async () => {
    const h = harness(); h.render();
    expect(h.options.dispararDoDia.retry).toBe(false);
    expect(h.options.testar.retry).toBe(false);
    button(h.render(), "Validar sem enviar").props.onClick();
    await h.settle("dispararDoDia", { ...result, falhas: 2, ambiguas: 1 });
    expect(h.toast.warning).toHaveBeenCalledOnce();
    expect(h.toast.info).not.toHaveBeenCalled();
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.mutations.dispararDoDia.mutate).toHaveBeenCalledTimes(1);
  });
  it("erro mantém confirmação aberta, feedback real e nenhum resultado fictício", async () => {
    const h = harness(); button(h.render(), "Processar minha fila").props.onClick();
    button(confirmation(h.render()), "Confirmar envio da minha fila").props.onClick();
    const error = new Error("Resultado ambíguo; revisar histórico");
    h.mutations.dispararDoDia.error = error;
    await h.settle("dispararDoDia", error, true);
    const tree = h.render();
    expect(confirmation(tree).props.open).toBe(true);
    expect(alerts(tree)).toContain(error.message);
    expect(text(tree)).not.toContain("Resultado do processamento");
    expect(h.toast.error).toHaveBeenCalledWith(error.message);
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.mutations.dispararDoDia.mutate).toHaveBeenCalledOnce();
  });
  it("pending bloqueia ações e fechamento, preservando loading de verdade", () => {
    const h = harness(); button(h.render(), "Processar minha fila").props.onClick();
    h.mutations.dispararDoDia.isPending = true;
    h.mutations.dispararDoDia.variables = { dryRun: false };
    const tree = h.render();
    expect(button(tree, "Processar minha fila").props.disabled).toBe(true);
    expect(button(tree, "Validar sem enviar").props.disabled).toBe(true);
    expect(button(tree, "Processando…").props.disabled).toBe(true);
    expect(button(tree, "common.edit").props.disabled).toBe(true);
    confirmation(tree).props.onOpenChange(false);
    expect(confirmation(h.render()).props.open).toBe(true);
    expect(elements(tree).some(node => node.props.role === "status" && text(node) === "Processando sua fila…")).toBe(true);
  });
  it.each(["getGlobalAtivo", "getAutomacao", "listar"])("erro %s com cache bloqueia processamento sem falsa lista vazia", query => {
    const h = harness(); h.queries[query].error = new Error("Cache não confiável");
    const tree = h.render();
    expect(button(tree, "Validar sem enviar").props.disabled).toBe(true);
    expect(button(tree, "Processar minha fila").props.disabled).toBe(true);
    button(tree, "Validar sem enviar").props.onClick();
    expect(h.mutations.dispararDoDia.mutate).not.toHaveBeenCalled();
    expect(alerts(tree)).toContain("Não foi possível carregar");
    if (query === "listar") expect(alerts(tree)).toContain("Não foram substituídas por uma lista vazia");
  });
  it.each(["getGlobalAtivo", "getAutomacao", "listar"])("loading %s bloqueia processar sem ativar ou mutar preferências", query => {
    const h = harness(); h.queries[query].isLoading = true;
    const tree = h.render();
    expect(button(tree, "Validar sem enviar").props.disabled).toBe(true);
    expect(button(tree, "Processar minha fila").props.disabled).toBe(true);
    expect(h.mutations.salvarAutomacao.mutate).not.toHaveBeenCalled();
  });
  it("saúde/histórico em erro não mostram zero ou histórico vazio como prova", () => {
    const h = harness(); h.queries.saude.error = new Error("Falha"); h.queries.historico.error = new Error("Falha");
    const tree = h.render();
    expect(text(tree)).toContain("Indisponível");
    expect(alerts(tree)).toContain("Não foi possível carregar a situação da fila");
    expect(alerts(tree)).toContain("não comprova ausência de envios");
    expect(text(tree)).not.toContain("notifications.noMessages");
    expect(text(tree)).not.toContain("Sem envio");
  });
  it("Enviar teste preserva número explícito e não depende do master", () => {
    const h = harness(); let tree = h.render();
    expect(button(tree, "Enviar teste").props.disabled).toBe(false);
    button(tree, "Enviar teste").props.onClick(); tree = h.render();
    element(tree, "Input", props => props.id === "telefone-teste").props.onChange({ target: { value: "(11) 99999-9999" } });
    tree = h.render(); button(tree, "Enviar mensagem de teste").props.onClick();
    expect(h.mutations.testar.mutate).toHaveBeenCalledTimes(1);
    expect(h.mutations.testar.mutate).toHaveBeenCalledWith({ tipo: "no_vencimento", mensagem_template: "Olá {nome}", telefone: "(11) 99999-9999" });
    expect(h.mutations.dispararDoDia.mutate).not.toHaveBeenCalled();
    expect(h.mutations.salvarAutomacao.mutate).not.toHaveBeenCalled();
    expect(h.toast.success).not.toHaveBeenCalled();
  });
});

function iniciar(h: ReturnType<typeof harness>, name: string) {
  let tree = h.render();
  if (name === "dispararDoDia") button(tree, "Validar sem enviar").props.onClick();
  else if (name === "salvarAutomacao") button(tree, "Salvar horário").props.onClick();
  else if (name === "toggle") element(tree, "Switch", props => props["aria-label"] === "Ativar regra No vencimento").props.onCheckedChange(true);
  else if (name === "salvar") {
    button(tree, "common.edit").props.onClick();
    button(h.render(), "common.save").props.onClick();
  } else {
    button(tree, "Enviar teste").props.onClick(); tree = h.render();
    element(tree, "Input", props => props.id === "telefone-teste").props.onChange({ target: { value: "(11) 99999-9999" } });
    button(h.render(), "Enviar mensagem de teste").props.onClick();
  }
}
const testResult = { telefone: "5511999999999", providerMessageId: "synthetic-17", aceitoEm: "2026-11-16T15:00:00Z", historicoRegistrado: true };
function expectSemEfeitos(h: ReturnType<typeof harness>) {
  for (const spy of Object.values(h.toast)) expect(spy).not.toHaveBeenCalled();
  for (const endpoint of Object.values(h.invalidations)) expect(endpoint.invalidate).not.toHaveBeenCalled();
}

describe("notificações — sessão e callbacks de mutação do SDK real", () => {
  it.each([
    { data: null }, { data: { id: 0 } }, { data: { id: -1 } }, { data: { id: "17" } },
    { data: { id: NaN } }, { data: { id: 1.2 } }, { data: { id: Number.MAX_SAFE_INTEGER + 1 } },
    { isLoading: true }, { isFetching: true }, { isError: true },
  ])("auth indisponível %j esconde todos os controles e consultas de tenant", state => {
    const h = harness(); Object.assign(h.queries.me, state);
    h.queries.historico.data = [{ id: 1, mensagem: "Histórico sigiloso A" }];
    const tree = h.render();
    expect(text(tree)).not.toContain("Histórico sigiloso A");
    expect(elements(tree).some(node => node.type === "Button")).toBe(false);
    for (const name of ["getGlobalAtivo", "getAutomacao", "listar", "historico", "saude", "getStatus"])
      expect(h.queryOptions[name].enabled).toBe(false);
    for (const mutation of Object.values(h.mutations)) expect(mutation.mutate).not.toHaveBeenCalled();
  });
  it("troca de tenant fecha diálogos e apaga rascunho, número, resultado e horário anterior", async () => {
    const h = harness();
    iniciar(h, "testar"); await h.settle("testar", testResult);
    iniciar(h, "dispararDoDia"); await h.settle("dispararDoDia", result);
    button(h.render(), "common.edit").props.onClick();
    element(h.render(), "Textarea", props => props.id === "msg").props.onChange({ target: { value: "Rascunho privado A" } });
    element(h.render(), "Input", props => props.id === "horario-automacao").props.onChange({ target: { value: "18:00" } });
    button(h.render(), "Processar minha fila").props.onClick();
    h.queries.me.data = { id: 44, role: "user" };
    const blocked = h.render();
    expect(text(blocked)).toContain("Conferindo sua sessão");
    expect(text(blocked)).not.toContain("Rascunho privado A");
    expect(h.queryOptions.historico.enabled).toBe(false);
    const tree = h.render();
    for (const dialog of elements(tree).filter(node => node.type === "Dialog")) expect(dialog.props.open).toBe(false);
    expect(element(tree, "Textarea", props => props.id === "msg").props.value).toBe("");
    expect(element(tree, "Input", props => props.id === "telefone-teste").props.value).toBe("");
    expect(element(tree, "Input", props => props.id === "horario-automacao").props.value).toBe("09:00");
    expect(text(tree)).not.toContain("Resultado do processamento");
    expect(text(tree)).not.toContain(testResult.providerMessageId);
    button(tree, "Confirmar envio da minha fila").props.onClick();
    expect(h.mutations.dispararDoDia.mutate).toHaveBeenCalledTimes(1);
  });
  it.each(["salvarAutomacao", "toggle", "salvar", "testar", "dispararDoDia"])("%s entrega contexto como terceiro argumento por SDK", async name => {
    const h = harness(); iniciar(h, name);
    const callback = h.options[name].onSuccess;
    const settled = h.options[name].onSettled;
    const pending = h.requests[name][0];
    const data = name === "testar" ? testResult : name === "dispararDoDia" ? result : { success: true };
    await h.settle(name, data);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0].slice(0, 3)).toEqual([data, pending.input, { userId: 17, geracao: 0 }]);
    expect(callback).toHaveBeenCalledWith(data, pending.input, { userId: 17, geracao: 0 }, expect.objectContaining({ client: h.client }));
    if (settled) {
      expect(settled).toHaveBeenCalledTimes(1);
      expect(settled).toHaveBeenCalledWith(data, null, pending.input, { userId: 17, geracao: 0 }, expect.objectContaining({ client: h.client }));
    }
  });
  it.each(["salvarAutomacao", "toggle", "salvar", "testar", "dispararDoDia"].flatMap(name => [false, true].map(error => ({ name, error }))))(
    "$name ignora resposta tardia de outro tenant, erro=$error", async ({ name, error }) => {
      const h = harness(); iniciar(h, name);
      h.queries.me.data = { id: 44, role: "user" }; h.render(); h.render();
      await h.settle(name, error ? new Error("Erro privado do tenant A") : name === "testar" ? testResult : name === "dispararDoDia" ? result : { success: true }, error);
      expectSemEfeitos(h);
      expect(h.mutations[name].error).toBeNull();
      const tree = h.render();
      expect(text(tree)).not.toContain("Erro privado do tenant A");
      expect(text(tree)).not.toContain("Resultado do processamento");
      expect(text(tree)).not.toContain(testResult.providerMessageId);
    }
  );
  it("voltar ao mesmo userId não aceita resposta da geração anterior nem destrava fila nova", async () => {
    const h = harness(); iniciar(h, "dispararDoDia");
    h.queries.me.data = { id: 44 }; h.render(); h.render();
    h.queries.me.data = { id: 17 }; h.render(); h.render();
    iniciar(h, "dispararDoDia");
    await h.settle("dispararDoDia", result, false, 0);
    expectSemEfeitos(h);
    expect(h.mutations.dispararDoDia.isPending).toBe(true);
    button(h.render(), "Validar sem enviar").props.onClick();
    expect(h.mutations.dispararDoDia.mutate).toHaveBeenCalledTimes(2);
    await h.settle("dispararDoDia", { ...result, dryRun: true }, false, 1);
    expect(h.toast.info).toHaveBeenCalledTimes(1);
    expect(h.toast.info).toHaveBeenCalledWith("Validação concluída sem enviar mensagens.");
  });
  it.each([false, true])("cleanup de unmount impede toast e invalidação tardios, erro=%s", async error => {
    const h = harness(); iniciar(h, "testar"); h.unmount();
    await h.settle("testar", error ? new Error("Resposta após sair") : testResult, error);
    expectSemEfeitos(h);
  });
  it("QueryObserver real separa cache/histórico A e B e ignora resolução tardia de A na sessão B", async () => {
    const h = harness(); h.render();
    const key = ["notificacoes", "historico", { limit: 50 }];
    let resolveA!: (data: any) => void;
    let resolveB!: (data: any) => void;
    const pendingA = new Promise<any>(resolve => { resolveA = resolve; });
    const pendingB = new Promise<any>(resolve => { resolveB = resolve; });
    const scopeA = h.queryOptions.historico;
    const observer = new QueryObserver(h.client, { queryKey: key, ...scopeA, queryFn: () => pendingA });
    const unsubscribe = observer.subscribe(value => { h.queries.historico = value; });
    const completionA = observer.refetch();
    h.queries.me.data = { id: 44 }; h.render();
    const scopeB = h.queryOptions.historico;
    expect(scopeA.queryKeyHashFn(key)).not.toBe(scopeB.queryKeyHashFn(key));
    expect(scopeB.enabled).toBe(false);
    observer.setOptions({ queryKey: key, ...scopeB, queryFn: () => pendingB });
    h.queries.historico = observer.getCurrentResult();
    h.render();
    observer.setOptions({ queryKey: key, ...h.queryOptions.historico, queryFn: () => pendingB });
    const completionB = observer.refetch();
    const rowB = { id: 44, tipo: "no_vencimento", mensagem: "Somente histórico B", telefone: "5511999990044", status: "aceito_evolution", createdAt: "2026-11-16T15:00:00Z", clientes: { nome: "Cliente B" } };
    resolveB([rowB]); await completionB;
    expect(text(h.render())).toContain("Somente histórico B");
    resolveA([{ ...rowB, id: 17, mensagem: "Histórico privado A", clientes: { nome: "Cliente A" } }]); await completionA;
    const tree = h.render();
    expect(text(tree)).toContain("Somente histórico B");
    expect(text(tree)).not.toContain("Histórico privado A");
    expect(text(tree)).not.toContain("Cliente A");
    expect(h.client.getQueryCache().findAll()).toHaveLength(2);
    unsubscribe(); h.client.clear();
  });
});

describe("painel50 — compatibilidade de resposta durante publicação incremental", () => {
  it("resposta antiga não quebra controles nem inventa recibos ou ausência de execução", () => {
    const h = harness();
    const tree = h.render();
    expect(text(tree)).toContain("Recibos indisponíveis");
    expect(text(tree)).not.toContain("Nenhuma execução registrada para sua conta");
    expect(text(tree)).not.toContain("aceites sem recibo ·");
    expect(button(tree, "Validar sem enviar").props.disabled).toBe(false);
    expect(h.mutations.dispararDoDia.mutate).not.toHaveBeenCalled();
    expect(h.mutations.testar.mutate).not.toHaveBeenCalled();
    h.unmount(); h.client.clear();
  });
  it("resposta50 distingue aceite sem recibo, entrega, leitura e heartbeat ausente confirmado", () => {
    const h = harness();
    h.queries.saude.data = { ...h.queries.saude.data, heartbeat: null, recibos: { limiteAmostra: 200, aceitosSemRecibo: 3, entregues: 2, lidos: 1 } };
    const tree = h.render();
    expect(text(tree)).toContain("Amostra de até 200 registros: 3 aceites sem recibo · 2 entregues · 1 lidos.");
    expect(text(tree)).toContain("Nenhuma execução registrada para sua conta");
    expect(text(tree)).toContain("cadência real não está certificada");
    expect(h.mutations.dispararDoDia.mutate).not.toHaveBeenCalled();
    expect(h.mutations.testar.mutate).not.toHaveBeenCalled();
    h.unmount(); h.client.clear();
  });
});
