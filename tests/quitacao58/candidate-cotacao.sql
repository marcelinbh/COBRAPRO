CREATE OR REPLACE FUNCTION obrigacoes51.cotacao(uid integer,cid integer,v jsonb,instante timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE b jsonb;s jsonb;plan jsonb;q jsonb;p jsonb;source text;a text;pid integer;ids integer[]:='{}';due numeric:=0;val numeric;total numeric;additional numeric;day date:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;dest integer;anycancel boolean;
BEGIN
 PERFORM obrigacoes51.verificar();v:=obrigacoes51.proposta(v);PERFORM obrigacoes51.travar(uid,cid);b:=obrigacoes51.base(uid,cid);s:=b->'financeiro';source:=b->>'origemTipo';a:=v->>'acao';total:=(s->'contrato'->>'total_contrato')::numeric;plan:=jsonb_build_object('totalContrato',total::numeric(12,2)::text);
 IF jsonb_array_length(s->'parcelas') NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION '51 conjunto1..60 íntegro necessário' USING ERRCODE='54000';END IF;
 anycancel:=b->'encerramento' IS DISTINCT FROM 'null'::jsonb OR jsonb_array_length(b->'cancelamentos')>0;
 IF a IN('adicionar','editar') AND anycancel THEN RAISE EXCEPTION '51 conjunto renunciado não pode ser reprecificado/adicionado' USING ERRCODE='23514';END IF;
 IF a='adicionar' THEN PERFORM inclusao52.verificar();
 IF source='multimodal35' AND s->'contrato'->>'modalidade'='mensal' THEN
 IF EXISTS(SELECT 1 FROM obrigacoes51.arquivos WHERE contrato_id=cid LIMIT 1) THEN RAISE EXCEPTION '52 append não reabre arquivo' USING ERRCODE='23514';END IF;
 s:=obrigacoes51.validar_mensal(uid,cid);PERFORM private47.estado_auditado(uid,cid,s);plan:=obrigacoes51.plano(s,v,instante);
 ELSE s:=inclusao52.validar(uid,cid,s,source);plan:=inclusao52.plano(s,v,instante);END IF;ids:='{}'::integer[];
 ELSIF a='editar' THEN
 IF source NOT IN('multimodal35','prospectivo21') THEN RAISE EXCEPTION '51 edição requer origem35/21 comprovada, não legado presumido' USING ERRCODE='0A000';END IF;
 IF source='multimodal35' THEN s:=obrigacoes51.validar_mensal(uid,cid);ELSE
 IF NOT EXISTS(SELECT 1 FROM public.ciclo_estados WHERE contrato_id=cid AND user_id=uid AND origem_completa LIMIT 1) THEN RAISE EXCEPTION '51 edição21 requer estado completo genuíno' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM public.renovacao_operacoes WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid LIMIT 1) THEN RAISE EXCEPTION '51 edição21 não renovada/multa' USING ERRCODE='0A000';END IF;END IF;
 plan:=obrigacoes51.plano(s,v,instante);pid:=obrigacoes51.id(v->'parcelaId');ids:=ARRAY[pid];
 ELSIF a IN('cancelar','arquivar') THEN
 IF s->'contrato'->>'status' IN('renegociado') OR EXISTS(SELECT 1 FROM public.contratos WHERE contrato_origem_id=cid LIMIT 1) THEN RAISE EXCEPTION '51 obrigação transferida: atuar no sucessor exigível' USING ERRCODE='0A000';END IF;
 IF v->'alvo'->>'tipo'='parcela' THEN pid:=obrigacoes51.id(v->'alvo'->'parcelaId');IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'parcelas') j WHERE (j->>'id')::int=pid) THEN RAISE EXCEPTION '51 alvo indisponível' USING ERRCODE='42501';END IF;END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'id')::int LOOP
 IF pid IS NULL OR (p->>'id')::int=pid THEN
 val:=obrigacoes51.registrada(p);IF anycancel AND (b->'encerramento' IS DISTINCT FROM 'null'::jsonb OR EXISTS(SELECT 1 FROM obrigacoes51.cancelamentos WHERE parcela_id=(p->>'id')::int LIMIT 1)) THEN val:=0;END IF;
 IF a='cancelar' AND val>0 THEN ids:=array_append(ids,(p->>'id')::int);due:=due+val;
 ELSIF a='arquivar' THEN IF val>0 THEN RAISE EXCEPTION '51 somente histórico encerrado pode ser arquivado' USING ERRCODE='23514';END IF;ids:=array_append(ids,(p->>'id')::int);END IF;
 END IF;END LOOP;
 IF a='arquivar' AND EXISTS(SELECT 1 FROM obrigacoes51.arquivos WHERE contrato_id=cid AND parcela_id IS NOT DISTINCT FROM pid LIMIT 1) THEN RAISE EXCEPTION '51 histórico já arquivado' USING ERRCODE='22023';END IF;
 ELSIF a='quitar' THEN
 dest:=obrigacoes51.id(v->'contaCaixaId');
 IF dest IS DISTINCT FROM (s->'contrato'->>'conta_caixa_id')::int THEN RAISE EXCEPTION '51 escolha explícita deve corresponder à conta vinculada neste recorte; jamais default silencioso' USING ERRCODE='0A000';END IF;
 PERFORM obrigacoes51.validar_livro_recebimento(uid,dest,cid);
 IF NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=dest AND user_id=uid AND ativo LIMIT 1) THEN RAISE EXCEPTION '51 conta destino própria ativa obrigatória' USING ERRCODE='42501';END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'id')::int LOOP
 IF obrigacoes51.registrada(p)>0 AND NOT EXISTS(SELECT 1 FROM obrigacoes51.cancelamentos WHERE parcela_id=(p->>'id')::int LIMIT 1) AND b->'encerramento'='null'::jsonb THEN
 IF source='multimodal35' THEN q:=public.multimodal_cotacao(uid,cid,(p->>'id')::int,instante);
 ELSIF source='prospectivo21' THEN q:=public.ciclo_cotacao(uid,cid,(p->>'id')::int);
 ELSE q:=public.legados_validar(uid,cid,(p->>'id')::int,dest);END IF;
 IF q->'elegivel' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION '51 título não elegível à baixa real' USING ERRCODE='23514';END IF;
 due:=due+(q->>'totalExigido')::numeric;ids:=array_append(ids,(p->>'id')::int);
 END IF;END LOOP;
 IF due IS DISTINCT FROM obrigacoes51.dinheiro(v->>'valorRecebido') THEN RAISE EXCEPTION '51 dinheiro real informado deve igualar exigibilidade cotada; sem quitação presumida/desconto implícito' USING ERRCODE='22023';END IF;
 END IF;
 IF (cardinality(ids)=0 AND a<>'adicionar') OR NOT public.multimodal_moeda(due) THEN RAISE EXCEPTION '51 sem obrigação/alvo/delta ou valor fora faixa' USING ERRCODE='22023';END IF;
 SELECT coalesce(sum(valor),0) INTO additional FROM (SELECT valor FROM obrigacoes51.adicionais WHERE contrato_id=cid UNION ALL SELECT valor FROM inclusao52.adicionais WHERE contrato_id=cid) extras;
 RETURN jsonb_build_object('versao','obrigacoes51_v1','userId',uid,'contratoId',cid,'proposta',v,'origem',source,'estadoHash',obrigacoes51.hash(jsonb_build_object('base',b,'dia',day)),'dataCalculo',day,'totalAntes',total::numeric(12,2)::text,'totalDepois',plan->>'totalContrato','obrigacaoAdicional',(additional+CASE WHEN a='adicionar' THEN (v->>'valor')::numeric ELSE 0 END)::numeric(12,2)::text,'valorExigido',CASE WHEN a='quitar' THEN due::numeric(12,2)::text ELSE '0.00' END,'contaDestinoId',dest,'idsAfetados',ids,'caixaPreservado',a<>'quitar');
END $$;
