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
}

export async function gerarComprovanteHTML(dados: DadosComprovante): Promise<string> {
  const dataFormatada = new Date(dados.dataPagamento).toLocaleDateString('pt-BR');
  const proximaData = dados.proximoVencimento 
    ? new Date(dados.proximoVencimento).toLocaleDateString('pt-BR')
    : 'N/A';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: white;">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="margin: 0; color: #1a1a1a; font-size: 24px;">COMPROVANTE DE PAGAMENTO</h1>
        <p style="margin: 5px 0; color: #666; font-size: 12px;">CobraPro - Sistema de Gestão de Cobranças</p>
      </div>

      <!-- Dados do Pagamento -->
      <div style="margin-bottom: 20px;">
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">DADOS DO PAGAMENTO</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 8px; width: 50%; border: 1px solid #eee;"><strong>Data:</strong></td>
            <td style="padding: 8px; border: 1px solid #eee;">${dataFormatada}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #eee;"><strong>Contrato:</strong></td>
            <td style="padding: 8px; border: 1px solid #eee;">#${dados.contratoId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #eee;"><strong>Parcela:</strong></td>
            <td style="padding: 8px; border: 1px solid #eee;">${dados.parcelaNumero}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #eee;"><strong>Modalidade:</strong></td>
            <td style="padding: 8px; border: 1px solid #eee;">${dados.modalidade}</td>
          </tr>
        </table>
      </div>

      <!-- Dados do Cliente -->
      <div style="margin-bottom: 20px;">
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">DADOS DO CLIENTE</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 8px; width: 50%; border: 1px solid #eee;"><strong>Nome:</strong></td>
            <td style="padding: 8px; border: 1px solid #eee;">${dados.clienteNome}</td>
          </tr>
          ${dados.clienteCPF ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #eee;"><strong>CPF:</strong></td>
            <td style="padding: 8px; border: 1px solid #eee;">${dados.clienteCPF}</td>
          </tr>
          ` : ''}
          ${dados.clienteTelefone ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #eee;"><strong>Telefone:</strong></td>
            <td style="padding: 8px; border: 1px solid #eee;">${dados.clienteTelefone}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Valores -->
      <div style="margin-bottom: 20px;">
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">VALORES</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 8px; width: 50%; border: 1px solid #eee;"><strong>Valor Original:</strong></td>
            <td style="padding: 8px; border: 1px solid #eee; text-align: right;">R$ ${dados.valorOriginal.toFixed(2).replace('.', ',')}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #eee;"><strong>Juros:</strong></td>
            <td style="padding: 8px; border: 1px solid #eee; text-align: right;">R$ ${dados.juros.toFixed(2).replace('.', ',')}</td>
          </tr>
          <tr style="background-color: #f0f0f0;">
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Valor Pago:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; font-size: 14px;">R$ ${dados.valorPago.toFixed(2).replace('.', ',')}</td>
          </tr>
        </table>
      </div>

      <!-- Próximo Vencimento -->
      ${dados.proximoVencimento ? `
      <div style="margin-bottom: 20px; background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4CAF50;">
        <strong>Próximo Vencimento:</strong> ${proximaData}
      </div>
      ` : ''}

      <!-- Footer -->
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #999;">
        <p>Comprovante gerado automaticamente pelo sistema CobraPro</p>
        <p>Data e hora: ${new Date().toLocaleString('pt-BR')}</p>
      </div>
    </div>
  `;
}

export async function gerarComprovantePDF(dados: DadosComprovante, nomeArquivo?: string) {
  try {
    // Criar elemento temporário
    const container = document.createElement('div');
    container.innerHTML = await gerarComprovanteHTML(dados);
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    // Converter HTML para canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    // Criar PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    // Download
    const filename = nomeArquivo || `comprovante_${dados.contratoId}_${dados.parcelaNumero}.pdf`;
    pdf.save(filename);

    // Limpar
    document.body.removeChild(container);

    return true;
  } catch (error) {
    console.error('Erro ao gerar comprovante:', error);
    return false;
  }
}
