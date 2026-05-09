import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShoppingBag, Plus, Package, TrendingUp, DollarSign, AlertCircle } from "lucide-react";
import { formatarMoeda } from "../../../shared/finance";
import { useLocation } from "wouter";

export default function Vendas() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [dialogProdutoAberto, setDialogProdutoAberto] = useState(false);
  const [produtoForm, setProdutoForm] = useState({
    nome: "",
    descricao: "",
    preco: "",
    estoque: "0",
  });

  const utils = trpc.useUtils();
  const { data: produtos, isLoading } = trpc.vendas.listarProdutos.useQuery();

  const criarProdutoMutation = trpc.vendas.criarProduto.useMutation({
    onSuccess: () => {
      utils.vendas.listarProdutos.invalidate();
      setDialogProdutoAberto(false);
      setProdutoForm({ nome: "", descricao: "", preco: "", estoque: "0" });
      toast.success(t('toast_success.produto_cadastrado_com_sucesso'));
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  function handleCriarProduto() {
    const preco = parseFloat(produtoForm.preco.replace(",", "."));
    if (!produtoForm.nome || !preco) {
      toast.error(t('toast_error.preencha_nome_e_preço_do_produto'));
      return;
    }
    criarProdutoMutation.mutate({
      nome: produtoForm.nome,
      descricao: produtoForm.descricao || undefined,
      preco,
      estoque: parseInt(produtoForm.estoque) || 0,
    });
  }

  function irParaNovoContrato(produtoId: number, produtoNome: string, preco: number) {
    const params = new URLSearchParams({
      modalidade: "venda_produto",
      descricao: `Venda: ${produtoNome}`,
      valorPrincipal: preco.toString(),
    });
    setLocation(`/contratos/novo?${params.toString()}`);
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <ShoppingBag className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('sales.productSales')}</h1>
            <p className="text-sm text-muted-foreground">Venda produtos a prazo e controle seu estoque</p>
          </div>
        </div>
        <Dialog open={dialogProdutoAberto} onOpenChange={setDialogProdutoAberto}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Produto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Nome do Produto *</Label>
                <Input
                  className="bg-background border-border"
                  placeholder="Ex: Smartphone Samsung"
                  value={produtoForm.nome}
                  onChange={(e) => setProdutoForm({ ...produtoForm, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Preço (R$) *</Label>
                  <Input
                    className="bg-background border-border"
                    placeholder="0,00"
                    value={produtoForm.preco}
                    onChange={(e) => setProdutoForm({ ...produtoForm, preco: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Estoque</Label>
                  <Input
                    className="bg-background border-border"
                    type="number"
                    min="0"
                    value={produtoForm.estoque}
                    onChange={(e) => setProdutoForm({ ...produtoForm, estoque: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  className="bg-background border-border resize-none"
                  placeholder="Descrição do produto..."
                  rows={2}
                  value={produtoForm.descricao}
                  onChange={(e) => setProdutoForm({ ...produtoForm, descricao: e.target.value })}
                />
              </div>
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleCriarProduto}
                disabled={criarProdutoMutation.isPending}
              >
                {criarProdutoMutation.isPending ? "Salvando..." : "Cadastrar Produto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info sobre o módulo */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-300">Como funciona</p>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre produtos com preço e estoque. Para vender a prazo, clique em "Vender a Prazo" e será criado um contrato 
              do tipo "Venda de Produto" com o cliente selecionado, taxa de juros e número de parcelas.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Produtos */}
      <div>
        <h2 className="text-base font-semibold mb-3">Produtos Cadastrados</h2>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando produtos...</div>
        ) : !produtos || produtos.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum produto cadastrado</p>
              <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Produto" para começar</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {produtos.map((produto) => (
              <Card key={produto.id} className="bg-card border-border hover:border-purple-500/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Package className="h-4 w-4 text-purple-400" />
                    </div>
                    <Badge
                      className={produto.estoque > 0
                        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                        : "text-red-400 bg-red-400/10 border-red-400/20"
                      }
                    >
                      {produto.estoque > 0 ? `${produto.estoque} em estoque` : "Sem estoque"}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{produto.nome}</h3>
                  {produto.descricao && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{produto.descricao}</p>
                  )}
                  <p className="text-xl font-bold text-purple-400 mb-3">
                    {formatarMoeda(parseFloat(produto.preco))}
                  </p>
                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm"
                    size="sm"
                    onClick={() => irParaNovoContrato(produto.id, produto.nome, parseFloat(produto.preco))}
                  >
                    <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                    Vender a Prazo
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
