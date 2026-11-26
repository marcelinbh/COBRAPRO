import { readFileSync } from 'node:fs';
import ts from 'typescript';

/** Only local source text is loaded. Application imports are never evaluated. */
export function source(relative: string) {
  return ts.createSourceFile(relative, readFileSync(new URL('../' + relative, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
export function nodes(root: ts.Node, match: (n: ts.Node) => boolean) {
  const found: ts.Node[] = [];
  const visit = (n: ts.Node) => { if (match(n)) found.push(n); ts.forEachChild(n, visit); };
  visit(root); return found;
}
export function declaration(ast: ts.SourceFile, name: string) {
  const n = nodes(ast, n => ts.isFunctionDeclaration(n) && n.name?.text === name)[0];
  if (!n || !ts.isFunctionDeclaration(n)) throw Error(`Missing real function ${name}`);
  return n;
}
export function code(ast: ts.SourceFile, name: string) {
  return declaration(ast, name).getText(ast).replace(/^export\s+(?:default\s+)?/, '');
}
export function compile(body: string, bindings: Record<string, any>) {
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React } }).outputText;
  return new Function(...Object.keys(bindings), js)(...Object.values(bindings));
}
export const ReactTree = { createElement: (type: any, props: any, ...children: any[]) => ({ type, key: props?.key, props: { ...props, children } }), Fragment: 'Fragment' };
export function treeNodes(tree: any, predicate: (n: any) => boolean): any[] {
  if (Array.isArray(tree)) return tree.flatMap(n => treeNodes(n, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...treeNodes(tree.props?.children, predicate)];
}
export function text(tree: any): string {
  if (Array.isArray(tree)) return tree.map(text).join(' ').replace(/\s+/g, ' ').trim();
  if (tree == null || typeof tree === 'boolean') return '';
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
const same = (a: any[], b: any[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
/** Deliberately not a React renderer. Runs actual component bodies and handlers;
 * effects/refs/state are confined to one explicit instance, with no scheduling guess. */
export class Hooks {
  cursor = 0;
  slots: any[] = [];
  queued: (() => void)[] = [];
  useState = (initial: any) => {
    const i = this.cursor++;
    if (!(i in this.slots)) this.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [this.slots[i], (next: any) => { this.slots[i] = typeof next === 'function' ? next(this.slots[i]) : next; }];
  };
  useRef = (value: any) => {
    const i = this.cursor++;
    if (!(i in this.slots)) this.slots[i] = { current: value };
    return this.slots[i];
  };
  useMemo = (fn: () => any, deps: any[]) => {
    const i = this.cursor++, previous = this.slots[i];
    if (!previous || !same(previous.deps, deps)) this.slots[i] = { deps, value: fn() };
    return this.slots[i].value;
  };
  useEffect = (fn: () => any, deps: any[]) => {
    const i = this.cursor++, previous = this.slots[i];
    if (!previous || !same(previous.deps, deps)) {
      this.slots[i] = { deps, cleanup: previous?.cleanup };
      this.queued.push(() => { this.slots[i].cleanup?.(); this.slots[i].cleanup = fn(); });
    }
  };
  bindings() { return { useState: this.useState, useRef: this.useRef, useMemo: this.useMemo, useEffect: this.useEffect, React: ReactTree }; }
  render(fn: (...args: any[]) => any, ...args: any[]) { this.cursor = 0; return fn(...args); }
  flush() { this.queued.splice(0).forEach(fn => fn()); }
  unmount() { this.slots.forEach(s => s?.cleanup?.()); }
}
export function deferred<T = any>() {
  let resolve!: (v: T) => void, reject!: (e: any) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
