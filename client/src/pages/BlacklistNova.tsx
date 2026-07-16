import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, Upload, X, User, MapPin, FileText, Camera } from "lucide-react";
import { Link } from "wouter";

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatCep(value: string) {
  return value.replace(/\D/g, "").replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

function formatPhone(value: string) {
  const d = value.replace(/\D/g, "");
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

export default function BlacklistNova() {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    cpfCnpj: "",
    nome: "",
    telefone: "",
    email: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    motivo: "",
    tipoDivida: "outros" as const,
    valorDivida: "",
    dataOcorrencia: "",
    observacoes: "",
  });

  const [fotos, setFotos] = useState<{ file: File; preview: string; base64: string }[]>([]);
  const [fotoUploading, setFotoUploading] = useState(false);

  const criar = trpc.blacklist.criar.useMutation();
  const adicionarFoto = trpc.blacklist.adicionarFoto.useMutation();

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const novasFotos = await Promise.all(
      files.slice(0, 5 - fotos.length).map(async (file) => {
        const preview = URL.createObjectURL(file);
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        return { file, preview, base64 };
      })
    );

    setFotos((prev) => [...prev, ...novasFotos].slice(0, 5));
  }

  function removerFoto(index: number) {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.cpfCnpj || form.cpfCnpj.replace(/\D/g, "").length < 11) {
      toast.error("CPF/CNPJ inválido", { description: "Informe um CPF ou CNPJ válido" });
      return;
    }
    if (!form.nome.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    if (!form.motivo.trim()) {
      toast.error("Motivo obrigatório");
      return;
    }

    try {
      setFotoUploading(true);

      // Criar o registro principal
      const registro = await criar.mutateAsync({
        ...form,
        cpfCnpj: form.cpfCnpj.replace(/\D/g, ""),
        valorDivida: form.valorDivida ? form.valorDivida.replace(/[^\d,]/g, "").replace(",", ".") : undefined,
      });

      // Upload das fotos
      for (const foto of fotos) {
        try {
          await adicionarFoto.mutateAsync({
            blacklistId: registro.id,
            fotoBase64: foto.base64,
            mimeType: foto.file.type || "image/jpeg",
          });
        } catch (err) {
          console.warn("Erro ao fazer upload de foto:", err);
        }
      }

      toast.success("Registro incluído com sucesso!", { description: `${form.nome} foi adicionado à blacklist CobraPro` });

      navigate("/blacklist");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao incluir na blacklist";
      toast.error("Erro", { description: msg });
    } finally {
      setFotoUploading(false);
    }
  }

  const isLoading = criar.isPending || fotoUploading;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/blacklist">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <ShieldAlert className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Nova Inclusão na Blacklist</h1>
            <p className="text-sm text-muted-foreground">Adicionar devedor à lista compartilhada</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados do Devedor */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Dados do Devedor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cpfCnpj">CPF ou CNPJ *</Label>
                <Input
                  id="cpfCnpj"
                  placeholder="000.000.000-00"
                  value={form.cpfCnpj}
                  onChange={(e) => handleChange("cpfCnpj", formatCpfCnpj(e.target.value))}
                  maxLength={18}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  placeholder="Nome completo do devedor"
                  value={form.nome}
                  onChange={(e) => handleChange("nome", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={(e) => handleChange("telefone", formatPhone(e.target.value))}
                  maxLength={15}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="endereco">Rua / Avenida</Label>
                <Input
                  id="endereco"
                  placeholder="Rua, Avenida, etc."
                  value={form.endereco}
                  onChange={(e) => handleChange("endereco", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  placeholder="Nº"
                  value={form.numero}
                  onChange={(e) => handleChange("numero", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  placeholder="Apto, Bloco, etc."
                  value={form.complemento}
                  onChange={(e) => handleChange("complemento", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  placeholder="Bairro"
                  value={form.bairro}
                  onChange={(e) => handleChange("bairro", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  placeholder="00000-000"
                  value={form.cep}
                  onChange={(e) => handleChange("cep", formatCep(e.target.value))}
                  maxLength={9}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  placeholder="Cidade"
                  value={form.cidade}
                  onChange={(e) => handleChange("cidade", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estado">Estado</Label>
                <Select value={form.estado} onValueChange={(v) => handleChange("estado", v)}>
                  <SelectTrigger id="estado">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BR.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dados da Dívida */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Dados da Dívida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tipoDivida">Tipo de Dívida</Label>
                <Select
                  value={form.tipoDivida}
                  onValueChange={(v) => handleChange("tipoDivida", v)}
                >
                  <SelectTrigger id="tipoDivida">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emprestimo">Empréstimo</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="produto">Produto</SelectItem>
                    <SelectItem value="aluguel">Aluguel</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valorDivida">Valor em Aberto</Label>
                <Input
                  id="valorDivida"
                  placeholder="R$ 0,00"
                  value={form.valorDivida}
                  onChange={(e) => handleChange("valorDivida", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dataOcorrencia">Data da Ocorrência</Label>
                <Input
                  id="dataOcorrencia"
                  type="date"
                  value={form.dataOcorrencia}
                  onChange={(e) => handleChange("dataOcorrencia", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo / Descrição *</Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo da inclusão (ex: Empréstimo não pago, cheque sem fundo, etc.)"
                value={form.motivo}
                onChange={(e) => handleChange("motivo", e.target.value)}
                rows={3}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="observacoes">Observações Adicionais</Label>
              <Textarea
                id="observacoes"
                placeholder="Informações extras relevantes..."
                value={form.observacoes}
                onChange={(e) => handleChange("observacoes", e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Fotos */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              Fotos do Devedor
              <span className="text-xs text-muted-foreground font-normal">(opcional, máx. 5)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFotoChange}
            />

            <div className="flex flex-wrap gap-3">
              {fotos.map((foto, i) => (
                <div key={i} className="relative">
                  <img
                    src={foto.preview}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removerFoto(i)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {fotos.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Adicionar</span>
                </button>
              )}
            </div>

            {fotos.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {fotos.length} foto(s) selecionada(s). As fotos serão enviadas ao salvar.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Botões */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link href="/blacklist">Cancelar</Link>
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 min-w-[160px]"
          >
            {isLoading ? "Salvando..." : "Incluir na Blacklist"}
          </Button>
        </div>
      </form>
    </div>
  );
}
