import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle, Search, Plus, User, Phone, MapPin, Calendar,
  DollarSign, Building2, Eye, ShieldAlert, Users, CheckCircle, Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

function cpfMask(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatCurrency(v: string | null) {
  if (!v) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v));
}

export default function Blacklist() {
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [detalheId, setDetalheId] = useState<number | null>(null);

  const { data: stats } = trpc.blacklist.estatisticas.useQuery();
  const { data: resultados, isLoading: buscando } = trpc.blacklist.consultar.useQuery(
    { busca: buscaAtiva },
    { enabled: buscaAtiva.length >= 2 }
  );
  const { data: detalhe } = trpc.blacklist.buscarPorId.useQuery(
    { id: detalheId! },
    { enabled: detalheId !== null }
  );

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (busca.trim().length >= 2) setBuscaAtiva(busca.trim());
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <ShieldAlert className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Blacklist CobraPro</h1>
            <p className="text-sm text-muted-foreground">
              Lista compartilhada de inadimplentes entre todos os assinantes
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/blacklist/meus">Meus Registros</Link>
          </Button>
          <Button className="bg-red-600 hover:bg-red-700" asChild>
            <Link href="/blacklist/nova">
              <Plus className="h-4 w-4 mr-2" />
              Nova Inclusão
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Users className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Registros</p>
                <p className="text-2xl font-bold text-foreground">{stats?.total ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Inadimplentes</p>
                <p className="text-2xl font-bold text-red-500">{stats?.ativos ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resolvidos</p>
                <p className="text-2xl font-bold text-green-500">{stats?.resolvidos ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <DollarSign className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold text-orange-500">
                  {stats?.valorTotal ? formatCurrency(stats.valorTotal) : "R$ 0,00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Consultar Blacklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBuscar} className="flex gap-2">
            <Input
              placeholder="Digite CPF, CNPJ ou nome do devedor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={busca.trim().length < 2} className="bg-red-600 hover:bg-red-700">
              <Search className="h-4 w-4 mr-2" />
              Consultar
            </Button>
          </form>

          {/* Resultados da busca */}
          {buscaAtiva && (
            <div className="mt-4 space-y-3">
              {buscando ? (
                <div className="text-center py-8 text-muted-foreground">Consultando...</div>
              ) : resultados && resultados.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {resultados.length} resultado(s) encontrado(s) para "{buscaAtiva}"
                  </p>
                  {resultados.map((r) => (
                    <BlacklistCard
                      key={r.id}
                      registro={r}
                      onVerDetalhe={() => setDetalheId(r.id === detalheId ? null : r.id)}
                      expandido={detalheId === r.id}
                      detalhe={detalheId === r.id ? detalhe : undefined}
                    />
                  ))}
                </>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-foreground">Nenhum registro encontrado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Este CPF/CNPJ ou nome não consta na blacklist CobraPro
                  </p>
                </div>
              )}
            </div>
          )}

          {!buscaAtiva && (
            <div className="mt-6 text-center py-8">
              <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Digite um CPF, CNPJ ou nome para consultar a blacklist
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                Dados compartilhados entre todos os {stats?.total ?? 0} registros da comunidade CobraPro
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aviso legal */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
        <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Uso Responsável</p>
          <p className="text-xs text-muted-foreground mt-1">
            Esta blacklist é de uso exclusivo dos assinantes CobraPro para fins de proteção ao crédito.
            Certifique-se de que as informações cadastradas são verdadeiras. O cadastro de informações
            falsas pode gerar responsabilidade civil e criminal.
          </p>
        </div>
      </div>
    </div>
  );
}

interface BlacklistCardProps {
  registro: {
    id: number;
    cpfCnpj: string;
    nome: string;
    telefone: string | null;
    cidade: string | null;
    estado: string | null;
    motivo: string;
    tipoDivida: string;
    valorDivida: string | null;
    status: string;
    cadastradoPorEmpresa: string | null;
    dataOcorrencia: string | null;
    createdAt: Date;
    fotos?: { id: number; url: string }[];
  };
  onVerDetalhe: () => void;
  expandido: boolean;
  detalhe?: {
    endereco: string | null;
    numero: string | null;
    bairro: string | null;
    complemento: string | null;
    cep: string | null;
    email: string | null;
    observacoes: string | null;
    fotos: { id: number; url: string }[];
  };
}

function BlacklistCard({ registro, onVerDetalhe, expandido, detalhe }: BlacklistCardProps) {
  const statusCfg = STATUS_CONFIG[registro.status] ?? STATUS_CONFIG.ativo;
  const StatusIcon = statusCfg.icon;

  return (
    <div className={`rounded-lg border transition-all ${
      registro.status === "ativo"
        ? "border-red-500/30 bg-red-500/5"
        : registro.status === "resolvido"
        ? "border-green-500/30 bg-green-500/5"
        : "border-orange-500/30 bg-orange-500/5"
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
              registro.status === "ativo" ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
            }`}>
              {registro.nome.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground">{registro.nome}</h3>
                <Badge variant={statusCfg.variant} className="text-xs">
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusCfg.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {TIPO_DIVIDA_LABELS[registro.tipoDivida] ?? registro.tipoDivida}
                </Badge>
              </div>

              <div className="flex items-center gap-1 mt-1">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-mono text-muted-foreground">
                  {cpfMask(registro.cpfCnpj)}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                {registro.telefone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {registro.telefone}
                  </span>
                )}
                {(registro.cidade || registro.estado) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[registro.cidade, registro.estado].filter(Boolean).join(" - ")}
                  </span>
                )}
                {registro.valorDivida && (
                  <span className="flex items-center gap-1 text-red-500 font-medium">
                    <DollarSign className="h-3 w-3" />
                    {formatCurrency(registro.valorDivida)}
                  </span>
                )}
                {registro.cadastradoPorEmpresa && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {registro.cadastradoPorEmpresa}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDistanceToNow(new Date(registro.createdAt), { addSuffix: true, locale: ptBR })}
                </span>
              </div>

              <p className="text-sm text-foreground/80 mt-2 line-clamp-2">
                <span className="font-medium">Motivo:</span> {registro.motivo}
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onVerDetalhe} className="shrink-0">
            <Eye className="h-4 w-4 mr-1" />
            {expandido ? "Fechar" : "Detalhes"}
          </Button>
        </div>

        {/* Fotos em miniatura */}
        {registro.fotos && registro.fotos.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {registro.fotos.slice(0, 4).map((foto) => (
              <a key={foto.id} href={foto.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={foto.url}
                  alt="Foto do devedor"
                  className="w-14 h-14 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                />
              </a>
            ))}
            {registro.fotos.length > 4 && (
              <div className="w-14 h-14 rounded-lg border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                +{registro.fotos.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Detalhes expandidos */}
        {expandido && detalhe && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
            {(detalhe.endereco || detalhe.bairro || detalhe.cep) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Endereço Completo</p>
                <p className="text-sm text-foreground">
                  {[detalhe.endereco, detalhe.numero, detalhe.complemento, detalhe.bairro, detalhe.cep]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}
            {detalhe.email && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">E-mail</p>
                <p className="text-sm text-foreground">{detalhe.email}</p>
              </div>
            )}
            {detalhe.observacoes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Observações</p>
                <p className="text-sm text-foreground">{detalhe.observacoes}</p>
              </div>
            )}
            {detalhe.fotos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Fotos</p>
                <div className="flex gap-2 flex-wrap">
                  {detalhe.fotos.map((foto) => (
                    <a key={foto.id} href={foto.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={foto.url}
                        alt="Foto"
                        className="w-24 h-24 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
