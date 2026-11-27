import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = fileURLToPath(new URL('../tests/quitacao58/', import.meta.url));
const read = (p: string) => fs.readFileSync(p, 'utf8');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const sql = read(root + 'drizzle/0058_quitacao_conta_alvo.sql');
const cert = JSON.parse(read(dir + 'certification.json'));

describe('Quitação58 — pacote SQL aprovado e provas reproduzíveis', () => {
  it('mantém os bytes exatos da migração instalada uma única vez', () => {
    expect(hash(sql)).toBe('cf0e949d9628b6de51a1b9cd9c52272cfbda072ffc3e9a80ea89c4f975cd6b72');
    expect(cert.SQLSHA256).toBe(hash(sql));
  });
  it('difere do final30 somente nos três seletores do instalador', () => {
    const old = read(dir + 'old30-rejected.fixture.sql').split('\n');
    const current = sql.split('\n');
    expect(current.length).toBe(old.length);
    const delta = current.flatMap((line, i) => line === old[i] ? [] : [i + 1]);
    expect(delta).toEqual([25, 49, 52]);
  });
  it('restaura cada fonte certificada ao inverter somente as referências de caminho', () => {
    for (const [name, p] of Object.entries(cert.portProvenance) as [string, any][]) {
      const current = read(dir + name);
      expect(hash(current), name).toBe(p.portedSHA256);
      let restored = current;
      for (const [from, to] of [...p.pathRelocationsOnly].reverse()) restored = restored.split(to).join(from);
      expect(hash(restored), name).toBe(p.certifiedSourceSHA256);
      expect(p.inverseRestoresExactCertifiedSource).toBe(true);
    }
  });
  it('mantém o helper fechado e a escolha explícita de caixa próprio', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION obrigacoes51.validar_livro_recebimento(integer,integer,integer) FROM PUBLIC,anon,authenticated,service_role;');
    expect(sql).toContain('PERFORM obrigacoes51.validar_livro_recebimento(uid,dest,cid);');
    expect(sql).toContain('dest IS DISTINCT FROM (s->\'contrato\'->>\'conta_caixa_id\')::int');
    expect(sql).toContain('WHERE conta_caixa_id=aid OR contrato_id=cid OR parcela_id IN');
  });
  it('mantém os witnesses globais e o crescimento relativo de uma função', () => {
    expect(cert.globalWitnessesExact).toBe(true);
    expect(cert.original360PinsAndMetadataExpressionsExact).toBe(true);
    expect(sql).toContain('CREATE TEMP TABLE witness58_functions ON COMMIT DROP');
    expect(sql).toContain('CREATE TEMP TABLE witness58_catalog ON COMMIT DROP');
  });
  it('declara os dois perfis reais, sem transformar instalação em certificado da interface', () => {
    expect(cert.privateCertification.private.status).toBe('GREEN');
    expect(cert.privateCertification.supabase.status).toBe('GREEN');
    expect(cert.privateCertification.private.installerProbes).toBe(56);
    expect(cert.privateCertification.supabase.installerProbes).toBe(62);
    expect(cert.productionPostflight.financial97AllColumnsAllOwnersEqual).toBe(true);
    expect(cert.productionPostflight.platform100).toBe(false);
    expect(cert.productionPostflight.UISettlementNotYetSubmitted).toBe(true);
  });
});
