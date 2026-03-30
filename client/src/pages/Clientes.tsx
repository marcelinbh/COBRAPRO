import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Search, User, Phone, CreditCard, ChevronRight, Star, Upload, Download,
  AlertCircle, CheckCircle2, Camera, FileText, X, MapPin, Instagram, Facebook
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

async function uploadFile(file: File, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = (e.target?.result as string).split(",")[1];
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64,
            contentType: file.type,
            filename: file.name,
            folder,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro no upload");
        resolve(data.url);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}

// ─── TIPOS DE DOCUMENTO ───────────────────────────────────────────────────────
const TIPOS_DOCUMENTO = [
  { key: "rg_frente", label: "RG (Frente)" },
  { key: "rg_verso", label: "RG (Verso)" },
  { key: "cpf", label: "CPF" },
  { key: "comprovante_residencia", label: "Comprovante de Residência" },
  { key: "contrato", label: "Contrato Assinado" },
  { key: "outro", label: "Outro Documento" },
];

// ─── IMPORTAR BASE DE DADOS (CSV) ─────────────────────────────────────────────
function ImportarCSVDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [resultado, setResultado] = useState<{ importados: number; erros: number; detalhesErros: string[] } | null>(null);

  const importMutation = trpc.clientes.importarCSV.useMutation({
    onSuccess: (data) => { setResultado(data); if (data.importados > 0) onSuccess(); },
    onError: (e) => toast.error("Erro na importação: " + e.message),
  });

  const parseCSV = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const raw = lines[0].split(/[;,]/).map(h =>
      h.trim().toLowerCase().replace(/["']/g, '').replace(/\s+/g, '')
        .replace('nomecompleto', 'nome').replace('cpf/cnpj', 'cpfcnpj')
        .replace('cpfoucnpj', 'cpfcnpj').replace('cpf', 'cpfcnpj')
    );
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const values = line.split(/[;,]/).map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      raw.forEach((h, i) => { obj[h] = values[i] ?? ''; });
      return obj;
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setResultado(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target?.result as string);
      setAllRows(rows); setPreview(rows.slice(0, 5));
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = () => {
    if (allRows.length === 0) return;
    const registros = allRows.map(r => ({
      nome: (r.nome || r.name || '').toString().trim(),
      cpfCnpj: (r.cpfcnpj || r.cpf || r.cnpj || '').toString().trim(),
      telefone: (r.telefone || r.fone || '').toString().trim(),
      whatsapp: (r.whatsapp || r.zap || r.telefone || '').toString().trim(),
      email: (r.email || '').toString().trim(),
      chavePix: (r.chavepix || r.pix || '').toString().trim(),
      endereco: (r.endereco || r.address || '').toString().trim(),
      cidade: (r.cidade || r.city || '').toString().trim(),
      estado: (r.estado || r.state || '').toString().trim(),
      observacoes: (r.observacoes || r.obs || '').toString().trim(),
    })).filter(r => r.nome.length >= 2);
    importMutation.mutate({ registros });
  };

  const downloadTemplate = () => {
    const csv = 'nome;cpfCnpj;telefone;whatsapp;email;chavePix;endereco;cidade;estado;observacoes\nJoão Silva;123.456.789-00;(11) 99999-0001;(11) 99999-0001;joao@email.com;123.456.789-00;Rua das Flores 100;São Paulo;SP;Cliente VIP';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modelo_importacao_cobrapro.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setPreview([]); setAllRows([]); setFileName(''); setResultado(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-dashed">
          <Upload className="h-4 w-4" />Importar Base de Dados
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">IMPORTAR BASE DE DADOS</DialogTitle>
        </DialogHeader>
        {resultado ? (
          <div className="space-y-4 py-4">
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${resultado.erros === 0 ? 'bg-success/10 border-success/30' : 'bg-warning/10 border-warning/30'}`}>
              {resultado.erros === 0 ? <CheckCircle2 className="h-6 w-6 text-success shrink-0" /> : <AlertCircle className="h-6 w-6 text-warning shrink-0" />}
              <div>
                <p className="font-semibold">{resultado.importados} clientes importados com sucesso</p>
                {resultado.erros > 0 && <p className="text-sm text-muted-foreground">{resultado.erros} registros com erro</p>}
              </div>
            </div>
            {resultado.detalhesErros.length > 0 && (
              <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                {resultado.detalhesErros.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <Button className="w-full" onClick={() => setOpen(false)}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="bg-muted/30 border border-dashed rounded-xl p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Formato aceito: CSV (separado por ; ou ,)</p>
              <p>Colunas: <span className="text-primary font-medium">nome</span> (obrigatório), cpfCnpj, telefone, whatsapp, email, chavePix, endereco, cidade, estado, observacoes</p>
            </div>
            <label htmlFor="csv-upload" className="block cursor-pointer">
              <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 text-center transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium">{fileName || 'Clique para selecionar o arquivo CSV'}</p>
                <p className="text-xs text-muted-foreground mt-1">.csv ou .txt</p>
              </div>
              <input id="csv-upload" type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            </label>
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />Baixar modelo de planilha (.csv)
            </Button>
            {preview.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Prévia — {allRows.length} registros detectados:</p>
                <div className="bg-muted/30 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border">{Object.keys(preview[0]).slice(0, 5).map(k => <th key={k} className="p-2 text-left text-muted-foreground capitalize">{k}</th>)}</tr></thead>
                    <tbody>{preview.map((row, i) => <tr key={i} className="border-b border-border/50">{Object.values(row).slice(0, 5).map((v: any, j) => <td key={j} className="p-2 truncate max-w-[120px]">{v}</td>)}</tr>)}</tbody>
                  </table>
                  {allRows.length > 5 && <p className="text-xs text-muted-foreground p-2">... e mais {allRows.length - 5} registros</p>}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1 gap-2" disabled={allRows.length === 0 || importMutation.isPending} onClick={handleImport}>
                {importMutation.isPending ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importando...</> : <><Upload className="h-4 w-4" />Importar {allRows.length > 0 ? `${allRows.length} registros` : ''}</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── SCORE BADGE ──────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  let color = "text-success bg-success/15 border-success/30";
  let label = "Excelente";
  if (score < 300) { color = "text-primary bg-primary/15 border-primary/30"; label = "Ruim"; }
  else if (score < 500) { color = "text-warning bg-warning/15 border-warning/30"; label = "Regular"; }
  else if (score < 700) { color = "text-foreground bg-muted border-border"; label = "Bom"; }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      <Star className="h-3 w-3" />{score} · {label}
    </span>
  );
}

// ─── FORMULÁRIO NOVO CLIENTE ──────────────────────────────────────────────────
type FormData = {
  // Dados pessoais
  nome: string; cpfCnpj: string; cnpj: string; rg: string;
  email: string; telefone: string; whatsapp: string;
  instagram: string; facebook: string; profissao: string;
  dataNascimento: string; sexo: string; estadoCivil: string;
  nomeMae: string; nomePai: string;
  // Endereço
  cep: string; endereco: string; numero: string; complemento: string;
  bairro: string; cidade: string; estado: string;
  // Dados bancários / PIX
  chavePix: string; tipoChavePix: string;
  banco: string; agencia: string; numeroConta: string;
  // Observações
  observacoes: string;
  // Mídia
  fotoUrl: string;
  documentosUrls: string;
};

const emptyForm: FormData = {
  nome: "", cpfCnpj: "", cnpj: "", rg: "",
  email: "", telefone: "", whatsapp: "",
  instagram: "", facebook: "", profissao: "",
  dataNascimento: "", sexo: "", estadoCivil: "",
  nomeMae: "", nomePai: "",
  cep: "", endereco: "", numero: "", complemento: "",
  bairro: "", cidade: "", estado: "",
  chavePix: "", tipoChavePix: "cpf",
  banco: "", agencia: "", numeroConta: "",
  observacoes: "",
  fotoUrl: "",
  documentosUrls: "",
};

function NovoClienteDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<"pessoal" | "endereco" | "documentos">("pessoal");
  const [form, setForm] = useState<FormData>(emptyForm);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [documentos, setDocumentos] = useState<{ tipo: string; url: string; nome: string }[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [tipoDocSelecionado, setTipoDocSelecionado] = useState("rg_frente");

  const set = useCallback((field: keyof FormData, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
  }, []);

  const createMutation = trpc.clientes.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso!");
      setOpen(false);
      setForm(emptyForm);
      setFotoPreview(null);
      setDocumentos([]);
      setAba("pessoal");
      onSuccess();
    },
    onError: (e) => toast.error("Erro ao cadastrar: " + e.message),
  });

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Foto muito grande (máx. 5MB)"); return; }
    setUploadingFoto(true);
    try {
      const url = await uploadFile(file, "clientes/fotos");
      setFotoPreview(url);
      set("fotoUrl", url);
      toast.success("Foto enviada com sucesso!");
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 10MB)"); return; }
    setUploadingDoc(true);
    try {
      const url = await uploadFile(file, "clientes/documentos");
      const tipoLabel = TIPOS_DOCUMENTO.find(t => t.key === tipoDocSelecionado)?.label || tipoDocSelecionado;
      const novos = [...documentos, { tipo: tipoDocSelecionado, url, nome: tipoLabel }];
      setDocumentos(novos);
      set("documentosUrls", JSON.stringify(novos));
      toast.success(`${tipoLabel} enviado com sucesso!`);
    } catch {
      toast.error("Erro ao enviar documento");
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const removerDoc = (idx: number) => {
    const novos = documentos.filter((_, i) => i !== idx);
    setDocumentos(novos);
    set("documentosUrls", JSON.stringify(novos));
  };

  const handleSubmit = () => {
    const payload: any = { ...form };
    // Limpar campos vazios
    Object.keys(payload).forEach(k => { if (payload[k] === "") delete payload[k]; });
    createMutation.mutate(payload);
  };

  const initials = form.nome ? getInitials(form.nome) : "CL";
  const avatarColor = form.nome ? getAvatarColor(form.nome) : "bg-muted";

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setForm(emptyForm); setFotoPreview(null); setDocumentos([]); setAba("pessoal"); } }}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" />Novo Cliente</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-display text-xl tracking-wide">Novo Cliente</DialogTitle>
        </DialogHeader>

        {/* ABAS */}
        <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-border">
          {([
            { key: "pessoal", label: "Dados Pessoais", icon: User },
            { key: "endereco", label: "Endereço", icon: MapPin },
            { key: "documentos", label: "Documentos", icon: FileText },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                aba === key
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ABA: DADOS PESSOAIS */}
          {aba === "pessoal" && (
            <div className="space-y-5">
              {/* Avatar + foto */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Foto" className="h-20 w-20 rounded-full object-cover border-2 border-primary/30" />
                  ) : (
                    <div className={`h-20 w-20 rounded-full ${avatarColor} flex items-center justify-center border-2 border-border`}>
                      <span className="text-white font-bold text-2xl">{initials}</span>
                    </div>
                  )}
                  <button
                    onClick={() => fotoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary flex items-center justify-center border-2 border-background hover:bg-primary/80 transition-colors"
                    disabled={uploadingFoto}
                  >
                    {uploadingFoto ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Camera className="h-3.5 w-3.5 text-white" />}
                  </button>
                  <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
                </div>
                <p className="text-xs text-muted-foreground">Avatar gerado automaticamente</p>
                <button onClick={() => fotoInputRef.current?.click()} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5">
                  <Camera className="h-3.5 w-3.5" />Adicionar foto
                </button>
                <p className="text-xs text-muted-foreground">A foto será enviada ao salvar o cliente</p>
              </div>

              {/* Nome */}
              <div>
                <Label>Nome Completo *</Label>
                <Input className="mt-1" placeholder="Nome completo do cliente" value={form.nome} onChange={e => set("nome", e.target.value)} />
              </div>

              {/* CPF / CNPJ / RG */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />CPF</Label>
                  <Input className="mt-1" placeholder="000.000.000-00" value={form.cpfCnpj} onChange={e => set("cpfCnpj", e.target.value)} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />CNPJ</Label>
                  <Input className="mt-1" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e => set("cnpj", e.target.value)} />
                </div>
                <div>
                  <Label>RG</Label>
                  <Input className="mt-1" placeholder="00.000.000-0" value={form.rg} onChange={e => set("rg", e.target.value)} />
                </div>
              </div>

              {/* Email / Telefone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>E-mail</Label>
                  <Input className="mt-1" type="email" placeholder="cliente@email.com" value={form.email} onChange={e => set("email", e.target.value)} />
                </div>
                <div>
                  <Label>Telefone (com DDD)</Label>
                  <Input className="mt-1" placeholder="(00) 00000-0000" value={form.telefone} onChange={e => set("telefone", e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-0.5">Inclua o DDD para envio via WhatsApp</p>
                </div>
              </div>

              {/* Redes sociais */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" />Instagram</Label>
                  <Input className="mt-1" placeholder="@usuario" value={form.instagram} onChange={e => set("instagram", e.target.value)} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5"><Facebook className="h-3.5 w-3.5" />Facebook</Label>
                  <Input className="mt-1" placeholder="Nome ou URL do perfil" value={form.facebook} onChange={e => set("facebook", e.target.value)} />
                </div>
              </div>

              {/* Profissão */}
              <div>
                <Label>Profissão</Label>
                <Input className="mt-1" placeholder="Ex: Eletricista, Comerciante, Motorista..." value={form.profissao} onChange={e => set("profissao", e.target.value)} />
              </div>

              {/* Data nasc / Sexo / Estado civil */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input className="mt-1" type="date" value={form.dataNascimento} onChange={e => set("dataNascimento", e.target.value)} />
                </div>
                <div>
                  <Label>Sexo</Label>
                  <Select value={form.sexo || "_none"} onValueChange={v => set("sexo", v === "_none" ? "" : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Não informado</SelectItem>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado Civil</Label>
                  <Select value={form.estadoCivil || "_none"} onValueChange={v => set("estadoCivil", v === "_none" ? "" : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Não informado</SelectItem>
                      <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                      <SelectItem value="casado">Casado(a)</SelectItem>
                      <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                      <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Nome mãe / pai */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome da Mãe</Label>
                  <Input className="mt-1" placeholder="Nome completo da mãe" value={form.nomeMae} onChange={e => set("nomeMae", e.target.value)} />
                </div>
                <div>
                  <Label>Nome do Pai</Label>
                  <Input className="mt-1" placeholder="Nome completo do pai" value={form.nomePai} onChange={e => set("nomePai", e.target.value)} />
                </div>
              </div>

              {/* PIX / Banco */}
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-3">Dados Bancários / PIX</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de Chave PIX</Label>
                    <Select value={form.tipoChavePix} onValueChange={v => set("tipoChavePix", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Chave PIX</Label>
                    <Input className="mt-1" placeholder="Chave PIX" value={form.chavePix} onChange={e => set("chavePix", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <Label>Banco</Label>
                    <Input className="mt-1" placeholder="Ex: Bradesco" value={form.banco} onChange={e => set("banco", e.target.value)} />
                  </div>
                  <div>
                    <Label>Agência</Label>
                    <Input className="mt-1" placeholder="0000" value={form.agencia} onChange={e => set("agencia", e.target.value)} />
                  </div>
                  <div>
                    <Label>Conta</Label>
                    <Input className="mt-1" placeholder="00000-0" value={form.numeroConta} onChange={e => set("numeroConta", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <Label>Observações</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  rows={3}
                  placeholder="Observações internas sobre o cliente..."
                  value={form.observacoes}
                  onChange={e => set("observacoes", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ABA: ENDEREÇO */}
          {aba === "endereco" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>CEP</Label>
                  <Input className="mt-1" placeholder="00000-000" value={form.cep} onChange={e => set("cep", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Endereço (Rua / Avenida)</Label>
                  <Input className="mt-1" placeholder="Rua das Flores" value={form.endereco} onChange={e => set("endereco", e.target.value)} />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input className="mt-1" placeholder="100" value={form.numero} onChange={e => set("numero", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Complemento</Label>
                  <Input className="mt-1" placeholder="Apto 12, Bloco B..." value={form.complemento} onChange={e => set("complemento", e.target.value)} />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input className="mt-1" placeholder="Centro" value={form.bairro} onChange={e => set("bairro", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Cidade</Label>
                  <Input className="mt-1" placeholder="São Paulo" value={form.cidade} onChange={e => set("cidade", e.target.value)} />
                </div>
                <div>
                  <Label>Estado (UF)</Label>
                  <Input className="mt-1" placeholder="SP" maxLength={2} value={form.estado} onChange={e => set("estado", e.target.value.toUpperCase())} />
                </div>
              </div>
            </div>
          )}

          {/* ABA: DOCUMENTOS */}
          {aba === "documentos" && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Faça upload dos documentos do cliente. Formatos aceitos: JPG, PNG, PDF (máx. 10MB por arquivo).
                </p>

                {/* Seletor de tipo + upload */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label>Tipo de Documento</Label>
                    <Select value={tipoDocSelecionado} onValueChange={setTipoDocSelecionado}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_DOCUMENTO.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2 shrink-0"
                    onClick={() => docInputRef.current?.click()}
                    disabled={uploadingDoc}
                  >
                    {uploadingDoc ? <span className="w-4 h-4 border-2 border-border border-t-foreground rounded-full animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadingDoc ? "Enviando..." : "Selecionar Arquivo"}
                  </Button>
                  <input ref={docInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleDocChange} />
                </div>

                {/* Lista de documentos enviados */}
                {documentos.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">{documentos.length} documento(s) adicionado(s):</p>
                    {documentos.map((doc, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.nome}</p>
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Ver documento</a>
                        </div>
                        <button onClick={() => removerDoc(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 border-2 border-dashed border-border rounded-xl p-8 text-center">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nenhum documento adicionado ainda</p>
                    <p className="text-xs text-muted-foreground mt-1">Selecione o tipo e clique em "Selecionar Arquivo"</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            className="flex-1"
            disabled={!form.nome || createMutation.isPending}
            onClick={handleSubmit}
          >
            {createMutation.isPending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Salvando...</>
            ) : "Cadastrar Cliente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function Clientes() {
  const [, setLocation] = useLocation();
  const [busca, setBusca] = useState("");
  const utils = trpc.useUtils();

  const { data: clientesData, isLoading } = trpc.clientes.list.useQuery({ busca: busca || undefined });
  const clientes = clientesData?.clientes ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">CLIENTES</h1>
          <p className="text-sm text-muted-foreground mt-1">{clientes.length} clientes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <ImportarCSVDialog onSuccess={() => utils.clientes.list.invalidate()} />
          <NovoClienteDialog onSuccess={() => utils.clientes.list.invalidate()} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, CPF ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Card key={i} className="border-border animate-pulse"><CardContent className="p-5 h-28" /></Card>)}
        </div>
      )}

      {!isLoading && clientes.length === 0 && (
        <div className="text-center py-16">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum cliente encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre o primeiro cliente para começar</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {clientes?.map(cliente => (
          <Card
            key={cliente.id}
            className="border-border hover:border-primary/30 transition-all cursor-pointer"
            onClick={() => setLocation(`/clientes/${cliente.id}`)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  {cliente.fotoUrl ? (
                    <img src={cliente.fotoUrl} alt={cliente.nome} className="h-10 w-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className={`h-10 w-10 rounded-full ${getAvatarColor(cliente.nome)} flex items-center justify-center shrink-0`}>
                      <span className="text-white font-semibold text-sm">{getInitials(cliente.nome)}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{cliente.nome}</div>
                    {cliente.cpfCnpj && <div className="text-xs text-muted-foreground">{cliente.cpfCnpj}</div>}
                    {cliente.profissao && <div className="text-xs text-muted-foreground italic">{cliente.profissao}</div>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>

              <div className="space-y-1.5">
                {cliente.telefone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />{cliente.telefone}
                  </div>
                )}
                {cliente.chavePix && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CreditCard className="h-3 w-3" />PIX: {cliente.chavePix}
                  </div>
                )}
              </div>

              <div className="mt-3">
                <ScoreBadge score={cliente.score ?? 700} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
