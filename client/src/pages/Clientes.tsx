'use client';
import { useState, useCallback, useRef } from "react";
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
  AlertCircle, CheckCircle2, Camera, FileText, X, MapPin, Instagram, Facebook, Trash2,
  Edit2, Eye
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

// ─── SCORE BADGE ──────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  let color = "text-success bg-success/15 border-success/30";
  let label = "Excelente";
  if (score < 300) { color = "text-primary bg-primary/15 border-primary/30"; label = "Ruim"; }
  else if (score < 500) { color = "text-warning bg-warning/15 border-warning/30"; label = "Regular"; }
  else if (score < 700) { color = "text-foreground bg-muted border-border"; label = "Bom"; }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      <Star className="h-3 w-3" />{score}
    </span>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors = {
    ativo: "bg-green-500/15 text-green-500 border-green-500/30",
    inativo: "bg-gray-500/15 text-gray-500 border-gray-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status as keyof typeof colors] || colors.ativo}`}>
      {status === "ativo" ? "✓ Ativo" : "Inativo"}
    </span>
  );
}

// ─── TIPO CLIENTE BADGE ───────────────────────────────────────────────────────
function TipoClienteBadge({ tipo }: { tipo: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-blue-500/30 bg-blue-500/15 text-blue-500">
      {tipo || "Empréstimo"}
    </span>
  );
}

export default function Clientes() {
  const [, setLocation] = useLocation();
  const [busca, setBusca] = useState("");
  const [deleteClienteId, setDeleteClienteId] = useState<number | null>(null);
  const [deleteClienteNome, setDeleteClienteNome] = useState("");
  const [showNovoClienteModal, setShowNovoClienteModal] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteTelefone, setNovoClienteTelefone] = useState("");
  const [novoClienteTipo, setNovoClienteTipo] = useState("");

  const { data: clientesData, isLoading } = trpc.clientes.list.useQuery();
  const clientes = Array.isArray(clientesData) ? clientesData : clientesData?.clientes ?? [];
  const utils = trpc.useUtils();
  
  const deleteClienteMutation = trpc.clientes.deletar.useMutation({
    onSuccess: () => {
      toast.success("Cliente deletado com sucesso!");
      setDeleteClienteId(null);
      utils.clientes.list.invalidate();
    },
    onError: (e) => toast.error("Erro ao deletar: " + e.message),
  });

  const filteredClientes = (clientes as any[]).filter((c: any) =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.cpfCnpj?.includes(busca) ||
    c.telefone?.includes(busca)
  );

  const createClienteMutation = trpc.clientes.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente criado com sucesso!");
      setShowNovoClienteModal(false);
      setNovoClienteNome("");
      setNovoClienteTelefone("");
      setNovoClienteTipo("");
      utils.clientes.list.invalidate();
    },
    onError: (e) => toast.error("Erro ao criar: " + e.message),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus clientes</p>
        </div>
        <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => setShowNovoClienteModal(true)}>
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          className="pl-9" 
          placeholder="Buscar clientes..." 
          value={busca} 
          onChange={e => setBusca(e.target.value)} 
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
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
                  <td colSpan={7} className="px-6 py-4 text-center text-muted-foreground">
                    Carregando clientes...
                  </td>
                </tr>
              )}
              {!isLoading && filteredClientes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Nenhum cliente encontrado</p>
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
                  <td className="px-6 py-4 text-sm text-foreground">
                    {cliente.telefone || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <TipoClienteBadge tipo={cliente.profissao || "Empréstimo"} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status="ativo" />
                  </td>
                  <td className="px-6 py-4">
                    <ScoreBadge score={cliente.score ?? 700} />
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {cliente.createdAt ? new Date(cliente.createdAt).toLocaleDateString('pt-BR') : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setLocation(`/clientes/${cliente.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setDeleteClienteId(cliente.id);
                          setDeleteClienteNome(cliente.nome);
                        }}
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
                <p className="text-sm text-muted-foreground mt-2">Esta ação não pode ser desfeita. Todos os dados do cliente serão removidos.</p>
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

      {/* Modal de novo cliente */}
      <Dialog open={showNovoClienteModal} onOpenChange={setShowNovoClienteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input 
                placeholder="Nome completo" 
                value={novoClienteNome}
                onChange={(e) => setNovoClienteNome(e.target.value)}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input 
                placeholder="(11) 99999-9999" 
                value={novoClienteTelefone}
                onChange={(e) => setNovoClienteTelefone(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={novoClienteTipo} onValueChange={setNovoClienteTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pessoa Física">Pessoa Física</SelectItem>
                  <SelectItem value="Pessoa Jurídica">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowNovoClienteModal(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => {
                if (!novoClienteNome.trim()) {
                  toast.error("Nome é obrigatório");
                  return;
                }
                createClienteMutation.mutate({
                  nome: novoClienteNome,
                  telefone: novoClienteTelefone,
                  profissao: novoClienteTipo,
                });
              }} disabled={createClienteMutation.isPending}>
                {createClienteMutation.isPending ? "Criando..." : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
