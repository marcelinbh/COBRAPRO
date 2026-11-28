import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ShoppingBag, Plus, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { formatarMoeda } from '../../../shared/finance';
import { catalogoPertenceAoOwner, validarProdutoForm, type ProdutoForm, type ProdutoInput } from '../lib/vendasProdutoForm';

const EMPTY_FORM: ProdutoForm = Object.freeze({ nome: '', descricao: '', preco: '', estoque: '0' });
type PedidoProduto = { form: ProdutoForm; input: ProdutoInput; status: 'pending' | 'uncertain' };
// Somente memória da aba. O pedido ativo protege seu snapshot e o singleflight;
// separar uma intenção incerta não cancela/resolve/reenvia a operação anterior.
const pedidosPorOwner = new Map<number, PedidoProduto>();
const historicoPorOwner = new Map<number, PedidoProduto[]>();
const listenersPorOwner = new Map<number, Set<() => void>>();
function marcarIncerto(owner: number, request: PedidoProduto) {
  request.status = 'uncertain';
  // Apenas a intenção ainda ativa do mesmo owner notifica consumidores atuais.
  if (pedidosPorOwner.get(owner) === request) listenersPorOwner.get(owner)?.forEach(listener => listener());
}
let nextMount = 0;
const INCERTO = 'Resultado incerto: o produto pode ter sido cadastrado. Repetir ou recadastrar o mesmo produto pode duplicar. Confira o catálogo por leitura; essa consulta não prova execução nem não execução. Para um novo cadastro, use Iniciar outro produto ou Novo Produto: apenas a intenção da interface será separada, sem reenviar o pedido anterior.';

