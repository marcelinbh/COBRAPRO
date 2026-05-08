'use client';
import { useTranslation } from 'react-i18next';
import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Search, User, Star, Trash2, Eye, Camera, MapPin, FileText,
  AlertCircle, Upload, Download, X, File, Image as ImageIcon, Pencil
} from "lucide-react";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getInitials(nome: string) {
  return nome.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}
const AVATAR_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-500",
  "bg-teal-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500",
  "bg-pink-500", "bg-rose-500",
];
function getAvatarColor(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── MÁSCARAS ─────────────────────────────────────────────────────────────────
function maskCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskCNPJ(v: string) {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
function maskRG(v: string) {
  return v.replace(/\D/g, "").slice(0, 9)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1})$/, "$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}
function maskCEP(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{0,3})/, "$1-$2");
}// ─── SCORE BADGE ──────────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const { t } = useTranslation();
  let color = "text-green-500 bg-green-500/15 border-green-500/30";
  let label = t('common.excellent');
  if (score < 300) { color = "text-red-500 bg-red-500/15 border-red-500/30"; label = t('common.poor'); }
  else if (score < 500) { color = "text-yellow-500 bg-yellow-500/15 border-yellow-500/30"; label = t('common.regular'); }
  else if (score < 700) { color = "text-foreground bg-muted border-border"; label = t('common.good'); }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      <Star className="h-3 w-3" />{score}
    </span>
  );
}

