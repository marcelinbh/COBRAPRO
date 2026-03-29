import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Search, User, Phone, CreditCard, ChevronRight, Star, Upload, Download, AlertCircle, CheckCircle2
} from "lucide-react";

// ─── IMPORTAR BASE DE DADOS (CSV) ─────────────────────────────────────────────────
function ImportarCSVDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [resultado, setResultado] = useState<{ importados: number; erros: number; detalhesErros: string[] } | null>(null);

  const importMutation = trpc.clientes.importarCSV.useMutation({
    onSuccess: (data) => {
      setResultado(data);
      if (data.importados > 0) onSuccess();
    },
    onError: (e) => toast.error("Erro na importação: " + e.message),
  });

  const parseCSV = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const raw = lines[0].split(/[;,]/).map(h =>
      h.trim().toLowerCase().replace(/["']/g, '')
        .replace(/\s+/g, '')
        .replace('nomecompleto', 'nome')
        .replace('cpf/cnpj', 'cpfcnpj')
        .replace('cpfoucnpj', 'cpfcnpj')
        .replace('cpf', 'cpfcnpj')
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
    setFileName(file.name);
    setResultado(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setAllRows(rows);
      setPreview(rows.slice(0, 5));
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

  const handleClose = (v: boolean) => {
    setOpen(v);
    if (!v) { setPreview([]); setAllRows([]); setFileName(''); setResultado(null); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${
              resultado.erros === 0 ? 'bg-success/10 border-success/30' : 'bg-warning/10 border-warning/30'
            }`}>
              {resultado.erros === 0
                ? <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                : <AlertCircle className="h-6 w-6 text-warning shrink-0" />}
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
                <p className="text-xs text-muted-foreground mt-1">.csv ou .txt — qualquer tamanho</p>
              </div>
              <input id="csv-upload" type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            </label>
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />Baixar modelo de planilha (.csv)
            </Button>
            {preview.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  Prévia — {allRows.length} registros detectados:
                </p>
                <div className="bg-muted/30 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border">
                      {Object.keys(preview[0]).slice(0, 5).map(k => (
                        <th key={k} className="p-2 text-left text-muted-foreground capitalize">{k}</th>
                      ))}
                    </tr></thead>
                    <tbody>{preview.map((row, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Object.values(row).slice(0, 5).map((v: any, j) => (
                          <td key={j} className="p-2 truncate max-w-[120px]">{v}</td>
                        ))}
                      </tr>
                    ))}</tbody>
                  </table>
                  {allRows.length > 5 && (
                    <p className="text-xs text-muted-foreground p-2">... e mais {allRows.length - 5} registros</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                className="flex-1 gap-2"
                disabled={allRows.length === 0 || importMutation.isPending}
                onClick={handleImport}
              >
                {importMutation.isPending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importando...</>
                ) : (
                  <><Upload className="h-4 w-4" />Importar {allRows.length > 0 ? `${allRows.length} registros` : ''}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScoreBadge({ score }: { score: number }) {
  let color = "text-success bg-success/15 border-success/30";
  let label = "Excelente";
  if (score < 300) { color = "text-primary bg-primary/15 border-primary/30"; label = "Ruim"; }
  else if (score < 500) { color = "text-warning bg-warning/15 border-warning/30"; label = "Regular"; }
  else if (score < 700) { color = "text-foreground bg-muted border-border"; label = "Bom"; }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      <Star className="h-3 w-3" />
      {score} · {label}
    </span>
  );
}

function NovoClienteDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "", cpfCnpj: "", telefone: "", whatsapp: "",
    email: "", chavePix: "", tipoChavePix: "cpf" as const,
    endereco: "", cidade: "", estado: "", cep: "", observacoes: "",
  });

  const createMutation = trpc.clientes.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso!");
      setOpen(false);
      setForm({ nome: "", cpfCnpj: "", telefone: "", whatsapp: "", email: "", chavePix: "", tipoChavePix: "cpf", endereco: "", cidade: "", estado: "", cep: "", observacoes: "" });
      onSuccess();
    },
    onError: (e) => toast.error("Erro ao cadastrar: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" />Novo Cliente</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">NOVO CLIENTE</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="col-span-2">
            <Label>Nome Completo *</Label>
            <Input className="mt-1" placeholder="Nome do cliente" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div>
            <Label>CPF / CNPJ</Label>
            <Input className="mt-1" placeholder="000.000.000-00" value={form.cpfCnpj} onChange={e => setForm(f => ({ ...f, cpfCnpj: e.target.value }))} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input className="mt-1" placeholder="(00) 00000-0000" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input className="mt-1" placeholder="(00) 00000-0000" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input className="mt-1" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label>Tipo de Chave PIX</Label>
            <Select value={form.tipoChavePix} onValueChange={v => setForm(f => ({ ...f, tipoChavePix: v as any }))}>
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
            <Input className="mt-1" placeholder="Chave PIX" value={form.chavePix} onChange={e => setForm(f => ({ ...f, chavePix: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Endereço</Label>
            <Input className="mt-1" placeholder="Rua, número, bairro" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input className="mt-1" placeholder="Cidade" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
          </div>
          <div>
            <Label>Estado</Label>
            <Input className="mt-1" placeholder="UF" maxLength={2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value.toUpperCase() }))} />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={3}
              placeholder="Observações internas sobre o cliente..."
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            className="flex-1"
            disabled={!form.nome || createMutation.isPending}
            onClick={() => createMutation.mutate(form)}
          >
            {createMutation.isPending ? "Salvando..." : "Cadastrar Cliente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Clientes() {
  const [, setLocation] = useLocation();
  const [busca, setBusca] = useState("");
  const utils = trpc.useUtils();

  const { data: clientes, isLoading } = trpc.clientes.list.useQuery({ busca: busca || undefined });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">CLIENTES</h1>
          <p className="text-sm text-muted-foreground mt-1">{clientes?.length ?? 0} clientes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <ImportarCSVDialog onSuccess={() => utils.clientes.list.invalidate()} />
          <NovoClienteDialog onSuccess={() => utils.clientes.list.invalidate()} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, CPF ou telefone..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-border animate-pulse">
              <CardContent className="p-5 h-28" />
            </Card>
          ))}
        </div>
      )}

      {!isLoading && clientes?.length === 0 && (
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
                  <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-primary font-semibold text-sm">
                      {cliente.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{cliente.nome}</div>
                    {cliente.cpfCnpj && (
                      <div className="text-xs text-muted-foreground">{cliente.cpfCnpj}</div>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>

              <div className="space-y-1.5">
                {cliente.telefone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {cliente.telefone}
                  </div>
                )}
                {cliente.chavePix && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CreditCard className="h-3 w-3" />
                    PIX: {cliente.chavePix}
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
