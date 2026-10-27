import { describe, expect, it } from "vitest";
import { montarHtmlContrato } from "./contratoHtml";

describe("montarHtmlContrato", () => {
  it("codifica dados não confiáveis sem transformar conteúdo em markup", () => {
    const html = montarHtmlContrato({
      empresa: { nome: '<script>alert(1)</script>' },
      cliente: { nome: '<img src=x onerror=alert(1)>', endereco: 'Rua & <b>100</b>' },
      contrato: {
        id: 7,
        modalidade: '<svg/onload=alert(1)>',
        status: 'ativo',
        capital: 'R$ 100,00',
        total: 'R$ 110,00',
        taxa: '10%',
        numeroParcelas: 1,
        valorParcela: 'R$ 110,00',
        descricao: '<a href=javascript:alert(1)>x</a>',
        dataInicio: '27/10/2026',
      },
      parcelas: [{ numero: 1, vencimento: '30/10/2026', valor: 'R$ 110,00', status: 'pendente' }],
      geradoEm: '27/10/2026',
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('Rua &amp; &lt;b&gt;100&lt;/b&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });
});
