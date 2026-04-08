/**
 * Email helper para enviar emails via Brevo
 */

export interface EmailParams {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
}

export async function enviarEmail(params: EmailParams): Promise<boolean> {
  const brevoApiKey = process.env.BREVO_API_KEY ?? "";
  if (!brevoApiKey) {
    console.warn("[Email] BREVO_API_KEY não configurada");
    return false;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "CobraPro", email: "noreply@cobrapro.online" },
        to: [{ email: params.to, name: params.toName ?? params.to }],
        subject: params.subject,
        htmlContent: params.htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Email] Erro ao enviar email:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Email] Erro ao enviar email:", (err as Error).message);
    return false;
  }
}

export function gerarHtmlComprovante(dados: {
  clienteNome: string;
  numeroParcela: number;
  numeroParcelas: number;
  valorOriginal: number;
  valorJuros: number;
  valorMulta: number;
  valorDesconto: number;
  valorTotal: number;
  dataPagamento: string;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;padding:40px;border-radius:12px">
      <div style="text-align:center;margin-bottom:32px">
        <h1 style="color:#22c55e;font-size:28px;margin:0">CobraPro</h1>
        <p style="color:#6b7280;margin:8px 0 0">Comprovante de Pagamento</p>
      </div>
      <div style="background:#1a1a1a;padding:20px;border-radius:8px;margin-bottom:20px">
        <p style="color:#d1d5db;margin:0 0 12px"><strong>Cliente:</strong> ${dados.clienteNome}</p>
        <p style="color:#d1d5db;margin:0 0 12px"><strong>Parcela:</strong> ${dados.numeroParcela}/${dados.numeroParcelas}</p>
        <p style="color:#d1d5db;margin:0 0 12px"><strong>Data de Pagamento:</strong> ${dados.dataPagamento}</p>
        <p style="color:#d1d5db;margin:0 0 12px"><strong>Valor Original:</strong> R$ ${dados.valorOriginal.toFixed(2)}</p>
        ${dados.valorJuros > 0 ? `<p style="color:#fbbf24;margin:0 0 12px"><strong>Juros:</strong> R$ ${dados.valorJuros.toFixed(2)}</p>` : ''}
        ${dados.valorMulta > 0 ? `<p style="color:#f87171;margin:0 0 12px"><strong>Multa:</strong> R$ ${dados.valorMulta.toFixed(2)}</p>` : ''}
        ${dados.valorDesconto > 0 ? `<p style="color:#22c55e;margin:0 0 12px"><strong>Desconto:</strong> -R$ ${dados.valorDesconto.toFixed(2)}</p>` : ''}
        <p style="color:#22c55e;margin:12px 0 0;font-size:18px"><strong>Total Pago: R$ ${dados.valorTotal.toFixed(2)}</strong></p>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">Este é um comprovante automático. Não responda este email.</p>
    </div>
  `;
}

export function gerarHtmlLembreteVencimento(dados: {
  clienteNome: string;
  numeroParcela: number;
  numeroParcelas: number;
  valor: number;
  dataVencimento: string;
  diasParaVencer: number;
}): string {
  const tipo = dados.diasParaVencer <= 1 ? "VENCE HOJE" : `VENCE EM ${dados.diasParaVencer} DIAS`;
  
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;padding:40px;border-radius:12px">
      <div style="text-align:center;margin-bottom:32px">
        <h1 style="color:#22c55e;font-size:28px;margin:0">CobraPro</h1>
        <p style="color:#6b7280;margin:8px 0 0">Lembrete de Vencimento</p>
      </div>
      <div style="background:#1a1a1a;padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #fbbf24">
        <p style="color:#fbbf24;margin:0 0 12px;font-size:16px"><strong>${tipo}</strong></p>
        <p style="color:#d1d5db;margin:0 0 12px"><strong>Cliente:</strong> ${dados.clienteNome}</p>
        <p style="color:#d1d5db;margin:0 0 12px"><strong>Parcela:</strong> ${dados.numeroParcela}/${dados.numeroParcelas}</p>
        <p style="color:#d1d5db;margin:0 0 12px"><strong>Valor:</strong> R$ ${dados.valor.toFixed(2)}</p>
        <p style="color:#d1d5db;margin:0 0 12px"><strong>Vencimento:</strong> ${dados.dataVencimento}</p>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">Regularize seu pagamento em dia para evitar juros e multas.</p>
    </div>
  `;
}
