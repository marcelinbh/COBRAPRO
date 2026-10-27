import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface DadosComprovante {
  clienteNome: string;
  clienteCPF?: string;
  clienteTelefone?: string;
  contratoId: number;
  parcelaNumero: number;
  valorOriginal: number;
  juros: number;
  valorPago: number;
  dataPagamento: string;
  modalidade: string;
  proximoVencimento?: string;
  // Dados da empresa (das configurações)
  nomeEmpresa?: string;
  logoUrl?: string;
  enderecoEmpresa?: string;
  telefoneEmpresa?: string;
}

/** Codifica texto não confiável antes de interpolá-lo no HTML usado pelo PDF. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatarMoedaPdf(valor: number): string {
  const valorSeguro = Number.isFinite(valor) ? valor : 0;
  return valorSeguro.toFixed(2).replace('.', ',');
}

function formatarDataPdf(data: string | undefined): string {
  if (!data) return 'N/A';
  const parsed = new Date(data);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString('pt-BR');
}

/** Aceita apenas URL HTTPS em atributo src; evita javascript:, data: e URLs relativas ambíguas. */
export function normalizarLogoUrl(valor: string | undefined): string | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export async function gerarComprovanteHTML(dados: DadosComprovante): Promise<string> {
  const dataFormatada = formatarDataPdf(dados.dataPagamento);
  const proximaData = formatarDataPdf(dados.proximoVencimento);
  const nomeEmpresa = dados.nomeEmpresa || 'CobraPro';
  const logoUrl = normalizarLogoUrl(dados.logoUrl);

  const texto = {
    dataFormatada: escapeHtml(dataFormatada),
    proximaData: escapeHtml(proximaData),
    nomeEmpresa: escapeHtml(nomeEmpresa),
    enderecoEmpresa: escapeHtml(dados.enderecoEmpresa),
    telefoneEmpresa: escapeHtml(dados.telefoneEmpresa),
    clienteNome: escapeHtml(dados.clienteNome),
    clienteCPF: escapeHtml(dados.clienteCPF),
    clienteTelefone: escapeHtml(dados.clienteTelefone),
    modalidade: escapeHtml(dados.modalidade),
    logoUrl: logoUrl ? escapeHtml(logoUrl) : null,
  };

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: white;">
      <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
        ${texto.logoUrl ? `<img src="${texto.logoUrl}" alt="Logo" style="max-height: 60px; max-width: 200px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />` : ''}
        <h1 style="margin: 0; color: #1a1a1a; font-size: 22px;">${texto.nomeEmpresa}</h1>
        <h2 style="margin: 5px 0; color: #333; font-size: 16px; font-weight: normal;">COMPROVANTE DE PAGAMENTO</h2>
        ${dados.enderecoEmpresa ? `<p style="margin: 3px 0; color: #666; font-size: 11px;">${texto.enderecoEmpresa}</p>` : ''}
        ${dados.telefoneEmpresa ? `<p style="margin: 3px 0; color: #666; font-size: 11px;">Tel: ${texto.telefoneEmpresa}</p>` : ''}
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">DADOS DO PAGAMENTO</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr><td style="padding: 8px; width: 50%; border: 1px solid #eee;"><strong>Data:</strong></td><td style="padding: 8px; border: 1px solid #eee;">${texto.dataFormatada}</td></tr>
          <tr><td style="padding: 8px; width: 50%; border: 1px solid #eee;"><strong>Contrato:</strong></td><td style="padding: 8px; border: 1px solid #eee;">#${escapeHtml(dados.contratoId)}</td></tr>
          <tr><td style="padding: 8px; width: 50%; border: 1px solid #eee;"><strong>Parcela:</strong></td><td style="padding: 8px; border: 1px solid #eee;">${escapeHtml(dados.parcelaNumero)}</td></tr>
          <tr><td style="padding: 8px; width: 50%; border: 1px solid #eee;"><strong>Modalidade:</strong></td><td style="padding: 8px; border: 1px solid #eee;">${texto.modalidade}</td></tr>
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">DADOS DO CLIENTE</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr><td style="padding: 8px; width: 50%; border: 1px solid #eee;"><strong>Nome:</strong></td><td style="padding: 8px; border: 1px solid #eee;">${texto.clienteNome}</td></tr>
          ${dados.clienteCPF ? `<tr><td style="padding: 8px; border: 1px solid #eee;"><strong>CPF:</strong></td><td style="padding: 8px; border: 1px solid #eee;">${texto.clienteCPF}</td></tr>` : ''}
          ${dados.clienteTelefone ? `<tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Telefone:</strong></td><td style="padding: 8px; border: 1px solid #eee;">${texto.clienteTelefone}</td></tr>` : ''}
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">VALORES</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr><td style="padding: 8px; width: 50%; border: 1px solid #eee;"><strong>Valor Original:</strong></td><td style="padding: 8px; border: 1px solid #eee; text-align: right;">R$ ${formatarMoedaPdf(dados.valorOriginal)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Juros:</strong></td><td style="padding: 8px; border: 1px solid #eee; text-align: right;">R$ ${formatarMoedaPdf(dados.juros)}</td></tr>
          <tr style="background-color: #f0f0f0;"><td style="padding: 8px; border: 1px solid #ddd;"><strong>Valor Pago:</strong></td><td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; font-size: 14px;">R$ ${formatarMoedaPdf(dados.valorPago)}</td></tr>
        </table>
      </div>

      ${dados.proximoVencimento ? `<div style="margin-bottom: 20px; background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4CAF50;"><strong>Próximo Vencimento:</strong> ${texto.proximaData}</div>` : ''}

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #999;">
        <p>Comprovante gerado automaticamente pelo sistema CobraPro</p>
        <p>Data e hora: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p>
      </div>
    </div>
  `;
}

export async function gerarComprovantePDF(dados: DadosComprovante, nomeArquivo?: string) {
  try {
    const container = document.createElement('div');
    container.innerHTML = await gerarComprovanteHTML(dados);
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    const filename = nomeArquivo || `comprovante_${dados.contratoId}_${dados.parcelaNumero}.pdf`;
    pdf.save(filename);
    document.body.removeChild(container);
    return true;
  } catch (error) {
    console.error('Erro ao gerar comprovante:', error);
    return false;
  }
}
