import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Building2,
  Wallet,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Banknote,
  CreditCard,
} from "lucide-react";

type TipoConta = "caixa" | "banco" | "digital";

const ETAPAS = [
  { id: 1, titulo: "Bem-vindo ao CobraPro!", descricao: "Vamos configurar sua conta em poucos passos" },
  { id: 2, titulo: "Nome da sua empresa", descricao: "Como se chama o seu negócio?" },
  { id: 3, titulo: "Conta de caixa inicial", descricao: "Configure onde você controla seu dinheiro" },
  { id: 4, titulo: "Tudo pronto!", descricao: "Sua conta está configurada e pronta para usar" },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [etapa, setEtapa] = useState(1);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nomeConta, setNomeConta] = useState("Caixa Principal");
  const [tipoConta, setTipoConta] = useState<TipoConta>("caixa");

  const completarMutation = trpc.onboarding.complete.useMutation({
    onSuccess: () => {
      setEtapa(4);
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
    },
  });

  const handleProximo = () => {
    if (etapa === 2 && !nomeEmpresa.trim()) {
      toast.error("Informe o nome da sua empresa");
      return;
    }
    if (etapa === 3) {
      completarMutation.mutate({ nomeEmpresa: nomeEmpresa.trim(), nomeConta, tipoConta });
      return;
    }
    setEtapa((e) => e + 1);
  };

  const handleVoltar = () => setEtapa((e) => e - 1);

  const tipoContaOpcoes: { value: TipoConta; label: string; descricao: string; icon: React.ReactNode }[] = [
    { value: "caixa", label: "Dinheiro em Caixa", descricao: "Controle de dinheiro físico", icon: <Banknote className="h-5 w-5" /> },
    { value: "banco", label: "Conta Bancária", descricao: "Banco tradicional (Bradesco, Itaú...)", icon: <CreditCard className="h-5 w-5" /> },
    { value: "digital", label: "Conta Digital", descricao: "Nubank, PicPay, Mercado Pago...", icon: <Smartphone className="h-5 w-5" /> },
  ];

  const progresso = ((etapa - 1) / (ETAPAS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-lg">C</span>
        </div>
        <span className="text-xl font-bold text-foreground">CobraPro</span>
      </div>

      {/* Barra de progresso */}
      {etapa < 4 && (
        <div className="w-full max-w-md mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Passo {etapa} de 3</span>
            <span>{Math.round(progresso)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      )}

      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardContent className="p-6">
          {/* Etapa 1 — Boas-vindas */}
          {etapa === 1 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Building2 className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Bem-vindo ao CobraPro!</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  O sistema completo para gerenciar seus empréstimos, cobranças e clientes de forma profissional.
                  Vamos configurar sua conta em menos de 1 minuto.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Contratos", desc: "Gerencie empréstimos" },
                  { label: "Parcelas", desc: "Controle cobranças" },
                  { label: "Relatórios", desc: "Veja resultados" },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
              <Button onClick={handleProximo} className="w-full gap-2" size="lg">
                Começar configuração <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Etapa 2 — Nome da empresa */}
          {etapa === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Nome da sua empresa</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Esse nome aparecerá nos contratos e relatórios
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nomeEmpresa">Nome da empresa ou seu nome</Label>
                <Input
                  id="nomeEmpresa"
                  placeholder="Ex: João Empréstimos, DG Financeira..."
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleProximo()}
                  autoFocus
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Pode ser alterado depois nas Configurações
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleVoltar} className="flex-1 gap-2">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button onClick={handleProximo} className="flex-1 gap-2">
                  Próximo <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Etapa 3 — Conta de caixa */}
          {etapa === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Wallet className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Conta de caixa</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Onde você vai controlar o dinheiro recebido?
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tipo de conta</Label>
                <div className="grid gap-2">
                  {tipoContaOpcoes.map((opcao) => (
                    <button
                      key={opcao.value}
                      onClick={() => setTipoConta(opcao.value)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        tipoConta === opcao.value
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tipoConta === opcao.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {opcao.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{opcao.label}</p>
                        <p className="text-xs text-muted-foreground">{opcao.descricao}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nomeConta">Nome da conta</Label>
                <Input
                  id="nomeConta"
                  placeholder="Ex: Caixa Principal, Bradesco..."
                  value={nomeConta}
                  onChange={(e) => setNomeConta(e.target.value)}
                  className="text-base"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleVoltar} className="flex-1 gap-2">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={handleProximo}
                  className="flex-1 gap-2"
                  disabled={completarMutation.isPending}
                >
                  {completarMutation.isPending ? "Salvando..." : <>Concluir <CheckCircle2 className="h-4 w-4" /></>}
                </Button>
              </div>
            </div>
          )}

          {/* Etapa 4 — Concluído */}
          {etapa === 4 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Tudo pronto! 🎉</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  <strong className="text-foreground">{nomeEmpresa}</strong> está configurada no CobraPro.
                  Sua conta de caixa foi criada e você já pode começar a cadastrar clientes e contratos.
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Próximos passos sugeridos</p>
                {[
                  "Cadastre seu primeiro cliente",
                  "Crie um contrato de empréstimo",
                  "Registre o valor no caixa",
                ].map((passo, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-sm text-muted-foreground">{passo}</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => setLocation("/dashboard")}
                className="w-full gap-2"
                size="lg"
              >
                Ir para o Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-6">
        CobraPro · Sistema de Gestão de Cobranças
      </p>
    </div>
  );
}
