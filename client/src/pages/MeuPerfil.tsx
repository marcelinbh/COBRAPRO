import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  User, Mail, Phone, Building2, Calendar, TrendingUp, Users, DollarSign,
  Crown, Clock, RefreshCw, QrCode, Smartphone, WifiOff, Wifi, KeyRound,
  Eye, EyeOff, Upload, Trash2, Edit3, Save, X, CheckCircle2, AlertCircle, Link
} from "lucide-react";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string | Date | null | undefined) {
  if (!data) return "-";
  return new Date(data).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export default function MeuPerfil() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de edição
  const [editando, setEditando] = useState(false);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [whatsappEmpresa, setWhatsappEmpresa] = useState("");
  const [cnpjEmpresa, setCnpjEmpresa] = useState("");
  const [enderecoEmpresa, setEnderecoEmpresa] = useState("");
  const [nomeCobranca, setNomeCobranca] = useState("");
  const [linkPagamento, setLinkPagamento] = useState("");

  // Estados PIX
  const [tipoPix, setTipoPix] = useState("cpf");
  const [chavePix, setChavePix] = useState("");

  // Estados senha
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  // Queries
  const { data: perfil, isLoading, refetch: refetchPerfil } = trpc.perfil.get.useQuery();

  useEffect(() => {
    if (perfil) {
      setNomeEmpresa(perfil.nomeEmpresa || "");
      setWhatsappEmpresa(perfil.whatsappEmpresa || "");
      setCnpjEmpresa(perfil.cnpjEmpresa || "");
      setEnderecoEmpresa(perfil.enderecoEmpresa || "");
      setNomeCobranca(perfil.nomeCobranca || "");
      setLinkPagamento(perfil.linkPagamento || "");
      setChavePix(perfil.pixKey || "");
      setTipoPix(perfil.tipoPix || "cpf");
    }
  }, [perfil]);

  // WhatsApp
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrTimer, setQrTimer] = useState(90);
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: whatsappStatus, refetch: refetchWpp } = trpc.whatsappEvolution.getStatus.useQuery(undefined, {
    refetchInterval: showQRModal ? 3000 : 10000,
  });
  const { data: qrData, refetch: refetchQR, isLoading: qrLoading } = trpc.whatsappEvolution.getQRCode.useQuery(undefined, {
    enabled: showQRModal && !whatsappStatus?.connected,
    refetchInterval: showQRModal && !whatsappStatus?.connected ? 20000 : false,
  });

  // Fechar modal automaticamente ao conectar
  useEffect(() => {
    if (whatsappStatus?.connected && showQRModal) {
      setShowQRModal(false);
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
      toast.success(t('toast_success.whatsapp_conectado_com_sucesso'));
    }
  }, [whatsappStatus?.connected, showQRModal]);

  // Timer de 90s para o QR Code
  useEffect(() => {
    if (showQRModal) {
      setQrTimer(90);
      qrTimerRef.current = setInterval(() => {
        setQrTimer(prev => {
          if (prev <= 1) {
            // Renovar QR Code automaticamente
            refetchQR();
            return 90;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    }
    return () => { if (qrTimerRef.current) clearInterval(qrTimerRef.current); };
  }, [showQRModal]);

  // Mutations
  const updatePerfil = trpc.perfil.update.useMutation({
    onSuccess: () => { toast.success(t('toast_success.perfil_atualizado')); setEditando(false); refetchPerfil(); },
    onError: (e) => toast.error(e.message),
  });

  const salvarPix = trpc.perfil.salvarPix.useMutation({
    onSuccess: () => { toast.success(t('toast_success.chave_pix_salva')); refetchPerfil(); },
    onError: (e) => toast.error(e.message),
  });

  const uploadLogo = trpc.perfil.uploadLogo.useMutation({
    onSuccess: () => { toast.success(t('toast_success.logo_enviada_com_sucesso')); refetchPerfil(); },
    onError: (e) => toast.error("Erro ao enviar logo: " + e.message),
  });

  const removerLogo = trpc.perfil.removerLogo.useMutation({
    onSuccess: () => { toast.success(t('toast_success.logo_removida')); refetchPerfil(); },
    onError: (e) => toast.error(e.message),
  });

  const alterarSenha = trpc.perfil.alterarSenha.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.senha_alterada_com_sucesso'));
      setNovaSenha("");
      setConfirmarSenha("");
    },
    onError: (e) => toast.error(e.message),
  });

  const connectWpp = trpc.whatsappEvolution.createInstance.useMutation({
    onSuccess: () => { setTimeout(() => { refetchQR(); refetchWpp(); }, 2000); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const handleAbrirQRModal = useCallback(() => {
    setShowQRModal(true);
    connectWpp.mutate();
    setTimeout(() => { refetchQR(); refetchWpp(); }, 2000);
  }, [connectWpp, refetchQR, refetchWpp]);

  const disconnectWpp = trpc.whatsappEvolution.disconnect.useMutation({
    onSuccess: () => { toast.success(t('toast_success.whatsapp_desconectado')); refetchWpp(); refetchQR(); },
    onError: (e) => toast.error(e.message),
  });

  // Handlers
  const handleSalvarPerfil = () => {
    updatePerfil.mutate({ nomeEmpresa, whatsappEmpresa, cnpjEmpresa, enderecoEmpresa, nomeCobranca, linkPagamento });
  };

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error(t('toast_error.arquivo_muito_grande_máximo_2mb')); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      uploadLogo.mutate({ base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleAlterarSenha = () => {
    if (novaSenha.length < 6) { toast.error(t('toast_error.a_senha_deve_ter_pelo_menos_6_caracteres')); return; }
    if (novaSenha !== confirmarSenha) { toast.error(t('toast_error.as_senhas_não_coincidem')); return; }
    alterarSenha.mutate({ novaSenha, confirmarSenha });
  };

  // Iniciais para avatar
  const iniciais = (perfil?.nomeEmpresa || user?.name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const pixNaoCadastrado = !perfil?.pixKey;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 md:pb-6">

      {/* Alerta PIX não configurado */}
      {pixNaoCadastrado && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-500">Sua chave PIX precisa ser atualizada.</p>
            <p className="text-xs text-yellow-500/70">Atualize agora para continuar enviando cobranças aos seus clientes.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={tipoPix} onValueChange={setTipoPix}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="aleatoria">Aleatória</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-8 text-xs flex-1 sm:w-48"
              placeholder="Digite sua chave PIX"
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
            />
            <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => salvarPix.mutate({ pixKey: chavePix, tipoPix })} disabled={salvarPix.isPending}>
              Salvar PIX
            </Button>
          </div>
        </div>
      )}

      {/* Header do perfil */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">Informações da sua conta</p>
        </div>
        {!editando ? (
          <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
            <Edit3 className="h-4 w-4 mr-2" />
            Editar Perfil
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditando(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSalvarPerfil} disabled={updatePerfil.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        )}
      </div>

      {/* Banner da empresa */}
      <Card className="overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-primary/80 to-primary" />
        <CardContent className="pt-0 pb-4">
          <div className="flex items-end gap-4 -mt-8">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold border-4 border-background shadow-lg shrink-0">
              {perfil?.logoUrl ? (
                <img src={perfil.logoUrl} alt="Logo" className="h-full w-full rounded-full object-cover" />
              ) : (
                iniciais
              )}
            </div>
            <div className="pb-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground truncate">{perfil?.nomeEmpresa || user?.name}</h2>
                <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 shrink-0">Ativo</Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{(perfil?.nomeEmpresa || "").toUpperCase()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Informações Pessoais + Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Informações Pessoais */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Não pode ser alterado</p>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                {editando ? (
                  <Input value={whatsappEmpresa} onChange={(e) => setWhatsappEmpresa(e.target.value)} className="h-7 text-sm mt-1" placeholder="(00) 00000-0000" />
                ) : (
                  <p className="text-sm font-medium text-foreground">{perfil?.whatsappEmpresa || "-"}</p>
                )}
              </div>
            </div>

            {/* Empresa */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Empresa</p>
                {editando ? (
                  <Input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} className="h-7 text-sm mt-1" placeholder="Nome da empresa" />
                ) : (
                  <p className="text-sm font-medium text-foreground">{perfil?.nomeEmpresa || "-"}</p>
                )}
              </div>
            </div>

            {/* Membro desde */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Membro desde</p>
                <p className="text-sm font-medium text-foreground">{formatarData(user?.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas da Conta */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Estatísticas da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de Clientes</p>
                <p className="text-xl font-bold text-foreground">{perfil?.totalClientes ?? 0}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Emprestado</p>
                <p className="text-xl font-bold text-foreground">{formatarMoeda(perfil?.totalEmprestado ?? 0)}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Recebido</p>
                <p className="text-xl font-bold text-foreground">{formatarMoeda(perfil?.totalRecebido ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assinatura */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-yellow-500" />
            Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
              <Crown className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plano Atual</p>
              <p className="text-base font-bold text-foreground">{perfil?.assinaturaPlano || "Mensal"}</p>
            </div>
          </div>

          {perfil?.assinaturaValidade && (
            <>
              <Separator />
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Válido até</p>
                  <p className="text-base font-bold text-foreground">{formatarData(perfil.assinaturaValidade)}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dias Restantes</p>
                  <p className={`text-base font-bold ${(perfil.diasRestantes ?? 0) <= 7 ? "text-orange-500" : "text-foreground"}`}>
                    {perfil.diasRestantes} dias
                  </p>
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full sm:w-auto border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10">
              <Crown className="h-4 w-4 mr-2" />
              Renovar Agora
            </Button>
            <p className="text-xs text-muted-foreground">Renove antecipadamente e os dias serão acumulados ao seu plano atual.</p>
          </div>
        </CardContent>
      </Card>

      {/* Chave PIX */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chave PIX para Cobranças</CardTitle>
          <CardDescription>Configure sua chave PIX. Ela será incluída automaticamente nas mensagens de cobrança com o valor exato da parcela.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className={`h-4 w-4 shrink-0 ${perfil?.pixKey ? "text-green-500" : "text-muted-foreground"}`} />
            <div>
              <p className="text-xs text-muted-foreground">Chave Cadastrada</p>
              <p className="text-sm font-medium">{perfil?.pixKey ? `${perfil.tipoPix?.toUpperCase()}: ${perfil.pixKey}` : "Nenhuma chave cadastrada"}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={tipoPix} onValueChange={setTipoPix}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="aleatoria">Aleatória</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="flex-1"
              placeholder="Digite sua chave PIX"
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
            />
            <Button onClick={() => salvarPix.mutate({ pixKey: chavePix, tipoPix })} disabled={salvarPix.isPending || !chavePix}>
              Salvar PIX
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Nome nas Cobranças */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nome nas Cobranças</CardTitle>
          <CardDescription>Este nome será exibido no final das mensagens de cobrança enviadas aos seus clientes via WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Nome Configurado</p>
              <p className="text-sm font-medium">Usando: {perfil?.nomeCobranca || perfil?.nomeEmpresa || "-"}</p>
            </div>
          </div>
          {editando && (
            <div className="space-y-2">
              <Label>Nome para cobranças</Label>
              <Input value={nomeCobranca} onChange={(e) => setNomeCobranca(e.target.value)} placeholder="Ex: Vital Financeira" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link de Pagamento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link className="h-4 w-4" />
            Link de Pagamento (Opcional)
          </CardTitle>
          <CardDescription>Configure um link de pagamento adicional (PagSeguro, Mercado Pago, etc). Será incluído nas mensagens junto com a chave PIX.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className={`h-4 w-4 shrink-0 ${perfil?.linkPagamento ? "text-green-500" : "text-muted-foreground"}`} />
            <div>
              <p className="text-xs text-muted-foreground">Link Cadastrado</p>
              <p className="text-sm font-medium truncate">{perfil?.linkPagamento || "Nenhum link cadastrado"}</p>
            </div>
          </div>
          {editando && (
            <div className="space-y-2">
              <Label>Link de pagamento</Label>
              <Input value={linkPagamento} onChange={(e) => setLinkPagamento(e.target.value)} placeholder="https://..." type="url" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logo da Empresa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Logo da Empresa</CardTitle>
          <CardDescription>Esta logo será usada nos PDFs de comprovantes e contratos. Recomendado: PNG transparente, até 2MB</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {perfil?.logoUrl && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <img src={perfil.logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded-md border border-border" />
              <div>
                <p className="text-sm font-medium">Logo atual</p>
                <p className="text-xs text-muted-foreground">Clique em "Enviar Logo" para substituir</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLogo.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadLogo.isPending ? "Enviando..." : "Enviar Logo"}
            </Button>
            {perfil?.logoUrl && (
              <Button
                variant="outline"
                onClick={() => removerLogo.mutate()}
                disabled={removerLogo.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp para Clientes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-green-500" />
              WhatsApp para Clientes
            </CardTitle>
            <Badge
              variant="outline"
              className={whatsappStatus?.connected
                ? "text-green-500 border-green-500/30 bg-green-500/10"
                : "text-red-500 border-red-500/30 bg-red-500/10"
              }
            >
              {whatsappStatus?.connected ? (
                <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
              ) : (
                <><WifiOff className="h-3 w-3 mr-1" /> Não Conectado</>
              )}
            </Badge>
          </div>
          <CardDescription>Envie mensagens diretamente aos seus clientes pelo seu WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          {whatsappStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
                <div>
                  <p className="font-medium text-green-500">WhatsApp Conectado!</p>
                  <p className="text-sm text-muted-foreground">Você pode enviar mensagens de cobrança diretamente aos seus clientes.</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                onClick={() => disconnectWpp.mutate()}
                disabled={disconnectWpp.isPending}
              >
                <WifiOff className="h-4 w-4 mr-2" />
                Desconectar WhatsApp
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Estado desconectado - ícone + texto + botão */}
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="h-16 w-16 flex items-center justify-center text-muted-foreground/30">
                  <QrCode className="h-full w-full" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">Conecte seu WhatsApp</p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Escaneie um QR Code para conectar seu WhatsApp e enviar mensagens diretamente aos seus clientes.
                  </p>
                </div>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                  onClick={handleAbrirQRModal}
                  disabled={connectWpp.isPending}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  {connectWpp.isPending ? "Aguardando..." : "Conectar WhatsApp"}
                </Button>
              </div>

              {/* Aguardando leitura */}
              {connectWpp.isPending && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-400">Aguardando leitura do QR Code...</p>
                    <p className="text-xs text-muted-foreground">Escaneie o QR Code no WhatsApp do seu celular para conectar.</p>
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="border-orange-500/30 text-orange-500 hover:bg-orange-500/10 w-full sm:w-auto"
                onClick={handleAbrirQRModal}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reiniciar e Gerar Novo QR
              </Button>

              <p className="text-xs text-muted-foreground">
                Com o WhatsApp conectado, você poderá enviar notificações de cobrança e comprovantes diretamente para os telefones dos seus clientes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal QR Code */}
      <Dialog open={showQRModal} onOpenChange={(open) => { if (!open) setShowQRModal(false); }}>
        <DialogContent className="max-w-sm bg-[#0d1117] border-[#1e2a1e] text-white p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-green-400" />
              <DialogTitle className="text-white text-base">Conectar WhatsApp</DialogTitle>
            </div>
            <p className="text-xs text-gray-400 mt-1">Conecte seu WhatsApp para enviar mensagens aos clientes</p>
          </DialogHeader>

          <div className="px-5 pb-2">
            {/* Timer */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-green-400">
                <div className="h-3 w-3 rounded-full border-2 border-green-400 border-t-transparent animate-spin" />
                <span className="text-sm font-medium">{qrTimer}s restantes</span>
              </div>
              <span className="text-xs text-gray-400">Escaneie com calma</span>
            </div>
            {/* Barra de progresso */}
            <div className="w-full h-1.5 bg-[#1e2a1e] rounded-full mb-4">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-1000"
                style={{ width: `${(qrTimer / 90) * 100}%` }}
              />
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              {qrLoading || connectWpp.isPending ? (
                <div className="h-52 w-52 flex flex-col items-center justify-center bg-white rounded-xl gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
                  <span className="text-xs text-gray-500">Gerando QR Code...</span>
                </div>
              ) : qrData?.qrcode ? (
                <div className="p-3 bg-white rounded-xl shadow-lg">
                  <img src={qrData.qrcode} alt="QR Code WhatsApp" className="h-48 w-48 object-contain" />
                </div>
              ) : (
                <div className="h-52 w-52 flex flex-col items-center justify-center bg-white rounded-xl gap-3">
                  <QrCode className="h-16 w-16 text-gray-300" />
                  <span className="text-xs text-gray-400">Aguardando QR Code...</span>
                </div>
              )}
            </div>

            {/* Aviso */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 mb-4">
              <AlertCircle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-300">
                <strong>Importante:</strong> Se você tiver outras sessões do WhatsApp Web ativas, feche-as primeiro para evitar desconexões.
              </p>
            </div>

            {/* Instruções */}
            <div className="space-y-2 mb-4">
              {[
                { icon: Smartphone, step: "1. Abra o WhatsApp", sub: "No seu celular" },
                { icon: Link, step: "2. Aparelhos conectados", sub: "Menu ⋮ → Aparelhos conectados" },
                { icon: QrCode, step: "3. Conectar com número de telefone", sub: 'Toque em "Conectar um aparelho" e depois em "Conectar com número de telefone"' },
              ].map(({ icon: Icon, step, sub }) => (
                <div key={step} className="flex items-start gap-3 p-2.5 rounded-lg bg-[#1a2420]">
                  <div className="h-7 w-7 rounded-md bg-green-500/20 flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{step}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Botão aguardando / atualizar */}
            <Button
              className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30"
              variant="outline"
              onClick={() => { refetchQR(); setQrTimer(90); }}
              disabled={qrLoading}
            >
              {qrLoading ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400 mr-2" /> Aguardando conexão...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Atualizar QR Code</>
              )}
            </Button>
          </div>

          <div className="px-5 pb-5 pt-1">
            <Button
              variant="ghost"
              className="w-full text-gray-500 hover:text-gray-300 text-xs"
              onClick={() => setShowQRModal(false)}
            >
              <X className="h-3 w-3 mr-1" /> Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alterar Senha */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Alterar Senha
          </CardTitle>
          <CardDescription>Digite uma nova senha para sua conta. A senha deve ter pelo menos 6 caracteres.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="novaSenha">Nova Senha</Label>
            <div className="relative">
              <Input
                id="novaSenha"
                type={mostrarNovaSenha ? "text" : "password"}
                placeholder="Digite a nova senha"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
              >
                {mostrarNovaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
            <div className="relative">
              <Input
                id="confirmarSenha"
                type={mostrarConfirmarSenha ? "text" : "password"}
                placeholder="Confirme a nova senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
              >
                {mostrarConfirmarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button
            onClick={handleAlterarSenha}
            disabled={alterarSenha.isPending || !novaSenha || !confirmarSenha}
            className="w-full sm:w-auto"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            {alterarSenha.isPending ? "Alterando..." : t('profile.changePassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
