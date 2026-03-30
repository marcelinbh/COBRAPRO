import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Wallet, ArrowUpRight, ArrowDownRight, Building2, PlusCircle, MinusCircle } from "lucide-react";
import { formatarMoeda } from "../../../shared/finance";

// ── Modal: Nova Conta ─────────────────────────────────────────────────────────
function NovaConta({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", tipo: "caixa", banco: "", saldoInicial: "0" });

  const mutation = trpc.caixa.criarConta.useMutation({
    onSuccess: () => { toast.success("Conta criada!"); setOpen(false); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><Plus className="h-4 w-4" />Nova Conta</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">NOVA CONTA</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Nome da Conta *</Label>
            <Input className="mt-1" placeholder="Ex: Caixa Principal" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="caixa">Caixa Físico</SelectItem>
                <SelectItem value="banco">Banco</SelectItem>
                <SelectItem value="digital">Conta Digital</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.tipo === 'banco' && (
            <div>
              <Label>Banco</Label>
              <Input className="mt-1" placeholder="Ex: Nubank, Itaú..." value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
            </div>
          )}
          <div>
            <Label>Saldo Inicial (R$)</Label>
            <Input className="mt-1" type="number" step="0.01" value={form.saldoInicial} onChange={e => setForm(f => ({ ...f, saldoInicial: e.target.value }))} />
          </div>
          <Button
            className="w-full"
            disabled={!form.nome || mutation.isPending}
            onClick={() => mutation.mutate({ nome: form.nome, tipo: form.tipo as any, banco: form.banco || undefined, saldoInicial: parseFloat(form.saldoInicial) })}
          >
            {mutation.isPending ? "Criando..." : "Criar Conta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal: Nova Transação (completo) ─────────────────────────────────────────
function NovaTransacao({ contas, onSuccess }: { contas: { id: number; nome: string }[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ contaCaixaId: "", tipo: "entrada", categoria: "outros", valor: "", descricao: "" });

  const mutation = trpc.caixa.registrarTransacao.useMutation({
    onSuccess: () => { toast.success("Transação registrada!"); setOpen(false); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Nova Transação</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">NOVA TRANSAÇÃO</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Conta *</Label>
            <Select value={form.contaCaixaId} onValueChange={v => setForm(f => ({ ...f, contaCaixaId: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {contas.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {['entrada', 'saida'].map(t => (
                <button
                  key={t}
                  className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                    form.tipo === t
                      ? t === 'entrada' ? 'border-success bg-success/15 text-success' : 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                  onClick={() => setForm(f => ({ ...f, tipo: t }))}
                >
                  {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagamento_parcela">Pagamento de Parcela</SelectItem>
                <SelectItem value="emprestimo_liberado">Empréstimo Liberado</SelectItem>
                <SelectItem value="despesa_operacional">Despesa Operacional</SelectItem>
                <SelectItem value="transferencia_conta">Transferência entre Contas</SelectItem>
                <SelectItem value="ajuste_manual">Ajuste Manual</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (R$) *</Label>
            <Input className="mt-1" type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input className="mt-1" placeholder="Descrição da transação" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <Button
            className="w-full"
            disabled={!form.contaCaixaId || !form.valor || mutation.isPending}
            onClick={() => mutation.mutate({
              contaCaixaId: parseInt(form.contaCaixaId),
              tipo: form.tipo as any,
              categoria: form.categoria as any,
              valor: parseFloat(form.valor),
              descricao: form.descricao || undefined,
            })}
          >
            {mutation.isPending ? "Salvando..." : "Registrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal: Lançamento Rápido (Adicionar / Debitar) ────────────────────────────
function LancamentoRapido({
  conta,
  tipo,
  onSuccess,
}: {
  conta: { id: number; nome: string };
  tipo: "entrada" | "saida";
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");

  const mutation = trpc.caixa.registrarTransacao.useMutation({
    onSuccess: () => {
      toast.success(tipo === "entrada" ? "Saldo adicionado!" : "Saldo debitado!");
      setOpen(false);
      setValor("");
      setDescricao("");
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const isEntrada = tipo === "entrada";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          onClick={e => e.stopPropagation()}
          className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
            isEntrada
              ? "bg-success/15 hover:bg-success/30 text-success"
              : "bg-primary/15 hover:bg-primary/30 text-primary"
          }`}
          title={isEntrada ? "Adicionar saldo" : "Debitar saldo"}
        >
          {isEntrada ? <PlusCircle className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm" onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">
            {isEntrada ? "➕ ADICIONAR SALDO" : "➖ DEBITAR SALDO"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            Conta: <span className="font-medium text-foreground">{conta.nome}</span>
          </div>
          <div>
            <Label>Valor (R$) *</Label>
            <Input
              className="mt-1 text-lg font-semibold"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={valor}
              onChange={e => setValor(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Input
              className="mt-1"
              placeholder={isEntrada ? "Ex: Depósito em dinheiro" : "Ex: Retirada para despesa"}
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className={isEntrada ? "bg-success hover:bg-success/90 text-white" : ""}
              variant={isEntrada ? "default" : "destructive"}
              disabled={!valor || parseFloat(valor) <= 0 || mutation.isPending}
              onClick={() => mutation.mutate({
                contaCaixaId: conta.id,
                tipo,
                categoria: "ajuste_manual",
                valor: parseFloat(valor),
                descricao: descricao || (isEntrada ? "Adição manual de saldo" : "Débito manual de saldo"),
              })}
            >
              {mutation.isPending ? "Salvando..." : isEntrada ? "Adicionar" : "Debitar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function Caixa() {
  const [contaSelecionada, setContaSelecionada] = useState<number | undefined>();
  const utils = trpc.useUtils();

  const { data: contas, isLoading: contasLoading } = trpc.caixa.contas.useQuery();
  const { data: transacoes } = trpc.caixa.transacoes.useQuery({ contaCaixaId: contaSelecionada });

  const saldoTotal = contas?.reduce((sum, c) => sum + c.saldoAtual, 0) ?? 0;

  const tipoIcons = { entrada: ArrowUpRight, saida: ArrowDownRight };
  const categoriaLabels: Record<string, string> = {
    pagamento_parcela: "Pagamento de Parcela",
    emprestimo_liberado: "Empréstimo Liberado",
    despesa_operacional: "Despesa Operacional",
    transferencia_conta: "Transferência",
    ajuste_manual: "Ajuste Manual",
    outros: "Outros",
  };

  const invalidarTudo = () => {
    utils.caixa.contas.invalidate();
    utils.caixa.transacoes.invalidate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">CAIXA</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de contas e transações</p>
        </div>
        <div className="flex gap-2">
          <NovaConta onSuccess={invalidarTudo} />
          <NovaTransacao contas={contas ?? []} onSuccess={invalidarTudo} />
        </div>
      </div>

      {/* Saldo Total */}
      <Card className="border-border bg-gradient-to-r from-card to-card/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/15">
              <Wallet className="h-6 w-6 text-success" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Saldo Total em Todas as Contas</div>
              <div className={`font-display text-3xl ${saldoTotal >= 0 ? 'text-success' : 'text-primary'}`}>
                {formatarMoeda(saldoTotal)}
              </div>
              {saldoTotal < 0 && (
                <div className="text-xs text-primary mt-1">⚠ Saldo negativo — contratos podem ser criados normalmente</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contas */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Contas</h2>
        {contasLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Card key={i} className="border-border animate-pulse"><CardContent className="p-5 h-24" /></Card>)}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {contas?.map(conta => (
            <Card
              key={conta.id}
              className={`border cursor-pointer transition-all ${contaSelecionada === conta.id ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-border/80'}`}
              onClick={() => setContaSelecionada(contaSelecionada === conta.id ? undefined : conta.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Botões rápidos de lançamento */}
                    <LancamentoRapido conta={conta} tipo="entrada" onSuccess={invalidarTudo} />
                    <LancamentoRapido conta={conta} tipo="saida" onSuccess={invalidarTudo} />
                    <span className="text-xs text-muted-foreground capitalize ml-1">{conta.tipo.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className={`font-display text-xl ${conta.saldoAtual >= 0 ? 'text-foreground' : 'text-primary'}`}>
                  {formatarMoeda(conta.saldoAtual)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{conta.nome}</div>
                {conta.banco && <div className="text-xs text-muted-foreground">{conta.banco}</div>}
                {conta.saldoAtual < 0 && (
                  <div className="text-xs text-primary mt-1">Saldo negativo</div>
                )}
              </CardContent>
            </Card>
          ))}
          {!contasLoading && contas?.length === 0 && (
            <div className="col-span-3 text-center py-8 text-muted-foreground">
              <Wallet className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Nenhuma conta cadastrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Transações */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {contaSelecionada ? `Transações — ${contas?.find(c => c.id === contaSelecionada)?.nome}` : 'Últimas Transações'}
        </h2>
        <Card className="border-border">
          <CardContent className="p-0">
            {transacoes?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">Nenhuma transação registrada</p>
              </div>
            )}
            <div className="divide-y divide-border">
              {transacoes?.map(t => {
                const Icon = tipoIcons[t.tipo as keyof typeof tipoIcons] ?? ArrowUpRight;
                const isEntrada = t.tipo === 'entrada';
                return (
                  <div key={t.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${isEntrada ? 'bg-success/15' : 'bg-primary/15'}`}>
                        <Icon className={`h-4 w-4 ${isEntrada ? 'text-success' : 'text-primary'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {t.descricao || categoriaLabels[t.categoria] || t.categoria}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.contaNome} · {t.clienteNome && `${t.clienteNome} · `}
                          {new Date(t.dataTransacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div className={`font-semibold text-sm shrink-0 ml-4 ${isEntrada ? 'text-success' : 'text-primary'}`}>
                      {isEntrada ? '+' : '-'}{formatarMoeda(t.valor)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
