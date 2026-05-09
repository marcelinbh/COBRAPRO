#!/usr/bin/env python3
"""Replace EditarEmprestimoModal (lines 71-438) with the unified version."""

NEW_COMPONENT = r'''// ─── MODAL UNIFICADO DE EMPRÉSTIMO (Editar + Detalhes + Histórico + Comprovante) ─
function EditarEmprestimoModal({
  emprestimo,
  onClose,
  onSuccess,
  abaInicial = 'editar',
}: {
  emprestimo: EmprestimoCard;
  onClose: () => void;
  onSuccess: () => void;
  abaInicial?: 'editar' | 'detalhes' | 'historico' | 'comprovante';
}) {
  const { t } = useTranslation();
  const [aba, setAba] = useState<'editar' | 'detalhes' | 'historico' | 'comprovante'>(abaInicial);

  // ── Estados da aba Editar ──
  const [valor, setValor] = useState(parseFloat(emprestimo.valorPrincipal));
  const [juros, setJuros] = useState(parseFloat(emprestimo.taxaJuros));
  const [tipo, setTipo] = useState(emprestimo.tipoTaxa);
  const [parcelas, setParcelas] = useState(emprestimo.numeroParcelas);
  const [jurosAplicado, setJurosAplicado] = useState("total");
  const [dataContrato, setDataContrato] = useState(formatarData(emprestimo.dataInicio));
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(
    emprestimo.proximaParcela ? formatarData(emprestimo.proximaParcela.data_vencimento) : ""
  );
  const [novaParcelaData, setNovaParcelaData] = useState("");
  const [novaParcelaValor, setNovaParcelaValor] = useState("");
  const [showNovaParcela, setShowNovaParcela] = useState(false);

  // ── Estados da aba Detalhes ──
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendente' | 'paga' | 'atrasada'>('todas');
  const [parcelaEditando, setParcelaEditando] = useState<{ id: number; valor: string; data: string } | null>(null);
  const [showNovaParcelaDetalhes, setShowNovaParcelaDetalhes] = useState(false);
  const [novaParcelaDataDetalhes, setNovaParcelaDataDetalhes] = useState("");
  const [novaParcelaValorDetalhes, setNovaParcelaValorDetalhes] = useState("");

  // ── Estados dos modais de ação ──
  const [modalPagar, setModalPagar] = useState(false);
  const [modalPagarJuros, setModalPagarJuros] = useState(false);
  const [modalEditarJuros, setModalEditarJuros] = useState(false);
  const [modalMulta, setModalMulta] = useState(false);
  const [modalDeletar, setModalDeletar] = useState(false);
  const [contaCaixaId, setContaCaixaId] = useState('');
  const [valorCustomPagar, setValorCustomPagar] = useState('');
  const [valorCustomJuros, setValorCustomJuros] = useState('');
  const [novaTaxa, setNovaTaxa] = useState('');
  const [valorMulta, setValorMulta] = useState('');
  const [dataPagamentoCustom, setDataPagamentoCustom] = useState('');
  const [jurosCustomDetalhes, setJurosCustomDetalhes] = useState('');
  const [novaDataVencJuros, setNovaDataVencJuros] = useState('');
  const [novoValorParcelaJuros, setNovoValorParcelaJuros] = useState('');
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [loadingWpp, setLoadingWpp] = useState(false);
  const [pagamentoRealizado, setPagamentoRealizado] = useState<{ valorPago: number; parcelaNum: number } | null>(null);

  const jurosTotal = valor * (juros / 100);
  const valorParcela = (valor + jurosTotal) / parcelas;
  const totalReceber = valor + jurosTotal;

  const utils = trpc.useUtils();

  // Buscar dados completos para abas Detalhes/Histórico
  const { data: detalhes, refetch: refetchDetalhes } = trpc.contratos.obterDetalhes.useQuery(
    { id: emprestimo.id },
    { enabled: aba === 'detalhes' || aba === 'historico' || aba === 'comprovante' }
  );
  const { data: contas } = trpc.caixa.contas.useQuery();
  const { data: config } = trpc.configuracoes.get.useQuery();
  const { data: historico, isLoading: historicoLoading } = trpc.contratos.historico.useQuery(
    { contratoId: emprestimo.id },
    { enabled: aba === 'historico' }
  );

  const invalidarTudo = () => {
    utils.contratos.list.invalidate();
    utils.contratos.listComParcelas.invalidate();
    utils.dashboard.kpis.invalidate();
    refetchDetalhes();
    onSuccess();
  };

  // ── Mutations ──
  const editarMutation = trpc.contratos.editar.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.empréstimo_atualizado_com_sucesso'));
      invalidarTudo();
      onClose();
    },
    onError: (err) => toast.error('Erro ao atualizar: ' + err.message),
  });

  const criarParcelaMutation = trpc.parcelas.criarParcela.useMutation({
    onSuccess: (data) => {
      toast.success(`Parcela #${data.numeroParcela} criada com sucesso!`);
      setNovaParcelaData(""); setNovaParcelaValor(""); setShowNovaParcela(false);
      setNovaParcelaDataDetalhes(""); setNovaParcelaValorDetalhes(""); setShowNovaParcelaDetalhes(false);
      invalidarTudo();
    },
    onError: (err) => toast.error('Erro ao criar parcela: ' + err.message),
  });

  const editarParcelaMutation = trpc.parcelas.editarParcela.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.parcela_atualizada'));
      setParcelaEditando(null);
      invalidarTudo();
    },
    onError: (e: any) => toast.error('Erro ao atualizar parcela: ' + e.message),
  });

  const pagarTotalMutation = trpc.parcelas.registrarPagamento.useMutation({
    onSuccess: (_data, variables) => {
      const parcelaNum = detalhes?.todasParcelas?.find((p: any) => p.id === variables.parcelaId)?.numero_parcela ?? 1;
      setPagamentoRealizado({ valorPago: variables.valorPago, parcelaNum });
      toast.success(t('toast_success.pagamento_registrado'));
      invalidarTudo();
    },
    onError: (e) => toast.error('Erro ao registrar pagamento: ' + e.message),
  });

  const pagarJurosMutation = trpc.parcelas.pagarJuros.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.juros_pagos_empréstimo_renovado'));
      setModalPagarJuros(false);
      invalidarTudo();
    },
    onError: (e) => toast.error('Erro ao pagar juros: ' + e.message),
  });

  const editarJurosMutation = trpc.contratos.editarJuros.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.taxa_de_juros_atualizada'));
      setModalEditarJuros(false); setNovaTaxa('');
      invalidarTudo();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const aplicarMultaMutation = trpc.contratos.aplicarMulta.useMutation({
    onSuccess: () => {
      toast.success(t('toast_success.multa_aplicada_com_sucesso'));
      setModalMulta(false); setValorMulta('');
      invalidarTudo();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const handleSalvar = () => {
    editarMutation.mutate({
      id: emprestimo.id,
      valorPrincipal: valor,
      taxaJuros: String(juros),
      tipoTaxa: tipo,
      numeroParcelas: parcelas,
      dataPrimeiraParcela: dataPrimeiraParcela || undefined,
    });
  };

  const handleCriarParcela = (dataVenc: string, valorP: string) => {
    if (!dataVenc) { toast.error(t('toast_error.informe_a_data_de_vencimento')); return; }
    if (!valorP || parseFloat(valorP) <= 0) { toast.error(t('toast_error.informe_o_valor_da_parcela')); return; }
    criarParcelaMutation.mutate({ contratoId: emprestimo.id, dataVencimento: dataVenc, valorOriginal: parseFloat(valorP) });
  };

  const parcela = emprestimo.proximaParcela ?? emprestimo.parcelasComAtraso[0];
  const valorOriginalParcela = parcela ? parseFloat(String(parcela.valor_original ?? '0')) : 0;
  const valorJurosParcela = emprestimo.valorJurosParcela;
  const parcelaComAtraso = parcela ? emprestimo.parcelasComAtraso.find(p => p.id === parcela.id) : undefined;
  const diasAtraso = parcelaComAtraso?.diasAtraso ?? 0;
  const totalComAtraso = parcelaComAtraso?.totalComAtraso ?? valorOriginalParcela;
  const isQuitado = emprestimo.status === 'quitado';

  const handlePagar = () => {
    if (!contaCaixaId) { toast.error(t('toast_error.selecione_uma_conta')); return; }
    if (!parcela) { toast.error(t('toast_error.nenhuma_parcela_pendente')); return; }
    const v = valorCustomPagar ? parseFloat(valorCustomPagar) : (diasAtraso > 0 ? totalComAtraso : valorOriginalParcela);
    const jurosVal = jurosCustomDetalhes ? parseFloat(jurosCustomDetalhes) : undefined;
    pagarTotalMutation.mutate({ parcelaId: parcela.id, valorPago: v, contaCaixaId: parseInt(contaCaixaId), valorJurosCustom: jurosVal, dataPagamento: dataPagamentoCustom || undefined });
  };

  const handlePagarJuros = () => {
    if (!contaCaixaId) { toast.error(t('toast_error.selecione_uma_conta')); return; }
    if (!parcela) { toast.error(t('toast_error.nenhuma_parcela_pendente')); return; }
    const v = valorCustomJuros ? parseFloat(valorCustomJuros) : valorJurosParcela;
    pagarJurosMutation.mutate({ parcelaId: parcela.id, valorJurosPago: v, contaCaixaId: parseInt(contaCaixaId), novaDataVencimento: novaDataVencJuros || undefined, novoValorParcela: novoValorParcelaJuros ? parseFloat(novoValorParcelaJuros) : undefined });
  };

  const handleWhatsApp = async () => {
    if (!emprestimo.clienteWhatsapp) { toast.error(t('toast_error.telefone_whatsapp_não_cadastrado')); return; }
    setLoadingWpp(true);
    try {
      const result = await utils.client.whatsapp.gerarMensagemContrato.query({ contratoId: emprestimo.id, tipo: diasAtraso > 0 ? 'atraso' : 'preventivo' });
      if (result.whatsappUrl) window.open(result.whatsappUrl, '_blank');
      else toast.error(t('toast_error.não_foi_possível_gerar_o_link_do_whatsap'));
    } catch {
      const msg = diasAtraso > 0
        ? `⚠️ Olá ${emprestimo.clienteNome}, você tem parcela(s) em atraso. Favor regularizar o quanto antes.`
        : `🟢 Olá ${emprestimo.clienteNome}! Lembrete: você tem parcela vencendo em breve. Fique em dia!`;
      window.open(`https://wa.me/55${emprestimo.clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    } finally {
      setLoadingWpp(false);
    }
  };

  const handleGerarComprovante = async () => {
    setGerandoPDF(true);
    try {
      const parcelaPaga = detalhes?.todasParcelas?.find((p: any) => p.status === 'paga') || detalhes?.todasParcelas?.[0];
      await gerarComprovantePDF({
        clienteNome: emprestimo.clienteNome,
        contratoId: emprestimo.id,
        parcelaNumero: parcelaPaga?.numero_parcela ?? 1,
        valorOriginal: parcelaPaga?.valor_original ?? emprestimo.valorPrincipal,
        juros: parcelaPaga?.valor_juros ?? 0,
        valorPago: parcelaPaga?.valor_pago ?? parcelaPaga?.valor_original ?? emprestimo.valorPrincipal,
        dataPagamento: parcelaPaga?.data_pagamento ?? new Date().toISOString(),
        modalidade: emprestimo.modalidade,
        nomeEmpresa: config?.nomeEmpresa || 'CobraPro',
        logoUrl: config?.logoUrl || undefined,
        enderecoEmpresa: config?.enderecoEmpresa || undefined,
        telefoneEmpresa: config?.telefoneEmpresa || undefined,
      });
      toast.success(t('toast_success.comprovante_gerado'));
    } catch {
      toast.error(t('toast_error.erro_ao_gerar_comprovante'));
    } finally {
      setGerandoPDF(false);
    }
  };

  const tipoLabel: Record<string, string> = {
    pagamento: 'Pagamento', pagamento_juros: 'Pagamento de Juros', edicao_juros: 'Edição de Juros',
    aplicacao_multa: 'Multa Aplicada', edicao_parcela: 'Edição de Parcela', edicao_contrato: 'Edição de Contrato',
    reparcelamento: 'Reparcelamento', criacao: 'Criação',
  };
  const tipoColor: Record<string, string> = {
    pagamento: 'text-emerald-400', pagamento_juros: 'text-amber-400', edicao_juros: 'text-blue-400',
    aplicacao_multa: 'text-red-400', edicao_parcela: 'text-purple-400', edicao_contrato: 'text-cyan-400',
    reparcelamento: 'text-orange-400', criacao: 'text-green-400',
  };

  const abas = [
    { id: 'editar', label: '✏️ Editar' },
    { id: 'detalhes', label: '📋 Detalhes' },
    { id: 'historico', label: '📜 Histórico' },
    { id: 'comprovante', label: '📄 Comprovante' },
  ] as const;

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-0 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-lg">{emprestimo.clienteNome}</DialogTitle>
            <DialogDescription>{emprestimo.modalidade} · {emprestimo.taxaJuros}% {emprestimo.tipoTaxa}</DialogDescription>
          </DialogHeader>
          {/* Abas */}
          <div className="flex gap-1 mt-4 border-b border-border">
            {abas.map(a => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  aba === a.id ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ─── ABA EDITAR ─── */}
          {aba === 'editar' && (
            <div className="space-y-5">
              {/* Cliente */}
              <div className="p-3 rounded-lg border border-border bg-muted/30 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  {emprestimo.clienteNome.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className="font-semibold text-sm">{emprestimo.clienteNome}</div>
                  <div className="text-xs text-muted-foreground">{emprestimo.clienteWhatsapp}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor (R$) *</Label>
                  <Input type="number" step="0.01" value={valor} onChange={e => setValor(parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label>Juros (%) *</Label>
                  <Input type="number" step="0.01" value={juros} onChange={e => setJuros(parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Pagamento</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diario">Diário</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Parcelas</Label>
                  <Input type="number" value={parcelas} onChange={e => setParcelas(parseInt(e.target.value) || 1)} className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Juros Aplicado</Label>
                <Select value={jurosAplicado} onValueChange={setJurosAplicado}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Sobre o Total</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-muted/30 border border-border">
                <div><div className="text-xs text-muted-foreground">Juros Total</div><div className="text-base font-bold text-emerald-400">{formatarMoeda(jurosTotal)}</div></div>
                <div><div className="text-xs text-muted-foreground">Valor Parcela</div><div className="text-base font-bold text-emerald-400">{formatarMoeda(valorParcela)}</div></div>
                <div><div className="text-xs text-muted-foreground">Total a Receber</div><div className="text-base font-bold text-emerald-400">{formatarMoeda(totalReceber)}</div></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data do Contrato</Label>
                  <Input type="date" value={dataContrato.split('/').reverse().join('-')} onChange={e => setDataContrato(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>1ª Parcela *</Label>
                  <Input type="date" value={dataPrimeiraParcela.split('/').reverse().join('-')} onChange={e => setDataPrimeiraParcela(e.target.value)} className="mt-1" />
                </div>
              </div>

              {/* Parcelas existentes */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                  <Label className="text-sm font-semibold">Parcelas do Contrato</Label>
                  <button type="button" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium" onClick={() => setShowNovaParcela(!showNovaParcela)}>
                    <span className="text-base leading-none">+</span> Criar Parcela
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left px-3 py-2 text-muted-foreground">#</th>
                        <th className="text-left px-3 py-2 text-muted-foreground">Vencimento</th>
                        <th className="text-right px-3 py-2 text-muted-foreground">Valor</th>
                        <th className="text-right px-3 py-2 text-muted-foreground">Multa</th>
                        <th className="text-center px-3 py-2 text-muted-foreground">Renov.</th>
                        <th className="text-center px-3 py-2 text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(emprestimo.todasParcelas ?? []).length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhuma parcela</td></tr>
                      ) : (
                        (emprestimo.todasParcelas ?? []).map((p: any) => (
                          <tr key={p.id} className="border-b border-border/50 hover:bg-muted/10">
                            <td className="px-3 py-2 font-medium">{p.numero_parcela}</td>
                            <td className="px-3 py-2">{formatarData(p.data_vencimento)}</td>
                            <td className="px-3 py-2 text-right">{formatarMoeda(parseFloat(p.valor_original ?? '0'))}</td>
                            <td className="px-3 py-2 text-right text-amber-400">{parseFloat(p.valor_multa ?? '0') > 0 ? formatarMoeda(parseFloat(p.valor_multa)) : '-'}</td>
                            <td className="px-3 py-2 text-center">{p.contagem_renovacoes > 0 ? <span className="text-blue-400">{p.contagem_renovacoes}x</span> : <span className="text-muted-foreground">-</span>}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                p.status === 'paga' ? 'bg-emerald-500/20 text-emerald-400' :
                                p.status === 'atrasada' ? 'bg-red-500/20 text-red-400' :
                                p.status === 'vencendo_hoje' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : p.status === 'vencendo_hoje' ? 'Hoje' : 'Pendente'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {showNovaParcela && (
                  <div className="px-4 py-3 border-t border-border bg-emerald-500/5 space-y-3">
                    <div className="text-xs font-semibold text-emerald-400">Nova Parcela</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Data de Vencimento *</Label>
                        <Input type="date" value={novaParcelaData} onChange={e => setNovaParcelaData(e.target.value)} className="mt-1 h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Valor (R$) *</Label>
                        <Input type="number" step="0.01" min="0.01" placeholder={formatarMoeda(valorParcela)} value={novaParcelaValor} onChange={e => setNovaParcelaValor(e.target.value)} className="mt-1 h-8 text-xs" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { setShowNovaParcela(false); setNovaParcelaData(""); setNovaParcelaValor(""); }}>Cancelar</Button>
                      <Button size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handleCriarParcela(novaParcelaData, novaParcelaValor)} disabled={criarParcelaMutation.isPending}>
                        {criarParcelaMutation.isPending ? 'Criando...' : 'Confirmar Parcela'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de ação rápida */}
              {!isQuitado && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setValorCustomPagar(''); setContaCaixaId(''); setPagamentoRealizado(null); setModalPagar(true); }}>
                    <DollarSign className="h-3.5 w-3.5" /> Pagar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setValorCustomJuros(''); setContaCaixaId(''); setModalPagarJuros(true); }}>
                    <TrendingUp className="h-3.5 w-3.5" /> Pagar Juros
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setNovaTaxa(String(emprestimo.taxaJuros)); setModalEditarJuros(true); }}>
                    <Edit2 className="h-3.5 w-3.5" /> Editar Juros
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setValorMulta(''); setModalMulta(true); }}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Aplicar Multa
                  </Button>
                  {emprestimo.clienteWhatsapp && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={handleWhatsApp} disabled={loadingWpp}>
                      {loadingWpp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />} WhatsApp
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setModalDeletar(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Deletar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ─── ABA DETALHES ─── */}
          {aba === 'detalhes' && (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Total a Receber', value: formatarMoeda(emprestimo.totalReceber) },
                  { label: 'Total Pago', value: formatarMoeda(emprestimo.totalPago), cls: 'text-green-500' },
                  { label: 'Parcelas Pagas', value: `${emprestimo.parcelasPagas}/${emprestimo.numeroParcelas}` },
                  { label: 'Taxa de Juros', value: `${emprestimo.taxaJuros}% ${emprestimo.tipoTaxa}` },
                  { label: 'Parcelas Abertas', value: String(emprestimo.parcelasAbertas) },
                  { label: 'Só Juros/Parcela', value: formatarMoeda(emprestimo.valorJurosParcela), cls: 'text-amber-400' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={`text-base font-bold ${cls ?? 'text-foreground'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tabela de parcelas editáveis */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Todas as Parcelas</p>
                  <div className="flex gap-1">
                    {(['todas', 'pendente', 'paga', 'atrasada'] as const).map(f => (
                      <button key={f} onClick={() => setFiltroStatus(f)}
                        className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                          filtroStatus === f ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}>
                        {f === 'todas' ? 'Todas' : f === 'pendente' ? 'Pendentes' : f === 'paga' ? 'Pagas' : 'Atrasadas'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">#</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Vencimento</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Valor</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">Status</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">Editar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detalhes?.todasParcelas ?? emprestimo.todasParcelas)
                        ?.filter((p: any) => filtroStatus === 'todas' || p.status === filtroStatus)
                        .map((p: any) => (
                          parcelaEditando?.id === p.id ? (
                            <tr key={p.id} className="border-b border-border/50 bg-muted/20">
                              <td className="px-3 py-2">#{p.numero_parcela}</td>
                              <td className="px-2 py-1">
                                <Input type="date" value={parcelaEditando.data} onChange={e => setParcelaEditando(prev => prev ? { ...prev, data: e.target.value } : null)} className="h-7 text-xs w-36" />
                              </td>
                              <td className="px-2 py-1 text-right">
                                <Input type="number" step="0.01" value={parcelaEditando.valor} onChange={e => setParcelaEditando(prev => prev ? { ...prev, valor: e.target.value } : null)} className="h-7 text-xs w-28 text-right" />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant={p.status === 'paga' ? 'default' : p.status === 'atrasada' ? 'destructive' : 'secondary'}>
                                  {p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : 'Pendente'}
                                </Badge>
                              </td>
                              <td className="px-2 py-1 text-center">
                                <div className="flex gap-1 justify-center">
                                  <button onClick={() => editarParcelaMutation.mutate({ parcelaId: p.id, novoValor: parcelaEditando ? (parseFloat(parcelaEditando.valor) || undefined) : undefined, novaDataVencimento: parcelaEditando ? (parcelaEditando.data || undefined) : undefined })} disabled={editarParcelaMutation.isPending} className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white" title="Salvar">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => setParcelaEditando(null)} className="p-1 rounded bg-muted hover:bg-muted/80 text-foreground" title="Cancelar">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="px-3 py-2">#{p.numero_parcela}</td>
                              <td className="px-3 py-2">{formatarData(p.data_vencimento)}</td>
                              <td className="px-3 py-2 text-right">{formatarMoeda(p.valor_original)}</td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant={p.status === 'paga' ? 'default' : p.status === 'atrasada' ? 'destructive' : 'secondary'}>
                                  {p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : 'Pendente'}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {p.status !== 'paga' && (
                                  <button onClick={() => setParcelaEditando({ id: p.id, valor: String(parseFloat(p.valor_original).toFixed(2)), data: p.data_vencimento?.split('T')[0] ?? '' })} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Editar parcela">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        ))}
                    </tbody>
                  </table>
                </div>
                {/* Adicionar nova parcela */}
                {!isQuitado && (
                  <div className="mt-3">
                    {!showNovaParcelaDetalhes ? (
                      <button onClick={() => setShowNovaParcelaDetalhes(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">
                        <span className="text-base leading-none">⊕</span> Adicionar Nova Parcela
                      </button>
                    ) : (
                      <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                        <p className="text-sm font-semibold text-foreground">Nova Parcela</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Data de Vencimento *</Label>
                            <Input type="date" value={novaParcelaDataDetalhes} onChange={e => setNovaParcelaDataDetalhes(e.target.value)} className="mt-1 h-8 text-sm [color-scheme:dark]" />
                          </div>
                          <div>
                            <Label className="text-xs">Valor (R$)</Label>
                            <Input type="number" step="0.01" min="0" placeholder={`Padrão: ${formatarMoeda(emprestimo.valorPrincipal)}`} value={novaParcelaValorDetalhes} onChange={e => setNovaParcelaValorDetalhes(e.target.value)} className="mt-1 h-8 text-sm" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleCriarParcela(novaParcelaDataDetalhes, novaParcelaValorDetalhes || String(emprestimo.valorPrincipal))} disabled={criarParcelaMutation.isPending || !novaParcelaDataDetalhes} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                            {criarParcelaMutation.isPending ? 'Criando...' : 'Salvar Parcela'}
                          </button>
                          <button onClick={() => { setShowNovaParcelaDetalhes(false); setNovaParcelaDataDetalhes(''); setNovaParcelaValorDetalhes(''); }} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors">Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botões de ação */}
              {!isQuitado && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setValorCustomPagar(''); setContaCaixaId(''); setPagamentoRealizado(null); setModalPagar(true); }}>
                    <DollarSign className="h-3.5 w-3.5" /> Pagar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setValorCustomJuros(''); setContaCaixaId(''); setModalPagarJuros(true); }}>
                    <TrendingUp className="h-3.5 w-3.5" /> Pagar Juros
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setNovaTaxa(String(emprestimo.taxaJuros)); setModalEditarJuros(true); }}>
                    <Edit2 className="h-3.5 w-3.5" /> Editar Juros
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setValorMulta(''); setModalMulta(true); }}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Aplicar Multa
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ─── ABA HISTÓRICO ─── */}
          {aba === 'historico' && (
            <div className="space-y-2">
              {historicoLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !historico || historico.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">Nenhum histórico registrado ainda.</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">As ações futuras aparecerão aqui.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground mb-3">Histórico de Alterações ({historico.length})</p>
                  {historico.map((h) => (
                    <div key={h.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold uppercase tracking-wide ${tipoColor[h.tipo] ?? 'text-foreground'}`}>{tipoLabel[h.tipo] ?? h.tipo}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(h.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-sm text-foreground mt-0.5">{h.descricao}</p>
                        {(h.valorAnterior || h.valorNovo) && (
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            {h.valorAnterior && <span>Antes: <span className="text-foreground">{h.valorAnterior}</span></span>}
                            {h.valorNovo && <span>Depois: <span className="text-foreground">{h.valorNovo}</span></span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ─── ABA COMPROVANTE ─── */}
          {aba === 'comprovante' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Gera o comprovante de pagamento com os dados da empresa configurados em Configurações.</p>
              {config?.nomeEmpresa && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
                  <p className="font-medium text-foreground">{config.nomeEmpresa}</p>
                  {config.enderecoEmpresa && <p className="text-muted-foreground text-xs mt-1">{config.enderecoEmpresa}</p>}
                  {config.telefoneEmpresa && <p className="text-muted-foreground text-xs">{config.telefoneEmpresa}</p>}
                </div>
              )}
              <Button className="gap-2 w-full" size="lg" onClick={handleGerarComprovante} disabled={gerandoPDF}>
                <Download className="h-4 w-4" />
                {gerandoPDF ? 'Gerando PDF...' : 'Gerar Comprovante em PDF'}
              </Button>
            </div>
          )}

        </div>

        {/* Rodapé fixo — só mostra Salvar na aba Editar */}
        {aba === 'editar' && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSalvar} disabled={editarMutation.isPending}>
              {editarMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* ─── MODAIS DE AÇÃO ─── */}
    {/* Modal Pagar */}
    <Dialog open={modalPagar} onOpenChange={(v) => { setModalPagar(v); if (!v) setPagamentoRealizado(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>REGISTRAR PAGAMENTO</DialogTitle>
          <DialogDescription>{emprestimo.clienteNome}</DialogDescription>
        </DialogHeader>
        {pagamentoRealizado ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center"><CheckCircle className="h-8 w-8 text-emerald-500" /></div>
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-500">Pagamento Registrado!</div>
                <div className="text-sm text-muted-foreground">{emprestimo.clienteNome}</div>
                <div className="text-2xl font-bold text-foreground mt-1">{formatarMoeda(pagamentoRealizado.valorPago)}</div>
                <div className="text-xs text-muted-foreground">Parcela {pagamentoRealizado.parcelaNum}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => gerarComprovantePDF({ clienteNome: emprestimo.clienteNome, contratoId: emprestimo.id, parcelaNumero: pagamentoRealizado.parcelaNum, valorOriginal: valorOriginalParcela, juros: valorJurosParcela, valorPago: pagamentoRealizado.valorPago, dataPagamento: new Date().toISOString(), modalidade: emprestimo.modalidade })}>
                <Download className="h-3.5 w-3.5" /> Comprovante PDF
              </Button>
              <Button className="flex-1" onClick={() => { setPagamentoRealizado(null); setModalPagar(false); }}>Fechar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2 text-sm">
              <div className="flex justify-between"><span>Capital</span><span>{formatarMoeda(emprestimo.valorPrincipal)}</span></div>
              <div className="flex justify-between">
                <span>Juros</span>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">{formatarMoeda(jurosCustomDetalhes ? parseFloat(jurosCustomDetalhes) : valorJurosParcela)}</span>
                  <button type="button" className="text-[10px] text-muted-foreground underline hover:text-foreground" onClick={() => setJurosCustomDetalhes(jurosCustomDetalhes ? '' : valorJurosParcela.toFixed(2))}>{jurosCustomDetalhes ? 'usar padrão' : 'editar'}</button>
                </div>
              </div>
              {jurosCustomDetalhes !== '' && <Input type="number" step="0.01" min="0" placeholder="Valor dos juros (R$)" value={jurosCustomDetalhes} onChange={e => setJurosCustomDetalhes(e.target.value)} className="h-8 text-sm" />}
              {diasAtraso > 0 && <div className="flex justify-between text-red-400 border-t border-border pt-2"><span>Total com Atraso ({diasAtraso} dias)</span><span className="font-semibold">{formatarMoeda(totalComAtraso)}</span></div>}
              <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span className="text-emerald-400">{formatarMoeda(valorCustomPagar ? parseFloat(valorCustomPagar) : (diasAtraso > 0 ? totalComAtraso : valorOriginalParcela))}</span></div>
            </div>
            <div><Label className="text-xs">Valor a Pagar (R$)</Label><Input type="number" step="0.01" placeholder={`Padrão: ${formatarMoeda(diasAtraso > 0 ? totalComAtraso : valorOriginalParcela)}`} value={valorCustomPagar} onChange={e => setValorCustomPagar(e.target.value)} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">Data do Pagamento</Label><Input type="date" value={dataPagamentoCustom} onChange={e => setDataPagamentoCustom(e.target.value)} className="mt-1 h-9 text-sm [color-scheme:dark]" /></div>
            <div>
              <Label className="text-xs">Conta de Caixa</Label>
              <Select value={contaCaixaId} onValueChange={setContaCaixaId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>{(contas ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalPagar(false)}>Cancelar</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={!contaCaixaId || pagarTotalMutation.isPending} onClick={handlePagar}>{pagarTotalMutation.isPending ? 'Processando...' : 'Confirmar'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Modal Pagar Juros */}
    <Dialog open={modalPagarJuros} onOpenChange={(v) => { setModalPagarJuros(v); if (!v) { setValorCustomJuros(''); setContaCaixaId(''); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>PAGAR SÓ JUROS</DialogTitle><DialogDescription>{emprestimo.clienteNome}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
            <p className="text-amber-400 font-semibold">Juros por parcela: {formatarMoeda(valorJurosParcela)}</p>
            <p className="text-xs text-muted-foreground mt-1">Pagando apenas os juros, o contrato é renovado sem abater o principal.</p>
          </div>
          <div><Label className="text-xs">Valor dos Juros (deixe em branco para usar o valor padrão)</Label><Input type="number" step="0.01" placeholder={String(valorJurosParcela.toFixed(2))} value={valorCustomJuros} onChange={e => setValorCustomJuros(e.target.value)} className="mt-1" /></div>
          {/* Próximo vencimento */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-3">
            <p className="text-xs font-semibold text-blue-400">Opções do Próximo Vencimento (opcional)</p>
            <div>
              <Label className="text-xs">Data do Próximo Vencimento</Label>
              <Input type="date" value={novaDataVencJuros} onChange={e => setNovaDataVencJuros(e.target.value)} className="mt-1 h-8 text-sm [color-scheme:dark]" />
              <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para calcular automaticamente</p>
            </div>
            <div>
              <Label className="text-xs">Valor do Próximo Vencimento (R$)</Label>
              <Input type="number" step="0.01" min="0" placeholder={`Padrão: ${formatarMoeda(valorOriginalParcela)}`} value={novoValorParcelaJuros} onChange={e => setNovoValorParcelaJuros(e.target.value)} className="mt-1 h-8 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para manter o valor atual</p>
            </div>
          </div>
          <div>
            <Label className="text-xs">Conta de Caixa</Label>
            <Select value={contaCaixaId} onValueChange={setContaCaixaId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>{(contas ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalPagarJuros(false)}>Cancelar</Button>
            <Button className="flex-1 bg-amber-600 hover:bg-amber-700" disabled={!contaCaixaId || pagarJurosMutation.isPending} onClick={handlePagarJuros}>{pagarJurosMutation.isPending ? 'Processando...' : 'Confirmar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal Editar Juros */}
    <Dialog open={modalEditarJuros} onOpenChange={(v) => { setModalEditarJuros(v); if (!v) setNovaTaxa(''); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>EDITAR TAXA DE JUROS</DialogTitle><DialogDescription>{emprestimo.clienteNome}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm"><p className="text-muted-foreground">Taxa atual: <span className="font-bold text-foreground">{emprestimo.taxaJuros}% {emprestimo.tipoTaxa}</span></p></div>
          <div><Label>Nova Taxa de Juros (%)</Label><Input type="number" step="0.01" min="0" placeholder="Ex: 5" value={novaTaxa} onChange={e => setNovaTaxa(e.target.value)} className="mt-1" /></div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalEditarJuros(false)}>Cancelar</Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!novaTaxa.trim() || editarJurosMutation.isPending} onClick={() => editarJurosMutation.mutate({ id: emprestimo.id, novaTaxa })}>{editarJurosMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal Aplicar Multa */}
    <Dialog open={modalMulta} onOpenChange={(v) => { setModalMulta(v); if (!v) setValorMulta(''); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>APLICAR MULTA POR ATRASO</DialogTitle><DialogDescription>{emprestimo.clienteNome}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          {diasAtraso > 0 && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm"><p className="text-red-400 font-semibold">{diasAtraso} dias de atraso</p><p className="text-xs text-muted-foreground mt-1">A multa será adicionada ao valor das parcelas em atraso.</p></div>}
          <div><Label>Valor da Multa (R$)</Label><Input type="number" step="0.01" min="0" placeholder="Ex: 50.00" value={valorMulta} onChange={e => setValorMulta(e.target.value)} className="mt-1" /></div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalMulta(false)}>Cancelar</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={!valorMulta.trim() || aplicarMultaMutation.isPending} onClick={() => aplicarMultaMutation.mutate({ id: emprestimo.id, multa: valorMulta })}>{aplicarMultaMutation.isPending ? 'Aplicando...' : 'Aplicar Multa'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal Deletar */}
    <DeleteEmprestimoDialog
      emprestimoId={emprestimo.id}
      clienteNome={emprestimo.clienteNome}
      open={modalDeletar}
      onOpenChange={setModalDeletar}
      onSuccess={() => { onClose(); onSuccess(); }}
    />
    </>
  );
}
'''

with open('/home/ubuntu/cobrapro/client/src/pages/Emprestimos.tsx', 'r') as f:
    content = f.read()

# Find lines 71-438 (0-indexed: 70-437)
lines = content.split('\n')
# Line 71 starts the function comment, line 438 is the closing }
# We need to replace lines 70 to 437 (0-indexed)
before = '\n'.join(lines[:70])  # lines 1-70
after = '\n'.join(lines[438:])  # lines 439+

new_content = before + '\n' + NEW_COMPONENT + after

with open('/home/ubuntu/cobrapro/client/src/pages/Emprestimos.tsx', 'w') as f:
    f.write(new_content)

print("Done! Replaced lines 71-438 with unified modal.")

# Verify
with open('/home/ubuntu/cobrapro/client/src/pages/Emprestimos.tsx', 'r') as f:
    new_lines = f.readlines()
print(f"New total lines: {len(new_lines)}")