function StatusBadge({ status }: { status: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${status ? "bg-green-500/15 text-green-500 border-green-500/30" : "bg-gray-500/15 text-gray-500 border-gray-500/30"}`}>
      {status ? `✓ ${t('common.active')}` : t('common.inactiveStatus')}
    </span>
  );
}// ─── UPLOAD HELPER ────────────────────────────────────────────────────────────
async function uploadFile(file: File, folder = "clientes"): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, contentType: file.type, filename: file.name, folder }),
      });
      if (!res.ok) { reject(new Error("Upload falhou")); return; }
      const { url } = await res.json();
      resolve(url);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── TIPOS ────────────────────────────────────────────────────────────────────
interface DocumentoSalvo {
  url: string;
  nome: string;
  tamanho?: number;
  data?: string;
  descricao?: string;
}

// ─── MODAL NOVO/EDITAR CLIENTE ────────────────────────────────────────────────
interface NovoClienteModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clienteEditar?: any;
}

function NovoClienteModal({ open, onClose, onSuccess, clienteEditar }: NovoClienteModalProps) {
  const isEdit = !!clienteEditar;
  const [aba, setAba] = useState<"dados" | "endereco" | "documentos">("dados");

  // Dados Pessoais
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [rg, setRg] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [profissao, setProfissao] = useState("");
  const [tipoCliente, setTipoCliente] = useState("emprestimo");
  const [isReferral, setIsReferral] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [observacoes, setObservacoes] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [fotoPreview, setFotoPreview] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Endereço
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Documentos
  const [docDescricao, setDocDescricao] = useState("");
  const [documentos, setDocumentos] = useState<DocumentoSalvo[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const createMutation = trpc.clientes.create.useMutation({
    onSuccess: () => {
      toast.success(isEdit ? "Cliente atualizado!" : "Cliente criado com sucesso!");
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const updateMutation = trpc.clientes.update.useMutation({
    onSuccess: () => {
      toast.success("Cliente atualizado!");
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  // Popular campos ao editar
  useEffect(() => {
    if (clienteEditar) {
      setNome(clienteEditar.nome || "");
      setCpf(clienteEditar.cpfCnpj || "");
      setCnpj(clienteEditar.cnpj || "");
      setRg(clienteEditar.rg || "");
      setEmail(clienteEditar.email || "");
      setTelefone(clienteEditar.telefone || "");
      setInstagram(clienteEditar.instagram || "");
      setFacebook(clienteEditar.facebook || "");
      setProfissao(clienteEditar.profissao || "");
      setTipoCliente(clienteEditar.tipoCliente || "emprestimo");
      setIsReferral(clienteEditar.isReferral || false);
      setAtivo(clienteEditar.ativo !== false);
      setObservacoes(clienteEditar.observacoes || "");
      setFotoUrl(clienteEditar.fotoUrl || "");
      setFotoPreview(clienteEditar.fotoUrl || "");
      setCep(clienteEditar.cep || "");
      setEndereco(clienteEditar.endereco || "");
      setNumero(clienteEditar.numero || "");
      setComplemento(clienteEditar.complemento || "");
      setBairro(clienteEditar.bairro || "");
      setCidade(clienteEditar.cidade || "");
      setEstado(clienteEditar.estado || "");
      // Documentos
      try {
        const docs = JSON.parse(clienteEditar.documentosUrls || "[]");
        setDocumentos(Array.isArray(docs) ? docs : []);
      } catch { setDocumentos([]); }
    } else {
      // Reset
      setNome(""); setCpf(""); setCnpj(""); setRg(""); setEmail(""); setTelefone("");
      setInstagram(""); setFacebook(""); setProfissao(""); setTipoCliente("emprestimo");
      setIsReferral(false); setAtivo(true); setObservacoes(""); setFotoUrl(""); setFotoPreview("");
      setCep(""); setEndereco(""); setNumero(""); setComplemento(""); setBairro(""); setCidade(""); setEstado("");
      setDocumentos([]);
    }
    setAba("dados");
  }, [clienteEditar, open]);

  // Busca CEP automática
  const buscarCep = async (cepVal: string) => {
    const cepLimpo = cepVal.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setEndereco(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setEstado(data.uf || "");
      }
    } catch {}
    setBuscandoCep(false);
  };

  // Upload de foto
  const handleFotoChange = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    setUploadingFoto(true);
    try {
      const preview = URL.createObjectURL(file);
      setFotoPreview(preview);
      const url = await uploadFile(file, "clientes/fotos");
      setFotoUrl(url);
      toast.success("Foto carregada!");
    } catch { toast.error("Erro ao fazer upload da foto"); }
    setUploadingFoto(false);
  };

  // Upload de documentos
  const handleDocumentoUpload = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    setUploadingDoc(true);
    try {
      const novos: DocumentoSalvo[] = [];
      for (const file of fileArr) {
        const url = await uploadFile(file, "clientes/documentos");
        novos.push({
          url,
          nome: file.name,
          tamanho: file.size,
          data: new Date().toLocaleDateString("pt-BR"),
          descricao: docDescricao || undefined,
        });
      }
      setDocumentos(prev => [...prev, ...novos]);
      setDocDescricao("");
      toast.success(`${novos.length} documento(s) enviado(s)!`);
    } catch { toast.error("Erro ao fazer upload dos documentos"); }
    setUploadingDoc(false);
  };

  const removerDocumento = (idx: number) => {
    setDocumentos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) handleDocumentoUpload(e.dataTransfer.files);
  };

  const handleSalvar = () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); setAba("dados"); return; }
    const payload = {
      nome,
      cpfCnpj: cpf || undefined,
      cnpj: cnpj || undefined,
      rg: rg || undefined,
      email: email || undefined,
      telefone: telefone || undefined,
      instagram: instagram || undefined,
      facebook: facebook || undefined,
      profissao: profissao || undefined,
      tipoCliente,
      isReferral,
      observacoes: observacoes || undefined,
      fotoUrl: fotoUrl || undefined,
      documentosUrls: documentos.length > 0 ? JSON.stringify(documentos) : undefined,
      cep: cep || undefined,
      endereco: endereco || undefined,
      numero: numero || undefined,
      complemento: complemento || undefined,
      bairro: bairro || undefined,
      cidade: cidade || undefined,
      estado: estado || undefined,
    };
    if (isEdit) {
      updateMutation.mutate({ id: clienteEditar.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (nome: string) => {
    const ext = nome.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return <ImageIcon className="h-5 w-5 text-blue-400" />;
    return <File className="h-5 w-5 text-orange-400" />;
  };

  const initials = nome ? getInitials(nome) : "CL";
  const avatarColor = nome ? getAvatarColor(nome) : "bg-green-500";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{isEdit ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>

        {/* Abas */}
        <div className="flex border-b border-border mx-6 mt-4">
          {(["dados", "endereco", "documentos"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${aba === a ? "border-green-500 text-green-500" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {a === "dados" && <User className="h-3.5 w-3.5" />}
              {a === "endereco" && <MapPin className="h-3.5 w-3.5" />}
              {a === "documentos" && <FileText className="h-3.5 w-3.5" />}
              {a === "dados" ? "Dados Pessoais" : a === "endereco" ? "Endereço" : "Documentos"}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ─── ABA DADOS PESSOAIS ─── */}
          {aba === "dados" && (
            <>
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Avatar" className="h-20 w-20 rounded-full object-cover border-2 border-border" />
                  ) : (
                    <div className={`h-20 w-20 rounded-full ${avatarColor} flex items-center justify-center`}>
                      <span className="text-white font-bold text-2xl">{initials}</span>
                    </div>
                  )}
                  {uploadingFoto && (
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Avatar gerado automaticamente</p>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => fotoInputRef.current?.click()} disabled={uploadingFoto}>
                  <Camera className="h-3.5 w-3.5" />
                  {fotoUrl ? "Trocar foto" : "Adicionar foto"}
                </Button>
                <p className="text-xs text-muted-foreground">A foto será enviada ao salvar o cliente</p>
                <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFotoChange(e.target.files[0])} />
              </div>

              {/* Nome */}
              <div>
                <Label>Nome Completo *</Label>
                <Input placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} className="mt-1" />
              </div>

              {/* CPF / CNPJ / RG */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">CPF</Label>
                  <Input placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(maskCPF(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">CNPJ</Label>
                  <Input placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(maskCNPJ(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">RG</Label>
                  <Input placeholder="00.000.000-0" value={rg} onChange={e => setRg(maskRG(e.target.value))} className="mt-1" />
                </div>
              </div>

              {/* Email / Telefone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input placeholder="cliente@email.com" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Telefone (com DDD)</Label>
                  <Input placeholder="(00) 00000-0000" value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-0.5">Inclua o DDD para envio via WhatsApp</p>
                </div>
              </div>

              {/* Instagram / Facebook */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Instagram</Label>
                  <Input placeholder="@usuario" value={instagram} onChange={e => setInstagram(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Facebook</Label>
                  <Input placeholder="Nome ou URL do perfil" value={facebook} onChange={e => setFacebook(e.target.value)} className="mt-1" />
                </div>
              </div>

              {/* Profissão */}
              <div>
                <Label className="text-xs">Profissão</Label>
                <Input placeholder="Ex: Eletricista, Comerciante, Motorista..." value={profissao} onChange={e => setProfissao(e.target.value)} className="mt-1" />
              </div>

              {/* Tipo de Cliente */}
              <div>
                <Label className="text-xs">Tipo de Cliente</Label>
                <Select value={tipoCliente} onValueChange={setTipoCliente}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emprestimo">Empréstimo</SelectItem>
                    <SelectItem value="mensalidade">Mensalidade</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="veiculo">Veículo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Switches */}
              <div className="flex items-center justify-between py-2 border-t border-border">
                <div>
                  <p className="text-sm font-medium">Cliente veio por indicação</p>
                  <p className="text-xs text-muted-foreground">Marque se este cliente foi indicado por outro</p>
                </div>
                <Switch checked={isReferral} onCheckedChange={setIsReferral} />
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border">
                <div>
                  <p className="text-sm font-medium">Cliente ativo</p>
                  <p className="text-xs text-muted-foreground">Clientes inativos não aparecem nas cobranças</p>
                </div>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>

              {/* Observações */}
              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea placeholder="Notas sobre o cliente..." value={observacoes} onChange={e => setObservacoes(e.target.value)} className="mt-1 resize-none" rows={3} />
              </div>
            </>
          )}

          {/* ─── ABA ENDEREÇO ─── */}
          {aba === "endereco" && (
            <>
              <div>
                <Label className="text-xs">CEP</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="00000-000"
                    value={cep}
                    onChange={e => {
                      const v = maskCEP(e.target.value);
                      setCep(v);
                      if (v.replace(/\D/g, "").length === 8) buscarCep(v);
                    }}
                    className="flex-1"
                  />
                  {buscandoCep && <div className="flex items-center px-3 text-muted-foreground text-sm">Buscando...</div>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Rua / Logradouro</Label>
                  <Input placeholder="Rua, Av., etc." value={endereco} onChange={e => setEndereco(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Número</Label>
                  <Input placeholder="Nº" value={numero} onChange={e => setNumero(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Complemento</Label>
                <Input placeholder="Apto, Bloco, Casa..." value={complemento} onChange={e => setComplemento(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Bairro</Label>
                  <Input placeholder="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Cidade</Label>
                  <Input placeholder="Cidade" value={cidade} onChange={e => setCidade(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Estado</Label>
                  <Input placeholder="UF" maxLength={2} value={estado} onChange={e => setEstado(e.target.value.toUpperCase())} className="mt-1" />
                </div>
              </div>
            </>
          )}

          {/* ─── ABA DOCUMENTOS ─── */}
          {aba === "documentos" && (
            <>
              <div>
                <Label className="text-xs">Descrição do Documento (opcional)</Label>
                <Input
                  placeholder="Ex: RG, CPF, Comprovante de residência..."
                  value={docDescricao}
                  onChange={e => setDocDescricao(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Área de upload */}
              <div
                className={`border-2 border-dashed rounded-lg transition-colors ${dragging ? "border-green-500 bg-green-500/5" : "border-border"}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <Button
                  variant="outline"
                  className="w-full gap-2 border-0 py-6"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingDoc}
                >
                  {uploadingDoc ? (
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploadingDoc ? "Enviando..." : "Selecionar Arquivos"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={e => e.target.files && handleDocumentoUpload(e.target.files)}
                />
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Aceita: imagens, PDF, Word, Excel. Você pode selecionar múltiplos arquivos.
              </p>
              <div className="border border-dashed border-border rounded-lg p-3 text-xs text-muted-foreground text-center">
                Dica (PC): você também pode arrastar e soltar arquivos aqui dentro para anexar.
              </div>

              {/* Documentos salvos */}
              {documentos.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Documentos Salvos ({documentos.length})</p>
                  <div className="space-y-2">
                    {documentos.map((doc, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                        {getFileIcon(doc.nome)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.tamanho ? formatFileSize(doc.tamanho) : ""}
                            {doc.tamanho && doc.data ? " • " : ""}
                            {doc.data || ""}
                            {doc.descricao ? ` • ${doc.descricao}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => removerDocumento(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          {aba !== "dados" ? (
            <Button variant="outline" onClick={() => setAba(aba === "documentos" ? "endereco" : "dados")}>
              ← Voltar
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          )}
          {aba !== "documentos" ? (
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => setAba(aba === "dados" ? "endereco" : "documentos")}>
              Próximo →
            </Button>
          ) : (
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleSalvar} disabled={isPending}>
              {isPending ? "Salvando..." : "Concluir"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function Clientes() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroIndicado, setFiltroIndicado] = useState("todos");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importResultado, setImportResultado] = useState<{ ok: number; erros: number; mensagens: string[] } | null>(null);
  const [deleteClienteId, setDeleteClienteId] = useState<number | null>(null);
  const [deleteClienteNome, setDeleteClienteNome] = useState("");
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [clienteEditar, setClienteEditar] = useState<any>(null);

  const { data: clientesData, isLoading } = trpc.clientes.list.useQuery();
  const clientes = Array.isArray(clientesData) ? clientesData : (clientesData as any)?.clientes ?? [];
  const utils = trpc.useUtils();

  const createClienteMutation = trpc.clientes.create.useMutation({
    onError: (e) => toast.error("Erro ao criar cliente: " + e.message),
  });

  const deleteClienteMutation = trpc.clientes.deletar.useMutation({
    onSuccess: () => {
      toast.success("Cliente deletado com sucesso!");
      setDeleteClienteId(null);
      utils.clientes.list.invalidate();
    },
    onError: (e) => toast.error("Erro ao deletar: " + e.message),
  });

  const filteredClientes = (clientes as any[]).filter((c: any) => {
    const buscaOk = c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      c.cpfCnpj?.includes(busca) ||
      c.telefone?.includes(busca);
    const tipoOk = filtroTipo === "todos" || c.tipoCliente === filtroTipo;
    const indicadoOk = filtroIndicado === "todos" ||
      (filtroIndicado === "sim" && c.isReferral) ||
      (filtroIndicado === "nao" && !c.isReferral);
    return buscaOk && tipoOk && indicadoOk;
  });

  function exportarCSV() {
    const headers = ['Nome', 'CPF/CNPJ', 'RG', 'Telefone', 'E-mail', 'Instagram', 'Facebook', 'Profissão', 'Tipo', 'Indicado', 'CEP', 'Endereço', 'Número', 'Complemento', 'Bairro', 'Cidade', 'Estado', 'Score', 'Cadastrado em'];
    const rows = filteredClientes.map((c: any) => [
      c.nome ?? '',
      c.cpfCnpj ?? '',
      c.rg ?? '',
      c.telefone ?? '',
      c.email ?? '',
      c.instagram ?? '',
      c.facebook ?? '',
      c.profissao ?? '',
      c.tipoCliente ?? '',
      c.isReferral ? 'Sim' : 'Não',
      c.cep ?? '',
      c.endereco ?? '',
      c.numero ?? '',
      c.complemento ?? '',
      c.bairro ?? '',
      c.cidade ?? '',
      c.estado ?? '',
      String(c.score ?? 0),
      c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '',
    ]);
    const csvContent = [headers, ...rows].map(row =>
      row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredClientes.length} clientes exportados!`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportarCSV}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowImportModal(true)}>
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => { setClienteEditar(null); setShowNovoModal(true); }}>
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar clientes por nome, CPF ou telefone..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo de cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="emprestimo">Empréstimo</SelectItem>
            <SelectItem value="mensalidade">Mensalidade</SelectItem>
            <SelectItem value="ambos">Ambos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroIndicado} onValueChange={setFiltroIndicado}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Indicação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="sim">Indicados</SelectItem>
            <SelectItem value="nao">Não indicados</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
          {filteredClientes.length} clientes
        </div>
      </div>

      {/* Tabela */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">Score</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">Cadastrado em</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-muted-foreground">Carregando clientes...</td>
                </tr>
              )}
              {!isLoading && filteredClientes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                    <Button className="mt-4 gap-2 bg-green-600 hover:bg-green-700" onClick={() => { setClienteEditar(null); setShowNovoModal(true); }}>
                      <Plus className="h-4 w-4" /> Cadastrar primeiro cliente
                    </Button>
                  </td>
                </tr>
              )}
              {filteredClientes.map((cliente: any) => (
                <tr
                  key={cliente.id}
                  className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/clientes/${cliente.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {cliente.fotoUrl ? (
                        <img src={cliente.fotoUrl} alt={cliente.nome} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className={`h-8 w-8 rounded-full ${getAvatarColor(cliente.nome)} flex items-center justify-center`}>
                          <span className="text-white font-semibold text-xs">{getInitials(cliente.nome)}</span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-foreground">{cliente.nome}</div>
                        {cliente.cpfCnpj && <div className="text-xs text-muted-foreground">{cliente.cpfCnpj}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">{cliente.telefone || "—"}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-blue-500/30 bg-blue-500/15 text-blue-500">
                      {cliente.tipoCliente || cliente.profissao || "Empréstimo"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={cliente.ativo !== false} />
                  </td>
                  <td className="px-6 py-4">
                    <ScoreBadge score={cliente.score ?? 700} />
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {cliente.createdAt ? new Date(cliente.createdAt).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-500/10" onClick={() => { setClienteEditar(cliente); setShowNovoModal(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setLocation(`/clientes/${cliente.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => { setDeleteClienteId(cliente.id); setDeleteClienteNome(cliente.nome); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo/Editar Cliente */}
      <NovoClienteModal
        open={showNovoModal}
        onClose={() => setShowNovoModal(false)}
        onSuccess={() => utils.clientes.list.invalidate()}
        clienteEditar={clienteEditar}
      />

      {/* Modal de confirmação de exclusão */}
      <Dialog open={deleteClienteId !== null} onOpenChange={(open) => !open && setDeleteClienteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Deletar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Tem certeza que deseja deletar este cliente?</p>
                <p className="text-sm text-muted-foreground mt-1">Cliente: <strong>{deleteClienteNome}</strong></p>
                <p className="text-sm text-muted-foreground mt-2">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteClienteId(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => deleteClienteMutation.mutate({ id: deleteClienteId! })}
                disabled={deleteClienteMutation.isPending}
              >
                {deleteClienteMutation.isPending ? "Deletando..." : "Deletar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Importação CSV */}
      <Dialog open={showImportModal} onOpenChange={(open) => { if (!open) { setShowImportModal(false); setImportResultado(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Clientes via CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!importResultado ? (
              <>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Formato esperado do CSV:</p>
                  <p>Colunas (1ª linha = cabeçalho):</p>
                  <code className="block bg-background p-2 rounded text-[10px] font-mono overflow-x-auto">
                    nome,telefone,cpfCnpj,email,profissao,tipoCliente
                  </code>
                  <p>• Apenas <strong>nome</strong> é obrigatório</p>
                  <p>• tipoCliente: emprestimo, mensalidade ou ambos</p>
                  <p>• Separador: vírgula ou ponto-e-vírgula</p>
                </div>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => document.getElementById('csv-import-input')?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={async e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) processarCSV(file);
                  }}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Clique ou arraste o arquivo CSV aqui</p>
                  <p className="text-xs text-muted-foreground mt-1">Aceita .csv e .txt</p>
                  <input
                    id="csv-import-input"
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) processarCSV(f); }}
                  />
                </div>
                {importando && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span className="text-sm">Importando clientes...</span>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
                  <div className="text-center flex-1">
                    <div className="text-2xl font-bold text-success">{importResultado.ok}</div>
                    <div className="text-xs text-muted-foreground">importados com sucesso</div>
                  </div>
                  {importResultado.erros > 0 && (
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-destructive">{importResultado.erros}</div>
                      <div className="text-xs text-muted-foreground">erros</div>
                    </div>
                  )}
                </div>
                {importResultado.mensagens.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importResultado.mensagens.map((m, i) => (
                      <div key={i} className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">{m}</div>
                    ))}
                  </div>
                )}
                <Button className="w-full" onClick={() => { setShowImportModal(false); setImportResultado(null); utils.clientes.list.invalidate(); }}>
                  Fechar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  async function processarCSV(file: File) {
    setImportando(true);
    try {
      const text = await file.text();
      const linhas = text.split(/\r?\n/).filter(l => l.trim());
      if (linhas.length < 2) { toast.error('CSV vazio ou sem dados'); setImportando(false); return; }
      const sep = linhas[0].includes(';') ? ';' : ',';
      const headers = linhas[0].split(sep).map(h => h.trim().toLowerCase().replace(/["']/g, ''));
      const idxNome = headers.findIndex(h => h.includes('nome'));
      const idxTel = headers.findIndex(h => h.includes('telefone') || h.includes('fone') || h.includes('celular'));
      const idxCpf = headers.findIndex(h => h.includes('cpf') || h.includes('cnpj'));
      const idxEmail = headers.findIndex(h => h.includes('email') || h.includes('e-mail'));
      const idxProf = headers.findIndex(h => h.includes('profissao') || h.includes('profissão'));
      const idxTipo = headers.findIndex(h => h.includes('tipo'));
      if (idxNome === -1) { toast.error('Coluna "nome" não encontrada'); setImportando(false); return; }
      let ok = 0; let erros = 0; const mensagens: string[] = [];
      for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
        const nome = idxNome >= 0 ? cols[idxNome] : '';
        if (!nome) { erros++; mensagens.push(`Linha ${i + 1}: nome vazio`); continue; }
        try {
          await createClienteMutation.mutateAsync({
            nome,
            telefone: idxTel >= 0 ? cols[idxTel] : undefined,
            cpfCnpj: idxCpf >= 0 ? cols[idxCpf] : undefined,
            email: idxEmail >= 0 ? cols[idxEmail] : undefined,
            profissao: idxProf >= 0 ? cols[idxProf] : undefined,
            tipoCliente: idxTipo >= 0 && ['emprestimo','mensalidade','ambos'].includes(cols[idxTipo]) ? cols[idxTipo] as any : 'emprestimo',
          });
          ok++;
        } catch (e: any) {
          erros++;
          mensagens.push(`Linha ${i + 1} (${nome}): ${e.message}`);
        }
      }
      setImportResultado({ ok, erros, mensagens });
    } catch (e: any) {
      toast.error('Erro ao processar CSV: ' + e.message);
    } finally {
      setImportando(false);
    }
  }
}
