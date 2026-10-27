import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Search, Plus, MapPin, ShieldAlert, Users, CheckCircle, Clock, ShieldCheck } from "lucide-react";

const TIPO_DIVIDA_LABELS: Record<string, string> = {
  emprestimo: "Empréstimo",
  servico: "Serviço",
  produto: "Produto",
  aluguel: "Aluguel",
  cheque: "Cheque",
  outros: "Outros",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "destructive" | "secondary" | "outline"; icon: React.ElementType }> = {
  ativo: { label: "Inadimplente", variant: "destructive", icon: AlertTriangle },
  resolvido: { label: "Resolvido", variant: "secondary", icon: CheckCircle },
  em_negociacao: { label: "Em Negociação", variant: "outline", icon: Clock },
};

function documentoCompleto(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  return digitos.length === 11 || digitos.length === 14;
}

export default function Blacklist() {
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");

  const { data: stats } = trpc.blacklist.estatisticas.useQuery();
  const { data: resultados, isLoading: buscando } = trpc.blacklist.consultar.useQuery(
    { busca: buscaAtiva },
    { enabled: documentoCompleto(buscaAtiva), retry: false }
  );

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    const documento = busca.replace(/\D/g, "");
    if (documentoCompleto(documento)) setBuscaAtiva(documento);
  }

  const buscaInvalida = busca.trim().length > 0 && !documentoCompleto(busca);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10"><ShieldAlert className="h-6 w-6 text-red-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Blacklist CobraPro</h1>
            <p className="text-sm text-muted-foreground">Consulta compartilhada e protegida entre assinantes</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/blacklist/meus">Meus Registros</Link></Button>
          <Button className="bg-red-600 hover:bg-red-700" asChild><Link href="/blacklist/nova"><Plus className="h-4 w-4 mr-2" />Nova Inclusão</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Kpi icon={<Users className="h-5 w-5 text-red-500" />} label="Total Registros" value={stats?.total ?? 0} />
        <Kpi icon={<AlertTriangle className="h-5 w-5 text-red-500" />} label="Inadimplentes" value={stats?.ativos ?? 0} valueClass="text-red-500" />
        <Kpi icon={<CheckCircle className="h-5 w-5 text-green-500" />} label="Resolvidos" value={stats?.resolvidos ?? 0} valueClass="text-green-500" />
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" />Consultar Blacklist</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleBuscar} className="flex gap-2">
            <Input
              placeholder="Digite o CPF ou CNPJ completo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              inputMode="numeric"
              className="flex-1"
            />
            <Button type="submit" disabled={!documentoCompleto(busca)} className="bg-red-600 hover:bg-red-700"><Search className="h-4 w-4 mr-2" />Consultar</Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">Por privacidade e segurança, a consulta exige CPF ou CNPJ completo e mostra dados mascarados.</p>
          {buscaInvalida && <p className="text-xs text-destructive mt-2">Informe os 11 dígitos do CPF ou os 14 dígitos do CNPJ.</p>}

          {buscaAtiva && (
            <div className="mt-4 space-y-3">
              {buscando ? <div className="text-center py-8 text-muted-foreground">Consultando...</div>
                : resultados && resultados.length > 0 ? <>
                  <p className="text-sm text-muted-foreground">{resultados.length} resultado(s) encontrado(s).</p>
                  {resultados.map((registro) => <BlacklistCard key={registro.id} registro={registro} />)}
                </>
                : <div className="text-center py-8"><CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" /><p className="text-lg font-semibold text-foreground">Nenhum registro ativo encontrado</p><p className="text-sm text-muted-foreground mt-1">O documento consultado não consta como inadimplente ou em negociação.</p></div>}
            </div>
          )}

          {!buscaAtiva && <div className="mt-6 text-center py-8"><ShieldCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground text-sm">Consulte usando o CPF ou CNPJ completo do devedor.</p></div>}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
        <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
        <div><p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Uso Responsável</p><p className="text-xs text-muted-foreground mt-1">A consulta é exclusiva aos assinantes e exibe somente dados mínimos. Cadastros devem ser verdadeiros, verificáveis e usados exclusivamente para análise de crédito.</p></div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, valueClass = "" }: { icon: React.ReactNode; label: string; value: number; valueClass?: string }) {
  return <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-muted">{icon}</div><div><p className="text-xs text-muted-foreground">{label}</p><p className={`text-2xl font-bold text-foreground ${valueClass}`}>{value}</p></div></div></CardContent></Card>;
}

function BlacklistCard({ registro }: { registro: { id: number; nome: string; documentoMascarado: string; cidade: string | null; estado: string | null; tipoDivida: string; status: string } }) {
  const statusCfg = STATUS_CONFIG[registro.status] ?? STATUS_CONFIG.ativo;
  const StatusIcon = statusCfg.icon;
  return <div className={`rounded-lg border p-4 ${registro.status === "ativo" ? "border-red-500/30 bg-red-500/5" : "border-orange-500/30 bg-orange-500/5"}`}>
    <div className="flex items-start gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${registro.status === "ativo" ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"}`}>{registro.nome.charAt(0).toUpperCase()}</div>
      <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold text-foreground">{registro.nome}</h3><Badge variant={statusCfg.variant} className="text-xs"><StatusIcon className="h-3 w-3 mr-1" />{statusCfg.label}</Badge><Badge variant="outline" className="text-xs">{TIPO_DIVIDA_LABELS[registro.tipoDivida] ?? registro.tipoDivida}</Badge></div>
        <p className="text-sm font-mono text-muted-foreground mt-1">{registro.documentoMascarado}</p>
        {(registro.cidade || registro.estado) && <p className="flex items-center gap-1 text-xs text-muted-foreground mt-2"><MapPin className="h-3 w-3" />{[registro.cidade, registro.estado].filter(Boolean).join(" - ")}</p>}
      </div>
    </div>
  </div>;
}
