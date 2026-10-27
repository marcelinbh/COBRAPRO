import { describe, expect, it } from "vitest";
import { gerarComprovanteHTML, normalizarLogoUrl } from "./gerarComprovante";

describe("gerarComprovanteHTML", () => {
  it("escapa conteúdo controlado por cliente e empresa", async () => {
    const html = await gerarComprovanteHTML({
      clienteNome: '<img src=x onerror=alert(1)>',
      nomeEmpresa: 'Empresa <script>alert(1)</script>',
      enderecoEmpresa: 'Rua "A" & B',
      modalidade: '<svg/onload=alert(1)>',
      contratoId: 10,
      parcelaNumero: 2,
      valorOriginal: 100,
      juros: 0,
      valorPago: 100,
      dataPagamento: '2026-10-27T12:00:00-03:00',
    });

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('Empresa &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Rua &quot;A&quot; &amp; B');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it("rejeita protocolos perigosos na logo", () => {
    expect(normalizarLogoUrl('javascript:alert(1)')).toBeNull();
    expect(normalizarLogoUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(normalizarLogoUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
  });
});
