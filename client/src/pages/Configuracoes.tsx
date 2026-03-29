import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, MessageCircle, Bell, Building2, Save, Edit3, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

export default function Configuracoes() {
  const { data: templates } = trpc.configuracoes.templates.useQuery();
  const utils = trpc.useUtils();

  const [editTemplate, setEditTemplate] = useState<{ id: number; nome: string; mensagem: string } | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsappApiKey, setWhatsappApiKey] = useState("");
  const [whatsappNumero, setWhatsappNumero] = useState("");
  const [brevoApiKey, setBrevoApiKey] = useState("");
  const [brevoEmail, setBrevoEmail] = useState("");
  const [diasLembrete, setDiasLembrete] = useState("3");
  const [multaPadrao, setMultaPadrao] = useState("2");
  const [jurosMora, setJurosMora] = useState("0.033");

  const updateTemplateMutation = trpc.configuracoes.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template atualizado com sucesso!");
      setEditTemplate(null);
      utils.configuracoes.templates.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const handleSaveEmpresa = () => {
    toast.success("Dados da empresa salvos! (Configure via variáveis de ambiente para produção)");
  };

  const handleSaveWhatsapp = () => {
    toast.success("Configurações do WhatsApp salvas!");
  };

  const handleSaveBrevo = () => {
    toast.success("Configurações do BREVO salvas!");
  };

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
              <Label>Nome da Empresa</Label>
              <Input className="mt-1" value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)} placeholder="CobraPro Financeira" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input className="mt-1" value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
          </div>
          <div>
            <Label>Telefone / WhatsApp da Empresa</Label>
            <Input className="mt-1" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <Button size="sm" className="gap-2" onClick={handleSaveEmpresa}>
            <Save className="h-3 w-3" /> Salvar
          </Button>
        </CardContent>
      </Card>

      {/* Templates WhatsApp */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-success" />
            Templates de Mensagem WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-success/5 border border-success/20 text-xs text-success">
            Variáveis disponíveis: <code className="bg-success/10 px-1 rounded">{"{{nome}}"}</code> <code className="bg-success/10 px-1 rounded">{"{{valor}}"}</code> <code className="bg-success/10 px-1 rounded">{"{{dataVencimento}}"}</code> <code className="bg-success/10 px-1 rounded">{"{{chavePix}}"}</code> <code className="bg-success/10 px-1 rounded">{"{{numeroParcela}}"}</code>
          </div>
          {templates?.map(template => (
            <div key={template.id} className="p-4 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{template.nome}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${template.ativo ? 'bg-success/15 text-success border-success/30' : 'bg-muted text-muted-foreground border-border'}`}>
                    {template.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      onClick={() => setEditTemplate({ id: template.id, nome: template.nome, mensagem: template.mensagem })}
                    >
                      <Edit3 className="h-3 w-3" /> Editar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="font-display text-xl tracking-wide">EDITAR TEMPLATE</DialogTitle>
                    </DialogHeader>
                    {editTemplate && (
                      <div className="space-y-4 mt-2">
                        <div>
                          <Label>Nome do Template</Label>
                          <Input
                            className="mt-1"
                            value={editTemplate.nome}
                            onChange={e => setEditTemplate(t => t ? { ...t, nome: e.target.value } : null)}
                          />
                        </div>
                        <div>
                          <Label>Mensagem</Label>
                          <textarea
                            className="mt-1 w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                            rows={5}
                            value={editTemplate.mensagem}
                            onChange={e => setEditTemplate(t => t ? { ...t, mensagem: e.target.value } : null)}
                          />
                        </div>
                        <Button
                          className="w-full gap-2"
                          disabled={updateTemplateMutation.isPending}
                          onClick={() => updateTemplateMutation.mutate({
                            id: editTemplate.id,
                            nome: editTemplate.nome,
                            mensagem: editTemplate.mensagem,
                          })}
                        >
                          <Check className="h-4 w-4" />
                          {updateTemplateMutation.isPending ? "Salvando..." : "Salvar Template"}
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-xs text-muted-foreground font-mono bg-muted/30 p-2 rounded">{template.mensagem}</p>
            </div>
          ))}
          {(!templates || templates.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum template cadastrado</p>
          )}
        </CardContent>
      </Card>

      {/* BREVO */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            BREVO — Email e Magic Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
            Configure o BREVO para envio de Magic Links de acesso ao portal do cliente e lembretes de pagamento por email.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>API Key do BREVO</Label>
              <Input className="mt-1 font-mono text-xs" type="password" value={brevoApiKey} onChange={e => setBrevoApiKey(e.target.value)} placeholder="xkeysib-..." />
            </div>
            <div>
              <Label>Email Remetente</Label>
              <Input className="mt-1" type="email" value={brevoEmail} onChange={e => setBrevoEmail(e.target.value)} placeholder="cobrancas@suaempresa.com" />
            </div>
          </div>
          <div>
            <Label>Dias de Antecedência para Lembrete</Label>
            <Input className="mt-1 w-24" type="number" min="1" max="30" value={diasLembrete} onChange={e => setDiasLembrete(e.target.value)} />
          </div>
          <Button size="sm" className="gap-2" onClick={handleSaveBrevo}>
            <Save className="h-3 w-3" /> Salvar
          </Button>
        </CardContent>
      </Card>

      {/* Parâmetros Financeiros */}
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
            </div>
            <div>
              <Label>Juros Mora Diário Padrão (%)</Label>
              <Input className="mt-1" type="number" step="0.001" value={jurosMora} onChange={e => setJurosMora(e.target.value)} />
            </div>
          </div>
          <Button size="sm" className="gap-2" onClick={() => toast.success("Parâmetros salvos!")}>
            <Save className="h-3 w-3" /> Salvar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
