import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Settings, MessageCircle, Bell, Building2, Save, RotateCcw,
  CheckCircle2, Info, Upload, ImageIcon, X, Clock, Send
} from "lucide-react";

// Variáveis disponíveis - idênticas ao Cobra Fácil
const VARIAVEIS = [
  { key: "{CLIENTE}", desc: "Nome do cliente" },
  { key: "{VALOR}", desc: "Valor da parcela" },
  { key: "{PARCELA}", desc: "Ex: Parcela 2/6" },
  { key: "{DATA}", desc: "Data de vencimento" },
  { key: "{DIAS_ATRASO}", desc: "Dias em atraso" },
  { key: "{DIAS_PARA_VENCER}", desc: "Dias até vencer" },
  { key: "{JUROS_CONTRATO}", desc: "Taxa de juros do contrato" },
  { key: "{MULTA}", desc: "Valor da multa" },
  { key: "{JUROS}", desc: "Valor dos juros" },
  { key: "{JUROS_MULTA}", desc: "Juros + Multa" },
  { key: "{TOTAL}", desc: "Total a pagar (com multas)" },
  { key: "{PROGRESSO}", desc: "Barra de progresso das parcelas" },
  { key: "{PIX}", desc: "Chave PIX do cliente" },
  { key: "{ASSINATURA}", desc: "Assinatura da empresa" },
  { key: "{FECHAMENTO}", desc: "Mensagem de fechamento" },
  { key: "{PARCELAS_STATUS}", desc: "Status de todas as parcelas" },
];

const TEMPLATES_PADRAO = {
  atraso: `⚠️ *Atenção {CLIENTE}* ━━━━━━━━━━━━━━━━
🚨 *PARCELA EM ATRASO*
💵 *Valor:* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* {DATA}
⏰ *Dias em Atraso:* {DIAS_ATRASO}
{MULTA}{JUROS}{TOTAL}
{PROGRESSO}
{PARCELAS_STATUS}
{PIX}
{FECHAMENTO}
{ASSINATURA}`,
  venceHoje: `🟡 *Olá {CLIENTE}!* ━━━━━━━━━━━━━━━━
📅 *SUA PARCELA VENCE HOJE!*
💵 *Valor:* {VALOR}
📊 *{PARCELA}*
⏰ *Vencimento:* {DATA}
{PROGRESSO}
{PIX}
{FECHAMENTO}
{ASSINATURA}`,
  antecipada: `🟢 *Olá {CLIENTE}!* ━━━━━━━━━━━━━━━━
📋 *LEMBRETE DE PARCELA*
💵 *Valor:* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* {DATA}
⏳ *Faltam:* {DIAS_PARA_VENCER} dias
{PROGRESSO}
{PIX}
{FECHAMENTO}
{ASSINATURA}`,
};