export default function Vendas() {
  const { t } = useTranslation();
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 0 });
  const ownerId = auth.data?.id;
  const owner = !auth.isError && !auth.isLoading && !auth.isPending && !auth.isFetching &&
    typeof ownerId === 'number' && Number.isInteger(ownerId) && ownerId > 0 && ownerId <= 2147483647 ? ownerId : null;
  const mount = useRef(0);
  if (!mount.current) mount.current = ++nextMount;
  const mounted = useRef(true);
  const scope = useRef<{ owner: number | null; generation: number }>({ owner, generation: 0 });
  const pendingRef = useRef(false);
  const actionRef = useRef(0);
  // Síncrono: A→B→A e revalidação de auth invalidam callbacks antes dos effects.
  if (scope.current.owner !== owner) {
    scope.current = { owner, generation: scope.current.generation + 1 };
    pendingRef.current = false;
    actionRef.current++;
  }
  const generation = scope.current.generation;
  const action = actionRef.current;
  const isCurrent = () => mounted.current && scope.current.owner === owner && scope.current.generation === generation;
  const isCurrentAction = () => isCurrent() && actionRef.current === action;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const [ui, setUi] = useState({ generation, open: false, form: EMPTY_FORM, financeiro: false });
  const [, refreshLocal] = useState(0);
  useEffect(() => {
    if (owner === null) return;
    const listeners = listenersPorOwner.get(owner) ?? new Set<() => void>();
    listenersPorOwner.set(owner, listeners);
    const update = () => { if (isCurrent()) refreshLocal(n => n + 1); };
    listeners.add(update);
    update(); // Fecha a janela entre render e assinatura se o pedido acabou nesse intervalo.
    return () => {
      listeners.delete(update);
      if (listeners.size === 0) listenersPorOwner.delete(owner);
    };
  }, [owner, generation]);
  // Nunca renderiza formulário/modais da geração anterior, nem por um frame.
  const currentUi = ui.generation === generation ? ui : { generation, open: false, form: EMPTY_FORM, financeiro: false };
  const pedido = owner === null ? undefined : pedidosPorOwner.get(owner);
  const historico = owner === null ? [] : historicoPorOwner.get(owner) ?? [];
  const produtoForm = pedido?.form ?? currentUi.form;
  const setForm = (field: keyof ProdutoForm, value: string) => {
    if (!isCurrentAction() || owner === null || pendingRef.current || pedidosPorOwner.has(owner)) return;
    setUi({ ...currentUi, form: { ...produtoForm, [field]: value } });
  };
  const cachePrefix = `vendas73:${mount.current}:${owner ?? 'unconfirmed'}:${generation}:`;
  const utils = trpc.useUtils();
  const catalogo = trpc.vendas.listarProdutos.useQuery(undefined, {
    enabled: owner !== null, retry: false, staleTime: 0, gcTime: 0,
    refetchOnMount: 'always', refetchOnWindowFocus: false,
    trpc: { abortOnUnmount: true },
    // Isola cache local sem enviar owner em input; autorização continua ctx-only no backend.
    queryKeyHashFn: key => cachePrefix + JSON.stringify(key),
  });
  const wrongOwner = owner !== null && catalogo.data !== undefined && !catalogoPertenceAoOwner(catalogo.data, owner);
  const readError = catalogo.isError || wrongOwner;
  const reading = catalogo.isLoading || catalogo.isPending || catalogo.isFetching;
  const ready = owner !== null && !readError && !reading && Array.isArray(catalogo.data);
  const liveReady = useRef(ready);
  liveReady.current = ready;
  // Criar produto não é financeiro e não depende de sucesso da leitura do catálogo.
  const inFlight = pendingRef.current || pedido?.status === 'pending';
  const cannotStart = owner === null || inFlight;
  const blocked = cannotStart || !!pedido;
  const mutation = trpc.vendas.criarProduto.useMutation({ retry: false });

  function iniciarOutroProduto() {
    if (!isCurrentAction() || owner === null || pendingRef.current) return;
    const previous = pedidosPorOwner.get(owner);
    if (previous?.status !== 'uncertain') return;
    historicoPorOwner.set(owner, [...(historicoPorOwner.get(owner) ?? []), previous]);
    pedidosPorOwner.delete(owner); // Só separa intenção UI; nunca rollback ou confirmação DB.
    actionRef.current++; // Handler do snapshot antigo não vale para a ação nova.
    setUi({ generation, open: true, form: EMPTY_FORM, financeiro: false });
    refreshLocal(n => n + 1);
  }

  function openDialog(open: boolean) {
    if (!isCurrentAction() || owner === null || pendingRef.current || pedidosPorOwner.get(owner)?.status === 'pending') return;
    if (open && pedidosPorOwner.get(owner)?.status === 'uncertain') { iniciarOutroProduto(); return; }
    setUi({ ...currentUi, open });
  }

  async function conferirCatalogo() {
    if (!isCurrent() || owner === null || catalogo.isFetching) return;
    // Consulta RO somente. Rows iguais ou vazios não resolvem a operação incerta.
    await catalogo.refetch().catch(() => undefined);
  }

  async function handleCriarProduto() {
    if (!isCurrentAction() || owner === null || pendingRef.current || pedidosPorOwner.has(owner)) return;
    const snapshot: ProdutoForm = Object.freeze({ ...produtoForm });
    const validation = validarProdutoForm(snapshot);
    if (!validation.ok) { toast.error(validation.message); return; }
    const request: PedidoProduto = { form: snapshot, input: validation.input, status: 'pending' };
    pendingRef.current = true; // antes da primeira promise/rerender, não somente isPending.
    pedidosPorOwner.set(owner, request);
    refreshLocal(n => n + 1);
    try {
      const result = await mutation.mutateAsync(request.input);
      if (!result || result.success !== true || !Number.isInteger(result.id) || result.id <= 0) throw new Error('Resposta não confirmada');
      if (!isCurrent()) { marcarIncerto(owner, request); return; }
      pedidosPorOwner.delete(owner);
      actionRef.current++;
      setUi({ generation, open: false, form: EMPTY_FORM, financeiro: false });
      // Não invalida leituras de outras gerações/owners no mesmo namespace tRPC.
      void utils.vendas.listarProdutos.invalidate(undefined, {
        predicate: query => query.queryHash.startsWith(cachePrefix),
      }).catch(() => undefined);
      toast.success(t('toast_success.produto_cadastrado_com_sucesso'));
    } catch {
      marcarIncerto(owner, request);
      if (isCurrent()) toast.error(INCERTO);
    } finally {
      // Sem efeitos de sucesso antigos; o store só sinaliza incerteza ao consumidor atual do mesmo owner.
      if (isCurrent()) { pendingRef.current = false; refreshLocal(n => n + 1); }
    }
  }

  function conferirVendaPrazo() {
    if (!isCurrentAction() || !liveReady.current) return;
    setUi({ ...currentUi, financeiro: true });
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10"><ShoppingBag className="h-6 w-6 text-purple-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('sales.productSales')}</h1>
            <p className="text-sm text-muted-foreground">Catálogo de produtos e estoque cadastrado</p>
          </div>
        </div>
        <Dialog open={currentUi.open} onOpenChange={openDialog}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled={cannotStart} onClick={() => openDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader><DialogTitle>Cadastrar Produto</DialogTitle></DialogHeader>
            {pedido?.status === 'uncertain' && <p role="alert" className="text-sm">{INCERTO}</p>}
            {!pedido && historico.length > 0 && <p role="alert" className="text-sm">Há cadastro anterior com resultado incerto. Repetir o mesmo produto pode duplicar. Este formulário é uma nova ação e não reenvia o pedido anterior.</p>}
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="produto-nome">Nome do Produto *</Label>
                <Input id="produto-nome" className="bg-background border-border" placeholder="Ex: Smartphone Samsung" value={produtoForm.nome} disabled={blocked} onChange={e => setForm('nome', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="produto-preco">{t('sales.price')}</Label>
                  <Input id="produto-preco" className="bg-background border-border" inputMode="decimal" placeholder="0,00" value={produtoForm.preco} disabled={blocked} onChange={e => setForm('preco', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="produto-estoque">Estoque</Label>
                  <Input id="produto-estoque" className="bg-background border-border" inputMode="numeric" placeholder="0" value={produtoForm.estoque} disabled={blocked} onChange={e => setForm('estoque', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="produto-descricao">{t('sales.description')}</Label>
                <Textarea id="produto-descricao" className="bg-background border-border resize-none" placeholder={t('sales.descriptionPlaceholder')} rows={2} value={produtoForm.descricao} disabled={blocked} onChange={e => setForm('descricao', e.target.value)} />
              </div>
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" onClick={handleCriarProduto} disabled={blocked}>
                {pedido?.status === 'pending' ? 'Salvando... — Cadastrar Produto' : 'Cadastrar Produto'}
              </Button>
              {pedido?.status === 'uncertain' && <Button disabled={cannotStart} onClick={iniciarOutroProduto}>Iniciar outro produto</Button>}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-300">Como funciona</p>
            <p className="text-sm text-muted-foreground mt-1">Cadastre produtos com preço e estoque inicial. O fluxo financeiro de venda a prazo ainda está em implementação; este catálogo não cria empréstimo, contrato ou movimentação financeira.</p>
          </div>
        </CardContent>
      </Card>
      {currentUi.financeiro && <p role="alert" className="rounded-lg border p-4">Venda a prazo: fluxo financeiro ainda em implementação. Nenhuma venda ou empréstimo foi criado. Aguarde um fluxo próprio de Vendas; não use Novo empréstimo como substituto.</p>}
      {pedido?.status === 'uncertain' && <div role="alert" className="rounded-lg border p-4 space-y-3">
        <p>{INCERTO}</p>
        <Button disabled={!isCurrent() || owner === null || catalogo.isFetching} onClick={conferirCatalogo}>Conferir catálogo (somente leitura)</Button>
        <Button disabled={cannotStart} onClick={iniciarOutroProduto}>Iniciar outro produto</Button>
      </div>}
      {historico.length > 0 && <details className="rounded-lg border p-4">
        <summary>Cadastros anteriores com resultado incerto (somente memória desta aba)</summary>
        <p>Não foram cancelados nem reenviados. Repetir o mesmo produto pode duplicar; uma leitura do catálogo não comprova rollback.</p>
        {historico.map((anterior, index) => <p key={index}>Snapshot anterior: {anterior.form.nome} — preço informado: {anterior.form.preco}; estoque informado: {anterior.form.estoque}; descrição: {anterior.form.descricao}</p>)}
      </details>}

      <div>
        <h2 className="text-base font-semibold mb-3">Produtos Cadastrados</h2>
        {owner === null ? <div role="alert" className="rounded-lg border p-4 space-y-3">
          <p>Não foi possível confirmar a sessão para exibir o catálogo. Cadastro desabilitado.</p>
          <Button disabled={auth.isFetching} onClick={() => { if (isCurrent()) void auth.refetch().catch(() => undefined); }}>Confirmar sessão novamente</Button>
        </div> : readError ? <div role="alert" className="rounded-lg border p-4 space-y-3">
          <p>Não foi possível confirmar o catálogo desta empresa. Isso não significa catálogo vazio. O cadastro de produto continua disponível com sessão confirmada; tente a leitura novamente.</p>
          <Button disabled={catalogo.isFetching} onClick={conferirCatalogo}>Tentar leitura novamente</Button>
        </div> : !ready ? <div role="status" className="text-center py-8 text-muted-foreground">Carregando produtos...</div> : catalogo.data!.length === 0 ? (
          <Card className="bg-card border-border"><CardContent className="py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum produto cadastrado</p>
            {!pedido && <p className="text-sm text-muted-foreground mt-1">{t('sales.clickNewProduct')}</p>}
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalogo.data!.map(produto => (
              <Card key={produto.id} className="bg-card border-border hover:border-purple-500/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-purple-500/10"><Package className="h-4 w-4 text-purple-400" /></div>
                    <Badge className={produto.estoque !== null && produto.estoque > 0 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-red-400 bg-red-400/10 border-red-400/20'}>{produto.estoque === null ? 'Estoque não informado' : produto.estoque > 0 ? `${produto.estoque} em estoque` : 'Sem estoque'}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{produto.nome}</h3>
                  {produto.descricao && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{produto.descricao}</p>}
                  <p className="text-xl font-bold text-purple-400 mb-3">{formatarMoeda(Number(produto.preco))}</p>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm" size="sm" onClick={conferirVendaPrazo}>
                    <TrendingUp className="h-3.5 w-3.5 mr-1.5" />Conferir venda a prazo
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
