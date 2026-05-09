#!/usr/bin/env python3
import json
import re
from pathlib import Path
from collections import defaultdict

# Tradução manual de termos comuns
TRANSLATIONS = {
    # Toast Success
    "Conta marcada como paga!": "¡Cuenta marcada como pagada!",
    "Comprovante gerado!": "¡Comprobante generado!",
    "WhatsApp desconectado": "WhatsApp desconectado",
    "Juros pagos! Empréstimo renovado.": "¡Intereses pagados! Préstamo renovado.",
    "Cheque marcado como devolvido.": "Cheque marcado como devuelto.",
    "Configurações do relatório diário salvas!": "¡Configuración del informe diario guardada!",
    "Assinatura removida!": "¡Suscripción eliminada!",
    "Empréstimo atualizado com sucesso!": "¡Préstamo actualizado exitosamente!",
    "Assinatura criada com sucesso!": "¡Suscripción creada exitosamente!",
    "Senha alterada com sucesso!": "¡Contraseña cambiada exitosamente!",
    "Conta a pagar registrada com sucesso.": "Cuenta por pagar registrada exitosamente.",
    "Etiquetas salvas!": "¡Etiquetas guardadas!",
    "Chave PIX salva!": "¡Clave PIX guardada!",
    "Contrato criado com sucesso!": "¡Contrato creado exitosamente!",
    "Relatório gerado! WhatsApp aberto.": "¡Informe generado! WhatsApp abierto.",
    "Assinatura atualizada!": "¡Suscripción actualizada!",
    "Chave PIX copiada!": "¡Clave PIX copiada!",
    "Parcela atualizada!": "¡Cuota actualizada!",
    "Etiqueta criada!": "¡Etiqueta creada!",
    "Cheque marcado como compensado!": "¡Cheque marcado como compensado!",
    "Configurações do BREVO salvas!": "¡Configuración de BREVO guardada!",
    "Excel exportado com sucesso!": "¡Excel exportado exitosamente!",
    "Perfil atualizado!": "¡Perfil actualizado!",
    "Excluído com sucesso!": "¡Eliminado exitosamente!",
    "Cobrador atualizado!": "¡Cobrador actualizado!",
    "Conta cancelada.": "Cuenta cancelada.",
    "Multa aplicada com sucesso!": "¡Multa aplicada exitosamente!",
    "Foto carregada!": "¡Foto cargada!",
    "Logo enviada com sucesso!": "¡Logo enviado exitosamente!",
    "Logo salva com sucesso!": "¡Logo guardado exitosamente!",
    "Empréstimo deletado": "Préstamo eliminado",
    "Cliente deletado com sucesso!": "¡Cliente eliminado exitosamente!",
    "Transação registrada!": "¡Transacción registrada!",
    "Cobrador criado com sucesso!": "¡Cobrador creado exitosamente!",
    "Parcela paga com sucesso!": "¡Cuota pagada exitosamente!",
    "Parcela paga!": "¡Cuota pagada!",
    "Mensagem salva com sucesso!": "¡Mensaje guardado exitosamente!",
    "Conta criada!": "¡Cuenta creada!",
    "Lançamento registrado no caixa!": "¡Lanzamiento registrado en caja!",
    "Relatório enviado com sucesso! Verifique seu WhatsApp.": "¡Informe enviado exitosamente! Verifique su WhatsApp.",
    "PDF gerado com sucesso!": "¡PDF generado exitosamente!",
    "Pagamento registrado!": "¡Pago registrado!",
    "Logo removida!": "¡Logo eliminado!",
    "Pagamento registrado com sucesso!": "¡Pago registrado exitosamente!",
    "Produto cadastrado com sucesso!": "¡Producto registrado exitosamente!",
    "Template salvo!": "¡Plantilla guardada!",
    "Parcela criada com sucesso!": "¡Cuota creada exitosamente!",
    "Template restaurado para o padrão!": "¡Plantilla restaurada al predeterminado!",
    "Todos os templates restaurados!": "¡Todas las plantillas restauradas!",
    "Cliente atualizado!": "¡Cliente actualizado!",
    "WhatsApp conectado com sucesso!": "¡WhatsApp conectado exitosamente!",
    "Backup completo exportado!": "¡Copia de seguridad completa exportada!",
    "Cobrador desativado!": "¡Cobrador desactivado!",
    "PDF exportado com sucesso!": "¡PDF exportado exitosamente!",
    "Conta excluída.": "Cuenta eliminada.",
    "PDF do contrato gerado!": "¡PDF del contrato generado!",
    "Configurações salvas com sucesso!": "¡Configuración guardada exitosamente!",
    "Cheque cancelado.": "Cheque cancelado.",
    "Bem-vindo de volta!": "¡Bienvenido de vuelta!",
    "Taxa de juros atualizada!": "¡Tasa de interés actualizada!",
    
    # Toast Error
    "Informe o nome da sua empresa": "Informe el nombre de su empresa",
    "Informe o valor pago": "Informe el valor pagado",
    "Nenhuma parcela para exportar": "Ninguna cuota para exportar",
    "Erro ao pagar parcela": "Error al pagar cuota",
    "WhatsApp não está conectado. Vá em Meu Perfil para conectar.": "WhatsApp no está conectado. Vaya a Mi Perfil para conectar.",
    "Telefone WhatsApp não cadastrado": "Teléfono WhatsApp no registrado",
    "Digite o valor da multa": "Ingrese el valor de la multa",
    "Contrato não encontrado": "Contrato no encontrado",
    "Preencha cliente, serviço e valor mensal": "Complete cliente, servicio y valor mensual",
    "Produto obrigatório: informe marca e modelo.": "Producto obligatorio: informe marca y modelo.",
    "Selecione uma imagem": "Seleccione una imagen",
    "Não foi possível gerar o link do WhatsApp": "No fue posible generar el enlace de WhatsApp",
    "Arquivo muito grande. Máximo 2MB.": "Archivo muy grande. Máximo 2MB.",
    "Selecione uma conta": "Seleccione una cuenta",
    "Erro ao fazer upload da foto": "Error al cargar la foto",
    "As senhas não coincidem": "Las contraseñas no coinciden",
    "Informe a data de vencimento": "Informe la fecha de vencimiento",
    "Digite um número de contrato válido": "Ingrese un número de contrato válido",
    "A senha deve ter pelo menos 6 caracteres": "La contraseña debe tener al menos 6 caracteres",
    "Erro ao fazer upload dos documentos": "Error al cargar los documentos",
    "Informe uma descrição": "Informe una descripción",
    "CSV vazio ou sem dados": "CSV vacío o sin datos",
    "Informe o valor da parcela": "Informe el valor de la cuota",
    "Erro de conexão. Tente novamente.": "Error de conexión. Intente de nuevo.",
    "Preencha todas as datas de vencimento": "Complete todas las fechas de vencimiento",
    "Erro ao gerar relatório": "Error al generar informe",
    "Nome é obrigatório": "El nombre es obligatorio",
    "Logo deve ter no máximo 2MB": "El logo debe tener un máximo de 2MB",
    "Nenhuma parcela pendente": "Ninguna cuota pendiente",
    "Digite a nova taxa de juros": "Ingrese la nueva tasa de interés",
    "Configure o número de telefone primeiro": "Configure el número de teléfono primero",
    "Nome obrigatório: informe o nome do comprador.": "Nombre obligatorio: informe el nombre del comprador.",
    "Nenhum cliente tem WhatsApp cadastrado": "Ningún cliente tiene WhatsApp registrado",
    "Erro ao gerar comprovante": "Error al generar comprobante",
    "Nenhuma conta caixa encontrada. Crie uma conta no módulo Caixa.": "Ninguna cuenta de caja encontrada. Cree una cuenta en el módulo Caja.",
    "Informe o motivo da devolução": "Informe el motivo de la devolución",
}