export default function Configuracoes() {
  const { t } = useTranslation();
  const { data: config } = trpc.configuracoes.get.useQuery();
  const utils = trpc.useUtils();
  const saveConfigMutation = trpc.configuracoes.save.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      utils.configuracoes.get.invalidate();
    },
    onError: (e: { message: string }) => toast.error("Erro: " + e.message),
  });

  // Templates de mensagem - carrega do backend se existir, senão usa padrão
  const [templateAtraso, setTemplateAtraso] = useState(() => (config as any)?.templateAtraso || TEMPLATES_PADRAO.atraso);
  const [templateVenceHoje, setTemplateVenceHoje] = useState(() => (config as any)?.templateVenceHoje || TEMPLATES_PADRAO.venceHoje);
  const [templateAntecipada, setTemplateAntecipada] = useState(() => (config as any)?.templateAntecipada || TEMPLATES_PADRAO.antecipada);
  const [abaAtiva, setAbaAtiva] = useState<"atraso" | "venceHoje" | "antecipada">("atraso");

  // Sincronizar todos os campos quando config carregar do backend
  useEffect(() => {
    if (!config) return;
    if ((config as any).templateAtraso) setTemplateAtraso((config as any).templateAtraso);
    if ((config as any).templateVenceHoje) setTemplateVenceHoje((config as any).templateVenceHoje);
    if ((config as any).templateAntecipada) setTemplateAntecipada((config as any).templateAntecipada);
    if ((config as any).pixKey !== undefined) setPixKey((config as any).pixKey);
    if ((config as any).nomeCobranca !== undefined) setNomeCobranca((config as any).nomeCobranca);
    if ((config as any).linkPagamento !== undefined) setLinkPagamento((config as any).linkPagamento);
    if ((config as any).logoUrl !== undefined) setLogoUrl((config as any).logoUrl);
    if (config.nomeEmpresa) setNomeEmpresa(config.nomeEmpresa);
    if (config.cnpjEmpresa) setCnpj(config.cnpjEmpresa);
    if (config.telefoneEmpresa) setTelefone(config.telefoneEmpresa);
    if (config.enderecoEmpresa) setEndereco(config.enderecoEmpresa);
    if (config.assinaturaWhatsapp) setAssinatura(config.assinaturaWhatsapp);
    if (config.fechamentoWhatsapp) setFechamento(config.fechamentoWhatsapp);
  }, [config]);

  // Refs para posição do cursor nos textareas
  const refAtraso = useRef<HTMLTextAreaElement>(null);
  const refVenceHoje = useRef<HTMLTextAreaElement>(null);
  const refAntecipada = useRef<HTMLTextAreaElement>(null);

  // Dados da empresa
  const [nomeEmpresa, setNomeEmpresa] = useState(config?.nomeEmpresa ?? "");
  const [cnpj, setCnpj] = useState(config?.cnpjEmpresa ?? "");
  const [telefone, setTelefone] = useState(config?.telefoneEmpresa ?? "");
  const [endereco, setEndereco] = useState(config?.enderecoEmpresa ?? "");
  const [assinatura, setAssinatura] = useState(config?.assinaturaWhatsapp ?? "");
  const [fechamento, setFechamento] = useState(config?.fechamentoWhatsapp ?? "");
  const [pixKey, setPixKey] = useState((config as any)?.pixKey ?? "");
  const [nomeCobranca, setNomeCobranca] = useState((config as any)?.nomeCobranca ?? "");
  const [linkPagamento, setLinkPagamento] = useState((config as any)?.linkPagamento ?? "");
  const [logoUrl, setLogoUrl] = useState((config as any)?.logoUrl ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Parâmetros financeiros
  const [multaPadrao, setMultaPadrao] = useState(String(config?.multaPadrao ?? "2"));
  const [jurosMora, setJurosMora] = useState(String(config?.jurosMoraDiario ?? "0.033"));
  const [diasLembrete, setDiasLembrete] = useState(String(config?.diasLembrete ?? "3"));
  const [multaDiaria, setMultaDiaria] = useState(String((config as any)?.multaDiaria ?? "100"));

  // Relatório Diário
  const [horarioRelatorio, setHorarioRelatorio] = useState((config as any)?.horarioRelatorio ?? "08:00");
  const [telefoneRelatorio, setTelefoneRelatorio] = useState((config as any)?.telefoneRelatorio ?? "");
  const [relatorioDiarioAtivo, setRelatorioDiarioAtivo] = useState((config as any)?.relatorioDiarioAtivo ?? false);

  const relatorioDiarioMutation = trpc.whatsapp.relatorioDiario.useMutation();

   // Inserir variável na posição do cursor
  const inserirVariavel = (variavel: string) => {
    const refs: Record<string, React.RefObject<HTMLTextAreaElement | null>> = {
      atraso: refAtraso,
      venceHoje: refVenceHoje,
      antecipada: refAntecipada,
    };
    const setters: Record<string, React.Dispatch<React.SetStateAction<string>>> = {
      atraso: setTemplateAtraso,
      venceHoje: setTemplateVenceHoje,
      antecipada: setTemplateAntecipada,
    };
    const ref = refs[abaAtiva]?.current;
    const setter = setters[abaAtiva];
    if (!ref || !setter) return;

    const start = ref.selectionStart ?? 0;
    const end = ref.selectionEnd ?? 0;
    const current = ref.value;
    const novo = current.substring(0, start) + variavel + current.substring(end);
    setter(novo);
    // Reposicionar cursor
    setTimeout(() => {
      ref.selectionStart = start + variavel.length;
      ref.selectionEnd = start + variavel.length;
      ref.focus();
    }, 0);
  };

  const resetarTemplate = () => {
    if (abaAtiva === "atraso") setTemplateAtraso(TEMPLATES_PADRAO.atraso);
    if (abaAtiva === "venceHoje") setTemplateVenceHoje(TEMPLATES_PADRAO.venceHoje);
    if (abaAtiva === "antecipada") setTemplateAntecipada(TEMPLATES_PADRAO.antecipada);
    toast.success("Template restaurado para o padrão!");
  };

  const resetarTodos = () => {
    setTemplateAtraso(TEMPLATES_PADRAO.atraso);
    setTemplateVenceHoje(TEMPLATES_PADRAO.venceHoje);
    setTemplateAntecipada(TEMPLATES_PADRAO.antecipada);
    toast.success("Todos os templates restaurados!");
  };

  const salvarTemplates = () => {
    saveConfigMutation.mutate({
      nomeEmpresa,
      cnpjEmpresa: cnpj,
      telefoneEmpresa: telefone,
      enderecoEmpresa: endereco,
      assinaturaWhatsapp: assinatura,
      fechamentoWhatsapp: fechamento,
      multaPadrao: parseFloat(multaPadrao) || 2,
      jurosMoraDiario: parseFloat(jurosMora) || 0.033,
      diasLembrete: parseInt(diasLembrete) || 3,
      multaDiaria: parseFloat(multaDiaria) || 100,
      pixKey,
      nomeCobranca,
      linkPagamento,
      templateAtraso,
      templateVenceHoje,
      templateAntecipada,
    } as any);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo deve ter no máximo 2MB'); return; }
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-logo', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Falha no upload');
      const { url } = await res.json();
      setLogoUrl(url);
      await saveConfigMutation.mutateAsync({ logoUrl: url } as any);
      toast.success('Logo salva com sucesso!');
    } catch {
      // Fallback: usar base64 local
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const b64 = ev.target?.result as string;
        setLogoUrl(b64);
        await saveConfigMutation.mutateAsync({ logoUrl: b64 } as any);
        toast.success('Logo salva com sucesso!');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingLogo(false);
    }
  };

  const salvarEmpresa = () => {
    saveConfigMutation.mutate({
      nomeEmpresa,
      cnpjEmpresa: cnpj,
      telefoneEmpresa: telefone,
      enderecoEmpresa: endereco,
      assinaturaWhatsapp: assinatura,
      fechamentoWhatsapp: fechamento,
      multaPadrao: parseFloat(multaPadrao) || 2,
      jurosMoraDiario: parseFloat(jurosMora) || 0.033,
      diasLembrete: parseInt(diasLembrete) || 3,
      multaDiaria: parseFloat(multaDiaria) || 100,
      pixKey,
      nomeCobranca,
      linkPagamento,
      logoUrl,
    } as any);
  };
  const templateAtuall = abaAtiva === "atraso" ? templateAtraso : abaAtiva === "venceHoje" ? templateVenceHoje : templateAntecipada;
  const setTemplateAtual = abaAtiva === "atraso" ? setTemplateAtraso : abaAtiva === "venceHoje" ? setTemplateVenceHoje : setTemplateAntecipada;
  const refAtual = abaAtiva === "atraso" ? refAtraso : abaAtiva === "venceHoje" ? refVenceHoje : refAntecipada;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl text-foreground tracking-wide">CONFIGURAÇÕES</h1>
        <p className="text-sm text-muted-foreground mt-1">Parâmetros do sistema CobraPro</p>
      </div>

      {/* Dados da Empresa */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Dados da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('configuration.companyName')}</Label>
              <Input className="mt-1" value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)} placeholder="CobraPro Financeira" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input className="mt-1" value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Telefone / WhatsApp</Label>
              <Input className="mt-1" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input className="mt-1" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número - Cidade/UF" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Assinatura WhatsApp</Label>
              <Input className="mt-1" value={assinatura} onChange={e => setAssinatura(e.target.value)} placeholder="Ex: Equipe CobraPro" />
              <p className="text-xs text-muted-foreground mt-1">Aparece como {"{"}ASSINATURA{"}"}nos templates</p>
            </div>
            <div>
              <Label>Mensagem de Fechamento</Label>
              <Input className="mt-1" value={fechamento} onChange={e => setFechamento(e.target.value)} placeholder="Ex: Regularize hoje e evite juros!" />
              <p className="text-xs text-muted-foreground mt-1">Aparece como {"{"}FECHAMENTO{"}"}nos templates</p>
            </div>
          </div>

          {/* Logo da Empresa */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Logo da Empresa</p>
            <div className="flex items-center gap-4">
              <div className="h-16 w-32 rounded-lg border border-border bg-muted/20 flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/20 hover:bg-muted/40 text-sm transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingLogo ? 'Enviando...' : 'Enviar Logo'}
                  </div>
                </label>
                {logoUrl && (
                  <button onClick={() => { setLogoUrl(''); saveConfigMutation.mutate({ logoUrl: '' } as any); }} className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80">
                    <X className="h-3 w-3" /> Remover logo
                  </button>
                )}
                <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Máx 2MB.<br/>Aparece no cabeçalho dos PDFs.</p>
              </div>
            </div>
          </div>

          {/* Campos de Cobrança */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Dados de Cobrança</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Chave PIX</Label>
                <Input className="mt-1" value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="CPF, CNPJ, email ou chave aleatória" />
                <p className="text-xs text-muted-foreground mt-1">Aparece como {"{"}PIX{"}"}nas mensagens</p>
              </div>
              <div>
                <Label>Nome no PIX / Cobrança</Label>
                <Input className="mt-1" value={nomeCobranca} onChange={e => setNomeCobranca(e.target.value)} placeholder="Nome que aparece no PIX" />
              </div>
            </div>
            <div className="mt-3">
              <Label>Link de Pagamento (opcional)</Label>
              <Input className="mt-1" value={linkPagamento} onChange={e => setLinkPagamento(e.target.value)} placeholder="https://nubank.com.br/cobrar/..." />
              <p className="text-xs text-muted-foreground mt-1">Link do Nubank, Mercado Pago ou outro. Enviado nas mensagens de cobrança.</p>
            </div>
          </div>
          <Button size="sm" className="gap-2" onClick={salvarEmpresa} disabled={saveConfigMutation.isPending}>
            <Save className="h-3 w-3" /> {saveConfigMutation.isPending ? "Salvando..." : "Salvar Dados da Empresa"}
          </Button>
        </CardContent>
      </Card>

      {/* Templates WhatsApp - idêntico ao Cobra Fácil */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#25D366]" />
            Mensagem de Cobrança - WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[#25D366]/5 border border-[#25D366]/20 text-xs text-[#25D366]">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Ao clicar em "Cobrar" em uma parcela, o WhatsApp será aberto no seu celular com a mensagem já preenchida automaticamente.
              Não é necessária nenhuma API paga.
            </span>
          </div>

          {/* Abas por tipo */}
          <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as typeof abaAtiva)}>
            <TabsList className="grid grid-cols-3 w-full bg-muted/30">
              <TabsTrigger value="atraso" className="gap-1.5 data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive">
                <span className="h-2 w-2 rounded-full bg-destructive inline-block" /> Atraso
              </TabsTrigger>
              <TabsTrigger value="venceHoje" className="gap-1.5 data-[state=active]:bg-warning/20 data-[state=active]:text-warning">
                <span className="h-2 w-2 rounded-full bg-warning inline-block" /> Vence Hoje
              </TabsTrigger>
              <TabsTrigger value="antecipada" className="gap-1.5 data-[state=active]:bg-success/20 data-[state=active]:text-success">
                <span className="h-2 w-2 rounded-full bg-success inline-block" /> Antecipada
              </TabsTrigger>
            </TabsList>

            {(["atraso", "venceHoje", "antecipada"] as const).map((aba) => {
              const val = aba === "atraso" ? templateAtraso : aba === "venceHoje" ? templateVenceHoje : templateAntecipada;
              const setter = aba === "atraso" ? setTemplateAtraso : aba === "venceHoje" ? setTemplateVenceHoje : setTemplateAntecipada;
              const ref = aba === "atraso" ? refAtraso : aba === "venceHoje" ? refVenceHoje : refAntecipada;
              return (
                <TabsContent key={aba} value={aba} className="mt-3 space-y-3">
                  <div className="relative">
                    <textarea
                      ref={ref}
                      className="w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      rows={10}
                      value={val}
                      onChange={e => setter(e.target.value)}
                    />
                    <button
                      onClick={resetarTemplate}
                      title="Restaurar template padrão"
                      className="absolute top-2 right-2 p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Variáveis disponíveis */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              Clique em uma variável para inserir no template ativo
            </div>
            <div className="flex flex-wrap gap-1.5">
              {VARIAVEIS.map(v => (
                <button
                  key={v.key}
                  title={v.desc}
                  onClick={() => inserirVariavel(v.key)}
                  className="px-2 py-1 rounded text-xs font-mono bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3 pt-1">
            <Button variant="outline" size="sm" className="gap-2" onClick={resetarTodos}>
              <RotateCcw className="h-3 w-3" /> Resetar Todos
            </Button>
            <Button size="sm" className="gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white" onClick={salvarTemplates}>
              <CheckCircle2 className="h-3 w-3" /> Salvar Templates
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* BREVO */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            BREVO - Email e Magic Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
            Configure o BREVO para envio de Magic Links de acesso ao portal do cliente e lembretes de pagamento por email.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>API Key do BREVO</Label>
              <Input className="mt-1 font-mono text-xs" type="password" placeholder="xkeysib-..." />
            </div>
            <div>
              <Label>Email Remetente</Label>
              <Input className="mt-1" type="email" placeholder="cobrancas@suaempresa.com" />
            </div>
          </div>
          <div>
            <Label>Dias de Antecedência para Lembrete</Label>
            <Input className="mt-1 w-24" type="number" min="1" max="30" value={diasLembrete} onChange={e => setDiasLembrete(e.target.value)} />
          </div>
          <Button size="sm" className="gap-2" onClick={() => toast.success("Configurações do BREVO salvas!")}>
            <Save className="h-3 w-3" /> Salvar
          </Button>
        </CardContent>
      </Card>

      {/* Parâmetros Financeiros */}
      {/* Relatório Diário Automático */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Relatório Diário via WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
            Configure o horário para receber o resumo diário (recebimentos, vencimentos e inadimplentes) via WhatsApp.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Horário de Envio</Label>
              <Input className="mt-1" type="time" value={horarioRelatorio} onChange={e => setHorarioRelatorio(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Horário preferido para receber o relatório</p>
            </div>
            <div>
              <Label>Número WhatsApp (com DDD)</Label>
              <Input className="mt-1" type="tel" placeholder="11999999999" value={telefoneRelatorio} onChange={e => setTelefoneRelatorio(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Número que receberá o relatório diário</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="relatorioDiarioAtivo" checked={relatorioDiarioAtivo} onChange={e => setRelatorioDiarioAtivo(e.target.checked)} className="w-4 h-4 rounded border-border" />
            <Label htmlFor="relatorioDiarioAtivo" className="cursor-pointer">Ativar lembrete de horário no navegador</Label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-2" onClick={() => {
              const saveData = { horarioRelatorio, telefoneRelatorio, relatorioDiarioAtivo: String(relatorioDiarioAtivo) };
              Promise.all(Object.entries(saveData).map(([k, v]) =>
                (trpc as any).configuracoes?.salvar?.mutate?.({ chave: k, valor: v })
              ));
              toast.success("Configurações do relatório diário salvas!");
            }}>
              <Save className="h-3 w-3" /> Salvar
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => {
              relatorioDiarioMutation.mutate({ telefone: telefoneRelatorio }, {
                onSuccess: (data) => {
                  if (data?.whatsappUrl) {
                    window.open(data.whatsappUrl, '_blank');
                    toast.success("Relatório gerado! WhatsApp aberto.");
                  }
                },
                onError: () => toast.error("Erro ao gerar relatório")
              });
            }} disabled={relatorioDiarioMutation.isPending}>
              <Send className="h-3 w-3" /> Enviar Agora
            </Button>
          </div>
          {relatorioDiarioAtivo && horarioRelatorio && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-xs text-success">
              ✅ Lembrete ativo: acesse o CobraPro às <strong>{horarioRelatorio}</strong> para enviar o relatório diário.
              {telefoneRelatorio && <> O relatório será enviado para <strong>{telefoneRelatorio}</strong>.</>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Parâmetros Financeiros Padrão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Multa por Atraso Padrão (%)</Label>
              <Input className="mt-1" type="number" step="0.01" value={multaPadrao} onChange={e => setMultaPadrao(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Aplicada uma vez no primeiro dia de atraso</p>
            </div>
            <div>
              <Label>Juros Mora Diário Padrão (%)</Label>
              <Input className="mt-1" type="number" step="0.001" value={jurosMora} onChange={e => setJurosMora(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Acumulado por dia após o vencimento</p>
            </div>
            <div>
              <Label>Multa por Dia de Atraso (R$)</Label>
              <Input className="mt-1" type="number" step="0.01" min="0" value={multaDiaria} onChange={e => setMultaDiaria(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Valor em R$ cobrado por dia de atraso nos empréstimos</p>
            </div>
          </div>
          <Button size="sm" className="gap-2" onClick={salvarEmpresa} disabled={saveConfigMutation.isPending}>
            <Save className="h-3 w-3" /> Salvar Parâmetros
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