def main():
    # Carregar textos extraídos
    with open('/home/ubuntu/cobrapro/textos-para-traduzir.json', 'r', encoding='utf-8') as f:
        textos = json.load(f)
    
    # Carregar traduções existentes
    with open('/home/ubuntu/cobrapro/client/src/i18n/locales/pt-BR.json', 'r', encoding='utf-8') as f:
        pt_br = json.load(f)
    
    with open('/home/ubuntu/cobrapro/client/src/i18n/locales/es.json', 'r', encoding='utf-8') as f:
        es = json.load(f)
    
    # Adicionar novos textos
    for category, texts_list in textos.items():
        if category not in pt_br:
            pt_br[category] = {}
        if category not in es:
            es[category] = {}
        
        for text in texts_list:
            # Gerar chave
            key = text.lower()[:50].replace(' ', '_').replace('!', '').replace('?', '').replace('.', '').replace(',', '')
            key = ''.join(c for c in key if c.isalnum() or c == '_')[:40]
            
            # Adicionar ao PT-BR
            if key not in pt_br[category]:
                pt_br[category][key] = text
            
            # Adicionar ao ES (tradução manual ou automática)
            if key not in es[category]:
                if text in TRANSLATIONS:
                    es[category][key] = TRANSLATIONS[text]
                else:
                    # Tradução automática simples (placeholder)
                    es[category][key] = f"[TRADUZIR] {text}"
    
    # Salvar
    with open('/home/ubuntu/cobrapro/client/src/i18n/locales/pt-BR.json', 'w', encoding='utf-8') as f:
        json.dump(pt_br, f, ensure_ascii=False, indent=2)
    
    with open('/home/ubuntu/cobrapro/client/src/i18n/locales/es.json', 'w', encoding='utf-8') as f:
        json.dump(es, f, ensure_ascii=False, indent=2)
    
    print("✅ Traduções adicionadas aos arquivos JSON!")
    print(f"PT-BR: {len(pt_br)} categorias")
    print(f"ES: {len(es)} categorias")

if __name__ == '__main__':
    main()
