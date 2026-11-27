-- Candidato privado52. One-shot pós51; nenhum DML financeiro install-time.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261126,52);
LOCK TABLE public.contratos,public.parcelas,public.transacoes_caixa,public.contrato_historico,public.contas_caixa IN SHARE ROW EXCLUSIVE MODE;
DO $pre52$ DECLARE e jsonb;BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' OR (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user LIMIT 1) OR to_regnamespace('inclusao52') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_proc WHERE proname LIKE '%inclusao52%' LIMIT 1) THEN RAISE EXCEPTION '52 PG17 owner/isolation/one-shot incompatível' USING ERRCODE='55000';END IF;
 PERFORM obrigacoes51.verificar();
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"obrigacoes51.base","bodyHash":"4a5115587ce0bd319926d79937bfd933296be1496f00f4bc6d79c3da400ab24a","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"obrigacoes51.eventos_leitura","bodyHash":"97f9a7dbbedb4f7c45895722eade6e993b53a6ff62407720349a247a8d2f2e58","config":["search_path=pg_catalog, pg_temp"]},{"name":"obrigacoes51.estado","bodyHash":"e2de56a3c3e254d0069c1b91a6263b198892bf47e7810f4ef4ab83d581136a97","config":["search_path=pg_catalog, pg_temp"]},{"name":"obrigacoes51.plano","bodyHash":"ca5507f11e8cc4f61928884e496304d9db436c2a89eaaec175df034d9ca2b4f4","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"obrigacoes51.replay21","bodyHash":"934fa60548a334ceb1b22e101a54d9a6b240508e0938b2543bbfd9e6f6606bc8","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"manutencao44.validar","bodyHash":"032e35f48c8ca55db584d1b8571a37a4bd60bafb5e4afff3f7a854e0c54ec48a","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"obrigacoes51.cotacao","bodyHash":"0532a81507be4897e0786a16670343ab9a51cc75c19adff67bc962cf2589d91f","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"obrigacoes51.executar","bodyHash":"4ffa2054bfdba5d84cfc28800e455258465db6aacf02e7ec95884f8e38478a56","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"public.ciclo_guardar","bodyHash":"7cb00fa10c6ff29198ef7b346e97f7e9018a86b1b557de6bf4f649456b694e24","config":["search_path=pg_catalog, pg_temp"]},{"name":"public.legados_guardar","bodyHash":"52a26732ed696c3ed7c5b4f595b86f2889931d352705aeab1805204e6fd1fc81","config":["search_path=pg_catalog, pg_temp"]},{"name":"public.legados_validar","bodyHash":"1ba94cebfe1585a7be290e2c9f08c6f37ded4f7a8878d66f1634c1881c9a1601","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]}]'::jsonb) LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name' AND p.proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres' LIMIT 1) AND p.prosecdef AND p.proacl::text='{postgres=X/postgres}' AND encode(extensions.digest(p.prosrc,'sha256'),'hex')=e->>'bodyHash' LIMIT 1) THEN RAISE EXCEPTION '52 predecessor exato divergente %',e->>'name' USING ERRCODE='55000';END IF;END LOOP;
END $pre52$;
CREATE TEMP TABLE witness52_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) snapshot,n.nspname||'.'||p.proname name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions');
CREATE TEMP TABLE witness52_catalog ON COMMIT DROP AS SELECT 'class' kind,c.oid,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] snapshot FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') UNION ALL SELECT 'trigger',oid,to_jsonb(t) FROM pg_trigger t UNION ALL SELECT 'constraint',oid,to_jsonb(c) FROM pg_constraint c UNION ALL SELECT 'policy',oid,to_jsonb(p) FROM pg_policy p UNION ALL SELECT 'default',oid,to_jsonb(d) FROM pg_attrdef d UNION ALL SELECT 'index',indexrelid,to_jsonb(i) FROM pg_index i;
CREATE TEMP TABLE witness52_attributes ON COMMIT DROP AS SELECT attrelid,attnum,to_jsonb(a) snapshot FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions');
CREATE SCHEMA inclusao52;
REVOKE ALL ON SCHEMA inclusao52 FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE inclusao52.manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL);
CREATE TABLE inclusao52.adicionais(user_id integer NOT NULL,contrato_id integer NOT NULL REFERENCES public.contratos(id) ON DELETE RESTRICT,parcela_id integer PRIMARY KEY REFERENCES public.parcelas(id) ON DELETE RESTRICT,operacao51 uuid NOT NULL UNIQUE,numero integer NOT NULL CHECK(numero BETWEEN 2 AND 60),valor numeric(12,2) NOT NULL CHECK(valor>0),linha_inicial jsonb NOT NULL,hash_linha text NOT NULL CHECK(hash_linha ~ '^[a-f0-9]{64}$'),origem_tipo text NOT NULL CHECK(origem_tipo IN('prospectivo21','legado')),regra text NOT NULL CHECK(regra='inclusao52_v1'),UNIQUE(contrato_id,numero),FOREIGN KEY(user_id,operacao51) REFERENCES obrigacoes51.operacoes(user_id,id) ON DELETE RESTRICT);
CREATE TABLE inclusao52.capacidades(xid bigint NOT NULL,pid integer NOT NULL,guard text NOT NULL CHECK(guard IN('ciclo_guardar','legados_guardar')),operacao51 uuid NOT NULL REFERENCES obrigacoes51.operacoes(id) ON DELETE RESTRICT,user_id integer NOT NULL,contrato_id integer NOT NULL,parcela_id integer,tabela text NOT NULL CHECK(tabela IN('contratos','parcelas','contrato_historico')),evento text NOT NULL CHECK(evento IN('INSERT','UPDATE')),anterior jsonb,posterior jsonb NOT NULL,PRIMARY KEY(xid,pid,guard),CHECK((tabela='contratos' AND evento='UPDATE' AND anterior IS NOT NULL) OR (tabela IN('parcelas','contrato_historico') AND evento='INSERT' AND anterior IS NULL)));
CREATE FUNCTION inclusao52.plano(s jsonb,v jsonb,instante timestamptz,nova jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE c jsonb:=s->'contrato';p jsonb;np jsonb;ps jsonb:=s->'parcelas';n integer:=jsonb_array_length(ps);i integer:=0;total numeric:=0;amount numeric;d date;firstd date;modal text:=c->>'modalidade';tax text:=c->>'tipo_taxa';today date:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 v:=obrigacoes51.proposta(v);
 IF v->>'acao' IS DISTINCT FROM 'adicionar' OR c->>'status' IS DISTINCT FROM 'ativo' OR NOT((modal='mensal' AND tax='mensal') OR (modal='semanal' AND tax='semanal') OR (modal='quinzenal' AND tax='quinzenal') OR (modal='diario' AND tax='diaria')) OR n NOT BETWEEN 1 AND 59 OR c->'contrato_origem_id' IS DISTINCT FROM 'null'::jsonb OR c->>'num_parcelas' IS DISTINCT FROM n::text OR c->>'numero_parcelas' IS DISTINCT FROM n::text THEN RAISE EXCEPTION '52 inclusão somente raiz ativa coorte fechada1..59; Price fora' USING ERRCODE='0A000';END IF;
 amount:=obrigacoes51.dinheiro(v->>'valor');d:=obrigacoes51.dia(v->>'dataVencimento');firstd:=(c->>'data_vencimento_primeira')::date;
 IF firstd IS NULL OR firstd NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' OR (modal='mensal' AND extract(day FROM firstd)>28) OR d<=today OR d IS DISTINCT FROM public.multimodal_data(firstd,modal,n) THEN RAISE EXCEPTION '52 próxima DATE explícita canônica obrigatória' USING ERRCODE='22023';END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(ps) ORDER BY (value->>'numero')::int LOOP
 i:=i+1;
 IF p->>'numero' IS DISTINCT FROM i::text OR p->>'numero_parcela' IS DISTINCT FROM i::text OR p->>'status' IS DISTINCT FROM 'pendente' OR (p->>'data_vencimento')::date<=today OR (p->>'data_vencimento')::date IS DISTINCT FROM public.multimodal_data(firstd,modal,i-1) OR p->'data_pagamento' IS DISTINCT FROM 'null'::jsonb OR (p->>'valor_pago')::numeric IS DISTINCT FROM 0::numeric OR (p->>'saldo_residual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_multa')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_desconto')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_manual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_diaria_usada')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor')::numeric IS DISTINCT FROM (p->>'valor_original')::numeric OR NOT public.multimodal_moeda((p->>'valor')::numeric) OR (p->>'valor')::numeric<=0 OR (p ? 'contagem_renovacoes' AND (p->>'contagem_renovacoes')::integer IS DISTINCT FROM 0) THEN RAISE EXCEPTION '52 linhas anteriores abertas futuras canônicas e aliases explícitos; sem saneamento' USING ERRCODE='23514';END IF;
 total:=total+(p->>'valor')::numeric;
 END LOOP;
 IF total IS DISTINCT FROM (c->>'total_contrato')::numeric OR NOT public.multimodal_moeda(total) OR NOT public.multimodal_moeda(total+amount) THEN RAISE EXCEPTION '52 header nominal divergente ou overflow12' USING ERRCODE='22023';END IF;
 IF c->>'data_vencimento' IS DISTINCT FROM public.multimodal_data(firstd,modal,n-1)::text OR (c->>'dia_vencimento')::int IS DISTINCT FROM extract(day FROM firstd)::int THEN RAISE EXCEPTION '52 calendário/header divergente' USING ERRCODE='23514';END IF;
 IF nova IS NOT NULL THEN
 PERFORM obrigacoes51.id(nova->'id');
 np:=nova||jsonb_build_object('user_id',(c->>'user_id')::int,'contrato_id',(c->>'id')::int,'cliente_id',(c->>'cliente_id')::int,'koletor_id',(c->>'koletor_id')::int,'conta_caixa_id',(c->>'conta_caixa_id')::int,'numero',n+1,'numero_parcela',n+1,'valor',amount,'valor_original',amount,'valor_juros',0,'valor_pago',0,'valor_multa',0,'valor_desconto',0,'saldo_residual',0,'multa_manual',0,'multa_diaria_usada',0,'data_vencimento',d,'data_pagamento',NULL,'status','pendente','createdAt',instante,'updatedAt',instante);
 ps:=ps||jsonb_build_array(np);
 END IF;
 total:=total+amount;n:=n+1;c:=c||jsonb_build_object('num_parcelas',n,'numero_parcelas',n,'data_vencimento',d,'total_contrato',total,'valor_parcela',round(total/n,2),'updatedAt',instante);
 RETURN jsonb_build_object('contrato',c,'parcelas',(SELECT jsonb_agg(j ORDER BY (j->>'id')::int) FROM jsonb_array_elements(ps) j),'totalContrato',total::numeric(12,2)::text,'jurosTotal',(SELECT sum((j->>'valor_juros')::numeric)::numeric(12,2)::text FROM jsonb_array_elements(ps) j),'obrigacaoCancelada','0.00','alteradas',1,'regra','inclusao52_v1');
END $$;
CREATE FUNCTION inclusao52.consumir(g text,t text,e text,a jsonb,b jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cap inclusao52.capacidades%ROWTYPE;op obrigacoes51.operacoes%ROWTYPE;cid integer;aid integer;source text;
BEGIN
 SELECT * INTO cap FROM inclusao52.capacidades WHERE xid=txid_current() AND pid=pg_backend_pid() AND guard=g LIMIT 1;
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=cap.operacao51 AND xmin::text::bigint=mod(txid_current(),4294967296) LIMIT 1;
 source:=op.antes->>'origemTipo';cid:=cap.contrato_id;aid:=(op.antes->'financeiro'->'contrato'->>'conta_caixa_id')::int;
 IF cap.tabela IS DISTINCT FROM t OR cap.evento IS DISTINCT FROM e OR cap.anterior IS DISTINCT FROM a OR cap.posterior IS DISTINCT FROM b OR op.user_id IS DISTINCT FROM cap.user_id OR op.contrato_id IS DISTINCT FROM cid OR op.resultado IS NOT NULL OR op.request->'proposta'->>'acao' IS DISTINCT FROM 'adicionar' OR op.hash_request IS DISTINCT FROM obrigacoes51.hash(op.request) OR NOT((g='ciclo_guardar' AND source='prospectivo21' AND EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid AND user_id=cap.user_id LIMIT 1)) OR (g='legados_guardar' AND source='legado' AND EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=cid AND user_id=cap.user_id LIMIT 1) AND NOT EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid LIMIT 1) AND NOT EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=cid LIMIT 1))) OR NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted AND classid=22022 AND objid=aid AND objsubid=2 LIMIT 1) OR NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted AND classid=34034 AND objid=cap.user_id AND objsubid=2 LIMIT 1) OR NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted AND classid=34035 AND objid=cid AND objsubid=2 LIMIT 1) THEN RAISE EXCEPTION '52 capability OLD/NEW/owner/op/xid/locks divergente' USING ERRCODE='42501';END IF;
 DELETE FROM inclusao52.capacidades WHERE xid=txid_current() AND pid=pg_backend_pid() AND guard=g;RETURN true;
END $$;
CREATE FUNCTION inclusao52.escrever(oid51 uuid,t text,a jsonb,b jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE op obrigacoes51.operacoes%ROWTYPE;g text;cols text;vals text;actual jsonb;
BEGIN
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=oid51 AND resultado IS NULL AND xmin::text::bigint=mod(txid_current(),4294967296) LIMIT 1;
 IF op.request->'proposta'->>'acao' IS DISTINCT FROM 'adicionar' OR NOT((t='contratos' AND a IS NOT NULL AND a->>'id'=op.contrato_id::text AND b->>'id'=op.contrato_id::text) OR (t IN('parcelas','contrato_historico') AND a IS NULL AND b->>'contrato_id'=op.contrato_id::text)) THEN RAISE EXCEPTION '52 writer fechado somente inclusão' USING ERRCODE='42501';END IF;
 g:=CASE op.antes->>'origemTipo' WHEN 'prospectivo21' THEN 'ciclo_guardar' WHEN 'legado' THEN 'legados_guardar' END;
 IF g IS NULL THEN RAISE EXCEPTION '52 não fabrica origem35' USING ERRCODE='42501';END IF;
 INSERT INTO inclusao52.capacidades VALUES(txid_current(),pg_backend_pid(),g,oid51,op.user_id,op.contrato_id,CASE WHEN t='parcelas' THEN (b->>'id')::int END,t,CASE WHEN a IS NULL THEN 'INSERT' ELSE 'UPDATE' END,a,b);
 IF a IS NULL THEN EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I,$1)).*',t,t) USING b;
 ELSE
 SELECT string_agg(format('%I',attname),',' ORDER BY attnum),string_agg(format('r.%I',attname),',' ORDER BY attnum) INTO cols,vals FROM pg_attribute WHERE attrelid=to_regclass('public.'||t) AND attnum>0 AND NOT attisdropped;
 EXECUTE format('UPDATE public.%I SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r) WHERE id=($1->>''id'')::bigint',t,cols,vals,t) USING b;
 END IF;
 EXECUTE format('SELECT to_jsonb(x) FROM public.%I x WHERE id=($1->>''id'')::bigint LIMIT 1',t) INTO actual USING b;
 IF actual IS DISTINCT FROM b OR EXISTS(SELECT 1 FROM inclusao52.capacidades WHERE xid=txid_current() AND pid=pg_backend_pid() LIMIT 1) THEN RAISE EXCEPTION '52 readback integral após triggers divergente/capacidade residual' USING ERRCODE='23514';END IF;
END $$;
CREATE FUNCTION inclusao52.provar(oid51 uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE op obrigacoes51.operacoes%ROWTYPE;a inclusao52.adicionais%ROWTYPE;s jsonb;after_s jsonb;plan jsonb;expected jsonb;h jsonb;stamp timestamptz;
BEGIN
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=oid51 LIMIT 1;SELECT * INTO STRICT a FROM inclusao52.adicionais WHERE operacao51=oid51 LIMIT 1;
 s:=op.antes->'financeiro';after_s:=op.depois->'financeiro';stamp:=(a.linha_inicial->>'createdAt')::timestamptz;
 IF op.resultado IS NULL OR op.concluida_em IS NULL OR op.depois IS NULL OR a.user_id IS DISTINCT FROM op.user_id OR a.contrato_id IS DISTINCT FROM op.contrato_id OR a.origem_tipo IS DISTINCT FROM op.antes->>'origemTipo' OR a.regra IS DISTINCT FROM 'inclusao52_v1' OR op.request IS DISTINCT FROM obrigacoes51.request(op.request) OR op.hash_request IS DISTINCT FROM obrigacoes51.hash(op.request) OR op.hash_resultado IS DISTINCT FROM obrigacoes51.hash(op.resultado) OR op.resultado IS DISTINCT FROM obrigacoes51.fechar(op.user_id,op.chave,op.request,op.id,jsonb_build_object('operationId',op.id,'contratoId',op.contrato_id,'acao','adicionar','idsAfetados',jsonb_build_array(a.parcela_id),'valorRecebido','0.00','contaDestinoId',NULL,'caixaPreservado',true)) OR op.request->>'estadoHash' IS DISTINCT FROM obrigacoes51.hash(jsonb_build_object('base',op.antes,'dia',op.request->>'dataCalculo')) OR a.hash_linha IS DISTINCT FROM obrigacoes51.hash(a.linha_inicial) OR a.linha_inicial->>'id' IS DISTINCT FROM a.parcela_id::text OR a.linha_inicial->>'numero' IS DISTINCT FROM a.numero::text OR a.linha_inicial->>'numero_parcela' IS DISTINCT FROM a.numero::text OR (a.linha_inicial->>'valor')::numeric IS DISTINCT FROM a.valor OR (op.request->'proposta'->>'valor')::numeric IS DISTINCT FROM a.valor OR EXISTS(SELECT 1 FROM obrigacoes51.adicionais WHERE parcela_id=a.parcela_id LIMIT 1) OR NOT EXISTS(SELECT 1 FROM public.parcelas WHERE id=a.parcela_id AND user_id=a.user_id AND contrato_id=a.contrato_id AND numero=a.numero AND numero_parcela=a.numero AND valor_original=a.valor AND valor_juros=0 LIMIT 1) THEN RAISE EXCEPTION '52 testemunho A sem closure/owner/linha/pedido genuínos' USING ERRCODE='23514';END IF;
 plan:=inclusao52.plano(s,op.request->'proposta',stamp,a.linha_inicial);
 h:=after_s->'historico'->jsonb_array_length(s->'historico');
 IF h->>'tipo' IS DISTINCT FROM 'inclusao_obrigacao' OR h->>'descricao' IS DISTINCT FROM 'Inclusão52 '||op.id::text||': '||(op.request->>'motivo') OR h->>'user_id' IS DISTINCT FROM op.user_id::text OR h->>'contrato_id' IS DISTINCT FROM op.contrato_id::text OR (h->>'created_at')::timestamptz IS DISTINCT FROM stamp OR h->'valor_anterior' IS DISTINCT FROM 'null'::jsonb OR h->'valor_novo' IS DISTINCT FROM 'null'::jsonb OR op.concluida_em<stamp THEN RAISE EXCEPTION '52 histórico A integral inválido' USING ERRCODE='23514';END IF;
 expected:=jsonb_set(jsonb_set(jsonb_set(s,'{contrato}',plan->'contrato'),'{parcelas}',plan->'parcelas'),'{historico}',s->'historico'||jsonb_build_array(h));
 IF expected IS DISTINCT FROM after_s OR op.antes->'conta' IS DISTINCT FROM op.depois->'conta' OR op.antes->'livroConta' IS DISTINCT FROM op.depois->'livroConta' OR NOT(op.depois->'adicionais52' @> jsonb_build_array(to_jsonb(a))) THEN RAISE EXCEPTION '52 delta inteiro/A/conta/livro divergente' USING ERRCODE='23514';END IF;
END $$;
CREATE FUNCTION inclusao52.historico_valido(uid integer,cid integer,h jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE op obrigacoes51.operacoes%ROWTYPE;
BEGIN
 SELECT o.* INTO op FROM obrigacoes51.operacoes o JOIN inclusao52.adicionais a ON a.operacao51=o.id WHERE o.user_id=uid AND o.contrato_id=cid AND a.origem_tipo='legado' AND EXISTS(SELECT 1 FROM jsonb_array_elements(o.depois->'financeiro'->'historico') j WHERE j=h LIMIT 1) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(o.antes->'financeiro'->'historico') j WHERE j=h LIMIT 1) LIMIT 1;
 IF NOT FOUND THEN RETURN false;END IF;PERFORM inclusao52.provar(op.id);RETURN true;
END $$;
CREATE FUNCTION inclusao52.commit_check() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM inclusao52.capacidades WHERE xid=txid_current() AND pid=pg_backend_pid() LIMIT 1) THEN RAISE EXCEPTION '52 capability residual no commit' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='adicionais' THEN PERFORM inclusao52.provar(NEW.operacao51);END IF;RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER commit52 AFTER INSERT ON inclusao52.adicionais DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inclusao52.commit_check();
CREATE CONSTRAINT TRIGGER capability52 AFTER INSERT ON inclusao52.capacidades DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inclusao52.commit_check();
CREATE TRIGGER imutavel52 BEFORE UPDATE OR DELETE ON inclusao52.adicionais FOR EACH ROW EXECUTE FUNCTION obrigacoes51.imutavel();
CREATE TRIGGER imutavel52_truncate BEFORE TRUNCATE ON inclusao52.adicionais FOR EACH STATEMENT EXECUTE FUNCTION obrigacoes51.imutavel();
CREATE FUNCTION inclusao52.provar35(oid51 uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE op obrigacoes51.operacoes%ROWTYPE;a obrigacoes51.adicionais%ROWTYPE;mop public.multimodal_operacoes%ROWTYPE;s jsonb;expected jsonb;plan jsonb;h jsonb;stamp timestamptz;
BEGIN
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=oid51 LIMIT 1;
 SELECT * INTO STRICT a FROM obrigacoes51.adicionais WHERE op.resultado->'resultado'->'idsAfetados'=jsonb_build_array(parcela_id) LIMIT 1;
 SELECT * INTO STRICT mop FROM public.multimodal_operacoes WHERE id=a.operacao48 LIMIT 1;s:=op.antes->'financeiro';stamp:=(a.linha_inicial->>'createdAt')::timestamptz;
 IF op.antes->>'origemTipo' IS DISTINCT FROM 'multimodal35' OR op.resultado IS NULL OR op.hash_request IS DISTINCT FROM obrigacoes51.hash(op.request) OR op.request IS DISTINCT FROM obrigacoes51.request(op.request) OR op.request->>'estadoHash' IS DISTINCT FROM obrigacoes51.hash(jsonb_build_object('base',op.antes,'dia',op.request->>'dataCalculo')) OR op.hash_resultado IS DISTINCT FROM obrigacoes51.hash(op.resultado) OR mop.user_id IS DISTINCT FROM op.user_id OR a.user_id IS DISTINCT FROM op.user_id OR a.contrato_id IS DISTINCT FROM op.contrato_id OR mop.family IS DISTINCT FROM 'multimodal_manutencao48' OR mop.chave IS DISTINCT FROM op.chave OR mop.request IS DISTINCT FROM manutencao48.request(op.contrato_id,obrigacoes51.hash(s),op.request->'proposta',op.request->>'motivo') OR mop.payload IS DISTINCT FROM public.multimodal_payload(op.user_id,'multimodal_manutencao48',mop.request) OR mop.hash_payload IS DISTINCT FROM obrigacoes51.hash(mop.payload) OR mop.auditoria->'payload' IS DISTINCT FROM mop.payload OR mop.resultado IS NULL OR mop.auditoria->'resultado' IS DISTINCT FROM mop.resultado OR mop.auditoria->'antes' IS DISTINCT FROM s OR mop.auditoria->'extra'->>'operacao51' IS DISTINCT FROM op.id::text OR EXISTS(SELECT 1 FROM public.multimodal_pernas WHERE operacao_id=mop.id LIMIT 1) OR a.hash_linha IS DISTINCT FROM obrigacoes51.hash(a.linha_inicial) OR a.linha_inicial->>'id' IS DISTINCT FROM a.parcela_id::text OR a.numero IS DISTINCT FROM jsonb_array_length(s->'parcelas')+1 OR (a.linha_inicial->>'valor')::numeric IS DISTINCT FROM a.valor OR NOT EXISTS(SELECT 1 FROM public.parcelas WHERE id=a.parcela_id AND user_id=op.user_id AND contrato_id=op.contrato_id AND numero=a.numero AND numero_parcela=a.numero AND valor_original=a.valor AND valor_juros=0 LIMIT 1) THEN RAISE EXCEPTION '52 A35 sem operação48/51 real única íntegra' USING ERRCODE='23514';END IF;
 plan:=inclusao52.plano(s,op.request->'proposta',stamp,a.linha_inicial);h:=mop.auditoria->'depois'->'historico'->jsonb_array_length(s->'historico');
 IF h->>'tipo' IS DISTINCT FROM 'manutencao_adicionar' OR h->>'descricao' IS DISTINCT FROM 'Manutenção25 '||mop.id::text||': '||(op.request->>'motivo') OR h->>'user_id' IS DISTINCT FROM op.user_id::text OR h->>'contrato_id' IS DISTINCT FROM op.contrato_id::text OR (h->>'created_at')::timestamptz IS DISTINCT FROM stamp OR h->'valor_anterior' IS DISTINCT FROM 'null'::jsonb OR h->'valor_novo' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION '52 histórico35 falso' USING ERRCODE='23514';END IF;
 expected:=jsonb_set(jsonb_set(jsonb_set(s,'{contrato}',plan->'contrato'),'{parcelas}',plan->'parcelas'),'{historico}',s->'historico'||jsonb_build_array(h));
 IF expected IS DISTINCT FROM mop.auditoria->'depois' OR expected IS DISTINCT FROM op.depois->'financeiro' OR op.antes->'conta' IS DISTINCT FROM op.depois->'conta' OR op.antes->'livroConta' IS DISTINCT FROM op.depois->'livroConta' OR op.resultado IS DISTINCT FROM obrigacoes51.fechar(op.user_id,op.chave,op.request,op.id,jsonb_build_object('operationId',op.id,'contratoId',op.contrato_id,'acao','adicionar','idsAfetados',jsonb_build_array(a.parcela_id),'valorRecebido','0.00','contaDestinoId',NULL,'caixaPreservado',true)) THEN RAISE EXCEPTION '52 delta35 ou closure divergente' USING ERRCODE='23514';END IF;
END $$;
CREATE FUNCTION inclusao52.validar35(uid integer,cid integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE current_s jsonb;s jsonb;initial jsonb;creation public.multimodal_operacoes%ROWTYPE;o public.multimodal_origens%ROWTYPE;calc jsonb;p jsonb;l jsonb;c jsonb;ev record;i integer:=0;n integer;total integer;applied integer:=0;seen uuid[]:='{}';candidates integer;
BEGIN
 current_s:=public.multimodal_validar(uid,cid);SELECT * INTO STRICT o FROM public.multimodal_origens WHERE user_id=uid AND contrato_id=cid LIMIT 1;SELECT * INTO STRICT creation FROM public.multimodal_operacoes WHERE id=o.operacao_id AND user_id=uid LIMIT 1;
 initial:=creation.auditoria->'depois';c:=initial->'contrato';n:=o.numero_inicial;
 IF creation.family IS DISTINCT FROM 'multimodal_criar' OR creation.resultado IS NULL OR creation.hash_payload IS DISTINCT FROM obrigacoes51.hash(creation.payload) OR creation.auditoria->'payload' IS DISTINCT FROM creation.payload OR creation.auditoria->'resultado' IS DISTINCT FROM creation.resultado OR initial->'origem' IS DISTINCT FROM to_jsonb(o) OR c->>'modalidade' NOT IN('semanal','quinzenal','diario') OR c->>'tipo_taxa' IS DISTINCT FROM (CASE c->>'modalidade' WHEN 'diario' THEN 'diaria' ELSE c->>'modalidade' END) OR (c->>'valor_principal')::numeric IS DISTINCT FROM (creation.payload->>'valorPrincipal')::numeric OR (c->>'taxa_juros')::numeric IS DISTINCT FROM (creation.payload->>'taxaJuros')::numeric OR n IS DISTINCT FROM (creation.payload->>'numeroParcelas')::int OR c->>'status' IS DISTINCT FROM 'ativo' OR c->'contrato_origem_id' IS DISTINCT FROM 'null'::jsonb OR c->>'num_parcelas' IS DISTINCT FROM n::text OR c->>'numero_parcelas' IS DISTINCT FROM n::text OR jsonb_array_length(initial->'parcelas') IS DISTINCT FROM n OR initial->'renovacoes' IS DISTINCT FROM '[]'::jsonb OR jsonb_array_length(initial->'ledger')<>1 OR jsonb_array_length(initial->'historico')<>1 OR EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM public.multimodal_operacoes WHERE user_id=uid AND family IN('multimodal_receber','multimodal_renovar') AND (payload->>'contratoId')::int=cid AND resultado IS NOT NULL LIMIT 1) THEN RAISE EXCEPTION '52 raiz35 genuína não mensal apenas criação+A; sem recebimento/renovação' USING ERRCODE='23514';END IF;
 calc:=public.multimodal_calcular(c->>'modalidade',(c->>'valor_principal')::numeric,(c->>'taxa_juros')::numeric,n);
 IF (c->>'total_contrato')::numeric IS DISTINCT FROM (calc->>'total')::numeric OR (c->>'valor_parcela')::numeric IS DISTINCT FROM (calc->>'referencia')::numeric OR NOT EXISTS(SELECT 1 FROM public.multimodal_pernas m WHERE m.operacao_id=creation.id AND m.snapshot=initial->'ledger'->0 LIMIT 1) OR EXISTS(SELECT 1 FROM public.multimodal_pernas WHERE operacao_id=creation.id AND snapshot IS DISTINCT FROM initial->'ledger'->0 LIMIT 1) OR initial->'ledger'->0->>'tipo' IS DISTINCT FROM 'saida' OR initial->'ledger'->0->>'categoria' IS DISTINCT FROM 'emprestimo_liberado' OR (initial->'ledger'->0->>'valor')::numeric IS DISTINCT FROM (c->>'valor_principal')::numeric OR initial->'ledger'->0->>'user_id' IS DISTINCT FROM uid::text THEN RAISE EXCEPTION '52 cálculo/P/desembolso35 não comprovado' USING ERRCODE='23514';END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(initial->'parcelas') ORDER BY (value->>'numero')::int LOOP
 i:=i+1;l:=calc->'linhas'->(i-1);
 IF p->>'id' IS DISTINCT FROM creation.resultado->'parcelasIds'->>(i-1) OR p->>'numero' IS DISTINCT FROM i::text OR p->>'numero_parcela' IS DISTINCT FROM i::text OR (p->>'valor_original')::numeric IS DISTINCT FROM (l->>'valor')::numeric OR (p->>'valor')::numeric IS DISTINCT FROM (l->>'valor')::numeric OR (p->>'valor_juros')::numeric IS DISTINCT FROM (l->>'juros')::numeric OR p->>'data_vencimento' IS DISTINCT FROM public.multimodal_data((c->>'data_vencimento_primeira')::date,c->>'modalidade',i-1)::text THEN RAISE EXCEPTION '52 criação35 original/cálculo/agenda divergente' USING ERRCODE='23514';END IF;
 END LOOP;
 s:=initial;SELECT count(*) INTO total FROM obrigacoes51.operacoes WHERE user_id=uid AND contrato_id=cid AND resultado IS NOT NULL AND request->'proposta'->>'acao'='adicionar';IF total>1024 THEN RAISE EXCEPTION '52 cadeia35 limite1024' USING ERRCODE='54000';END IF;
 WHILE applied<total LOOP
 SELECT count(*) INTO candidates FROM obrigacoes51.operacoes WHERE user_id=uid AND contrato_id=cid AND resultado IS NOT NULL AND request->'proposta'->>'acao'='adicionar' AND antes->'financeiro'=s AND NOT(id=ANY(seen));
 IF candidates<>1 THEN RAISE EXCEPTION '52 cadeia35 predecessor não único' USING ERRCODE='23514';END IF;
 SELECT id,depois INTO STRICT ev FROM obrigacoes51.operacoes WHERE user_id=uid AND contrato_id=cid AND resultado IS NOT NULL AND request->'proposta'->>'acao'='adicionar' AND antes->'financeiro'=s AND NOT(id=ANY(seen)) LIMIT 1;
 PERFORM inclusao52.provar35(ev.id);s:=ev.depois->'financeiro';seen:=array_append(seen,ev.id);applied:=applied+1;
 END LOOP;
 IF s IS DISTINCT FROM current_s THEN RAISE EXCEPTION '52 terminal35 não reconstruído criação+A' USING ERRCODE='23514';END IF;RETURN current_s;
END $$;
CREATE FUNCTION inclusao52.validar(uid integer,cid integer,s jsonb,source text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE p jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM obrigacoes51.cancelamentos WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM obrigacoes51.encerramentos WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM obrigacoes51.arquivos WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM private47.cadeia WHERE cid IN(origem_id,sucessor_id) LIMIT 1) OR EXISTS(SELECT 1 FROM public.reparcelamento43_cadeia WHERE cid IN(origem_id,sucessor_id) LIMIT 1) OR EXISTS(SELECT 1 FROM public.contratos WHERE contrato_origem_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM public.renovacao_operacoes WHERE contrato_id=cid LIMIT 1) THEN RAISE EXCEPTION '52 inclusão não reabre pago/transferido/renunciado/arquivado' USING ERRCODE='23514';END IF;
 IF source='prospectivo21' THEN
 IF NOT EXISTS(SELECT 1 FROM public.ciclo_estados WHERE user_id=uid AND contrato_id=cid AND origem_completa LIMIT 1) OR EXISTS(SELECT 1 FROM public.ciclo_operacoes WHERE contrato_id=cid LIMIT 1) THEN RAISE EXCEPTION '52 origem21 completa sem recebimentos necessária' USING ERRCODE='23514';END IF;
 RETURN obrigacoes51.replay21(uid,cid,s);
 ELSIF source='multimodal35' THEN RETURN inclusao52.validar35(uid,cid);
 ELSIF source='legado' THEN
 IF s->'contrato'->>'modalidade' IS DISTINCT FROM 'mensal' OR s->'contrato'->>'tipo_taxa' IS DISTINCT FROM 'mensal' THEN RAISE EXCEPTION '52 legado não mensal fora; sem writer próprio' USING ERRCODE='0A000';END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') LOOP PERFORM public.legados_validar(uid,cid,(p->>'id')::int,(s->'contrato'->>'conta_caixa_id')::int);END LOOP;RETURN s;
 END IF;RAISE EXCEPTION '52 origem fora' USING ERRCODE='0A000';
END $$;
CREATE FUNCTION inclusao52.adicionar(uid integer,k uuid,cid integer,oid51 uuid,s jsonb,v jsonb,motivo text,instante timestamptz,source text) RETURNS integer[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE np jsonb;plan jsonb;expected jsonb;h jsonb;op public.multimodal_operacoes%ROWTYPE;r jsonb;req jsonb;pid integer;leg_before jsonb;
BEGIN
 IF v->>'acao' IS DISTINCT FROM 'adicionar' THEN RAISE EXCEPTION '52 somente A' USING ERRCODE='42501';END IF;
 np:=public.multimodal_nova_linha('parcelas');plan:=inclusao52.plano(s,v,instante,np);SELECT value INTO STRICT np FROM jsonb_array_elements(plan->'parcelas') WHERE value->'id'=np->'id';pid:=(np->>'id')::int;expected:=jsonb_set(jsonb_set(s,'{contrato}',plan->'contrato'),'{parcelas}',plan->'parcelas');
 IF source='multimodal35' THEN
 req:=manutencao48.request(cid,obrigacoes51.hash(s),v,motivo);PERFORM public.multimodal_barreira(uid,'multimodal_manutencao48',k,false);
 IF EXISTS(SELECT 1 FROM public.multimodal_fences WHERE user_id=uid AND family='multimodal_manutencao48' AND chave=k LIMIT 1) OR EXISTS(SELECT 1 FROM public.multimodal_operacoes WHERE user_id=uid AND family='multimodal_manutencao48' AND chave=k LIMIT 1) THEN RAISE EXCEPTION '52 UUID48 já usada/fenced; não adota operação estrangeira' USING ERRCODE='23505';END IF;
 op:=public.multimodal_reservar(uid,'multimodal_manutencao48',k,req);PERFORM public.multimodal_escrever(op.id,'parcelas',NULL,np);INSERT INTO obrigacoes51.adicionais VALUES(uid,cid,pid,op.id,(np->>'numero')::int,(v->>'valor')::numeric,np,obrigacoes51.hash(np));PERFORM public.multimodal_escrever(op.id,'contratos',s->'contrato',plan->'contrato');
 h:=public.multimodal_nova_linha('contrato_historico')||jsonb_build_object('contrato_id',cid,'user_id',uid::text,'tipo','manutencao_adicionar','descricao','Manutenção25 '||op.id::text||': '||motivo,'created_at',instante);PERFORM public.multimodal_escrever(op.id,'contrato_historico',NULL,h);expected:=jsonb_set(expected,'{historico}',s->'historico'||jsonb_build_array(h));
 r:=req||jsonb_build_object('success',true,'repetida',false,'operationId',op.id,'idempotencyKey',k,'regra','manutencao25_obrigacao_v1','totalContrato',plan->>'totalContrato','jurosTotal',plan->>'jurosTotal','obrigacaoCancelada','0.00');
 PERFORM public.multimodal_selar(op.id,cid,s,expected,r,jsonb_build_object('familia','multimodal_manutencao48','origemOperacao',s->'origem'->>'operacao_id','predecessorEstadoHash',obrigacoes51.hash(s),'operacao51',oid51,'regra','inclusao52_v1','caixaPreservado',true));
 IF EXISTS(SELECT 1 FROM public.multimodal_pernas WHERE operacao_id=op.id LIMIT 1) THEN RAISE EXCEPTION '52 A35 sem desembolso/perna' USING ERRCODE='23514';END IF;
 ELSE
 IF source='legado' THEN leg_before:=public.legados_snapshot(cid);INSERT INTO public.legados_estados(contrato_id,user_id,snapshot) VALUES(cid,uid,leg_before) ON CONFLICT(contrato_id) DO NOTHING;IF NOT EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=cid AND user_id=uid AND snapshot=leg_before LIMIT 1) THEN RAISE EXCEPTION '52 estado legado predecessor divergente; não sanear' USING ERRCODE='23514';END IF;END IF;
 PERFORM inclusao52.escrever(oid51,'parcelas',NULL,np);INSERT INTO inclusao52.adicionais VALUES(uid,cid,pid,oid51,(np->>'numero')::int,(v->>'valor')::numeric,np,obrigacoes51.hash(np),source,'inclusao52_v1');PERFORM inclusao52.escrever(oid51,'contratos',s->'contrato',plan->'contrato');
 h:=public.multimodal_nova_linha('contrato_historico')||jsonb_build_object('contrato_id',cid,'user_id',uid::text,'tipo','inclusao_obrigacao','descricao','Inclusão52 '||oid51::text||': '||motivo,'created_at',instante);PERFORM inclusao52.escrever(oid51,'contrato_historico',NULL,h);expected:=jsonb_set(expected,'{historico}',s->'historico'||jsonb_build_array(h));
 IF source='prospectivo21' THEN
 expected:=jsonb_set(expected,'{parcelas}',(SELECT jsonb_agg(j ORDER BY (j->>'numero')::int,(j->>'id')::int) FROM jsonb_array_elements(expected->'parcelas') j));IF public.ciclo_snapshot(cid) IS DISTINCT FROM expected THEN RAISE EXCEPTION '52 readback21 delta inteiro' USING ERRCODE='23514';END IF;UPDATE public.ciclo_estados SET snapshot=expected WHERE contrato_id=cid AND user_id=uid AND origem_completa AND snapshot=s;IF NOT FOUND THEN RAISE EXCEPTION '52 predecessor21 divergiu' USING ERRCODE='23514';END IF;
 ELSE
 IF public.multimodal_snapshot(cid) IS DISTINCT FROM expected OR public.legados_snapshot(cid) IS DISTINCT FROM expected-ARRAY['origem','renovacoes'] THEN RAISE EXCEPTION '52 readback legado delta inteiro' USING ERRCODE='23514';END IF;UPDATE public.legados_estados SET snapshot=expected-ARRAY['origem','renovacoes'] WHERE contrato_id=cid AND user_id=uid AND snapshot=leg_before;IF NOT FOUND THEN RAISE EXCEPTION '52 predecessor34 divergiu' USING ERRCODE='23514';END IF;
 END IF;
 END IF;RETURN ARRAY[pid];
END $$;

CREATE OR REPLACE FUNCTION obrigacoes51.base(uid integer,cid integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE source text;r jsonb;
BEGIN
 PERFORM obrigacoes51.vinculos(uid,cid);source:=obrigacoes51.origem(uid,cid);
 r:=jsonb_build_object('origemTipo',source,'financeiro',CASE source WHEN 'prospectivo21' THEN public.ciclo_snapshot(cid) ELSE public.multimodal_snapshot(cid) END,
 'cancelamentos',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY parcela_id) FROM obrigacoes51.cancelamentos x WHERE contrato_id=cid),'[]'::jsonb),'encerramento',(SELECT to_jsonb(x) FROM obrigacoes51.encerramentos x WHERE contrato_id=cid),
 'arquivos',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY parcela_id NULLS FIRST) FROM obrigacoes51.arquivos x WHERE contrato_id=cid),'[]'::jsonb),'adicionais',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY numero) FROM obrigacoes51.adicionais x WHERE contrato_id=cid),'[]'::jsonb),
 'conta',(SELECT to_jsonb(a) FROM public.contas_caixa a JOIN public.contratos c ON c.conta_caixa_id=a.id WHERE c.id=cid),'livroConta',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb) FROM public.transacoes_caixa t JOIN public.contratos c ON c.conta_caixa_id=t.conta_caixa_id WHERE c.id=cid));
 IF EXISTS(SELECT 1 FROM inclusao52.adicionais WHERE contrato_id=cid LIMIT 1) THEN r:=r||jsonb_build_object('adicionais52',(SELECT jsonb_agg(to_jsonb(a) ORDER BY numero) FROM inclusao52.adicionais a WHERE contrato_id=cid));END IF;RETURN r;
END $$;
CREATE OR REPLACE FUNCTION obrigacoes51.eventos_leitura(uid integer,cid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE op obrigacoes51.operacoes%ROWTYPE; ev record; p jsonb; a obrigacoes51.adicionais%ROWTYPE; mop public.multimodal_operacoes%ROWTYPE;
BEGIN
 IF EXISTS(SELECT 1 FROM inclusao52.adicionais WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM obrigacoes51.operacoes WHERE contrato_id=cid AND resultado IS NOT NULL AND request->'proposta'->>'acao'='adicionar' AND antes->'financeiro'->'contrato'->>'modalidade' IN('semanal','quinzenal','diario') LIMIT 1) THEN PERFORM inclusao52.verificar();END IF;
 FOR op IN SELECT x.* FROM obrigacoes51.operacoes x WHERE x.contrato_id=cid ORDER BY x.created_at,x.id LOOP
 IF op.user_id IS DISTINCT FROM uid OR op.request IS DISTINCT FROM obrigacoes51.request(op.request) OR op.request->>'contratoId' IS DISTINCT FROM cid::text OR op.hash_request IS DISTINCT FROM obrigacoes51.hash(op.request)
 OR op.resultado IS NULL OR op.depois IS NULL OR op.concluida_em IS NULL OR op.hash_resultado IS DISTINCT FROM obrigacoes51.hash(op.resultado)
 OR op.resultado IS DISTINCT FROM obrigacoes51.fechar(uid,op.chave,op.request,op.id,op.resultado->'resultado')
 OR op.resultado->'resultado'->>'operationId' IS DISTINCT FROM op.id::text OR op.resultado->'resultado'->>'contratoId' IS DISTINCT FROM cid::text
 OR op.resultado->'resultado'->>'acao' IS DISTINCT FROM op.request->'proposta'->>'acao'
 OR op.request->>'estadoHash' IS DISTINCT FROM obrigacoes51.hash(jsonb_build_object('base',op.antes,'dia',obrigacoes51.dia(op.request->>'dataCalculo')))
 THEN RAISE EXCEPTION '51 evento sem closure exata' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR ev IN SELECT x.*,to_jsonb(x) row51 FROM obrigacoes51.cancelamentos x WHERE x.contrato_id=cid ORDER BY x.parcela_id LOOP
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=ev.operacao_id LIMIT 1;
 SELECT to_jsonb(x) INTO STRICT p FROM public.parcelas x WHERE id=ev.parcela_id AND contrato_id=cid LIMIT 1;
 IF ev.user_id IS DISTINCT FROM uid OR op.user_id IS DISTINCT FROM uid OR op.contrato_id IS DISTINCT FROM cid OR op.request->'proposta'->>'acao' IS DISTINCT FROM 'cancelar'
 OR NOT(op.resultado->'resultado'->'idsAfetados' @> jsonb_build_array(ev.parcela_id))
 OR NOT(op.depois->'cancelamentos' @> jsonb_build_array(ev.row51))
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(op.antes->'financeiro'->'parcelas') j WHERE j=p LIMIT 1)
 OR ev.status_original IS DISTINCT FROM p->>'status' OR ev.status_original NOT IN('pendente','atrasada','atrasado','vencendo_hoje','parcial')
 OR ev.valor_pago_preservado IS DISTINCT FROM (p->>'valor_pago')::numeric OR ev.obrigacao_registrada IS DISTINCT FROM obrigacoes51.registrada(p)
 THEN RAISE EXCEPTION '51 renúncia sem prova registrada exata' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR ev IN SELECT x.*,to_jsonb(x) row51 FROM obrigacoes51.encerramentos x WHERE x.contrato_id=cid LOOP
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=ev.operacao_id LIMIT 1;
 IF ev.user_id IS DISTINCT FROM uid OR op.user_id IS DISTINCT FROM uid OR op.contrato_id IS DISTINCT FROM cid
 OR op.request->'proposta' IS DISTINCT FROM jsonb_build_object('acao','cancelar','alvo',jsonb_build_object('tipo','contrato'),'reconhecoSemEstorno',true)
 OR op.depois->'encerramento' IS DISTINCT FROM ev.row51 OR NOT EXISTS(SELECT 1 FROM obrigacoes51.cancelamentos WHERE operacao_id=op.id AND contrato_id=cid AND user_id=uid LIMIT 1)
 THEN RAISE EXCEPTION '51 encerramento sem renúncia comprovada' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR ev IN SELECT x.*,to_jsonb(x) row51 FROM obrigacoes51.arquivos x WHERE x.contrato_id=cid LOOP
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=ev.operacao_id LIMIT 1;
 IF ev.user_id IS DISTINCT FROM uid OR op.user_id IS DISTINCT FROM uid OR op.contrato_id IS DISTINCT FROM cid
 OR op.request->'proposta' IS DISTINCT FROM jsonb_build_object('acao','arquivar','alvo',CASE WHEN ev.parcela_id IS NULL THEN jsonb_build_object('tipo','contrato') ELSE jsonb_build_object('tipo','parcela','parcelaId',ev.parcela_id) END)
 OR NOT(op.depois->'arquivos' @> jsonb_build_array(ev.row51))
 THEN RAISE EXCEPTION '51 arquivo sem prova exata' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR a IN SELECT x.* FROM obrigacoes51.adicionais x WHERE x.contrato_id=cid ORDER BY x.parcela_id LOOP
 SELECT * INTO STRICT mop FROM public.multimodal_operacoes WHERE id=a.operacao48 LIMIT 1;
 IF a.user_id IS DISTINCT FROM uid OR a.hash_linha IS DISTINCT FROM obrigacoes51.hash(a.linha_inicial) OR a.linha_inicial->>'id' IS DISTINCT FROM a.parcela_id::text OR a.linha_inicial->>'contrato_id' IS DISTINCT FROM cid::text
 OR mop.user_id IS DISTINCT FROM uid OR mop.family IS DISTINCT FROM 'multimodal_manutencao48' OR mop.resultado IS NULL OR mop.hash_payload IS DISTINCT FROM obrigacoes51.hash(mop.payload)
 OR mop.request->'alteracao'->>'acao' IS DISTINCT FROM 'adicionar' OR (mop.request->'alteracao'->>'valor')::numeric IS DISTINCT FROM a.valor
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(mop.auditoria->'depois'->'parcelas') j WHERE j=a.linha_inicial LIMIT 1)
 THEN RAISE EXCEPTION '51 adicional sem testemunho exato' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR ev IN SELECT extra.operacao51 FROM inclusao52.adicionais extra WHERE extra.contrato_id=cid ORDER BY extra.numero LOOP PERFORM inclusao52.provar(ev.operacao51);END LOOP;
 FOR ev IN SELECT o.id FROM obrigacoes51.operacoes o WHERE o.contrato_id=cid AND o.resultado IS NOT NULL AND o.request->'proposta'->>'acao'='adicionar' AND o.antes->'financeiro'->'contrato'->>'modalidade' IN('semanal','quinzenal','diario') LOOP PERFORM inclusao52.provar35(ev.id);END LOOP;
END $$;
CREATE OR REPLACE FUNCTION obrigacoes51.estado(uid integer,cid integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE p jsonb; rows jsonb:='[]'; v numeric; a numeric; total numeric:=0; open_count integer:=0; canceled boolean:=false; st text;
BEGIN
 PERFORM obrigacoes51.verificar();PERFORM obrigacoes51.travar_leitura(uid,cid);PERFORM obrigacoes51.validar_leitura(uid,cid);PERFORM obrigacoes51.eventos_leitura(uid,cid);
 canceled:=EXISTS(SELECT 1 FROM obrigacoes51.encerramentos WHERE contrato_id=cid AND user_id=uid LIMIT 1);
 FOR p IN SELECT to_jsonb(x) FROM public.parcelas x WHERE contrato_id=cid ORDER BY id LOOP
 v:=obrigacoes51.registrada_leitura(p);SELECT sum(valor) INTO a FROM (SELECT valor FROM obrigacoes51.adicionais WHERE parcela_id=(p->>'id')::int UNION ALL SELECT valor FROM inclusao52.adicionais WHERE parcela_id=(p->>'id')::int) extras;a:=coalesce(a,0);total:=total+a;
 IF p->>'status' IN('paga','pago') THEN v:=0;st:='paga';
 ELSIF p->>'status'='renovada' THEN v:=0;st:='transferida';
 ELSIF EXISTS(SELECT 1 FROM obrigacoes51.cancelamentos WHERE parcela_id=(p->>'id')::int AND user_id=uid LIMIT 1) OR EXISTS(SELECT 1 FROM obrigacoes51.encerramentos WHERE contrato_id=cid AND user_id=uid LIMIT 1) OR p->>'status' IN('cancelada','cancelado') THEN v:=0;st:='cancelada';canceled:=true;
 ELSE st:='aberta';open_count:=open_count+1;END IF;
 rows:=rows||jsonb_build_array(jsonb_build_object('parcelaId',(p->>'id')::int,'statusFinanceiroOriginal',p->>'status','statusObrigacao',st,'obrigacaoAtual',v::numeric(15,2)::text,'componenteAdicional',a::numeric(15,2)::text,'arquivada',EXISTS(SELECT 1 FROM obrigacoes51.arquivos WHERE contrato_id=cid AND (parcela_id IS NULL OR parcela_id=(p->>'id')::int) LIMIT 1)));
 END LOOP;
 RETURN jsonb_build_object('versao','obrigacoes51_v1','userId',uid,'contratoId',cid,'statusObrigacao',CASE WHEN open_count>0 THEN 'ativo' WHEN canceled THEN 'encerrado_por_cancelamento' ELSE 'quitado' END,'arquivado',EXISTS(SELECT 1 FROM obrigacoes51.arquivos WHERE contrato_id=cid AND parcela_id IS NULL LIMIT 1),'obrigacaoAdicional',total::numeric(15,2)::text,'parcelas',rows);
END $$;
CREATE OR REPLACE FUNCTION obrigacoes51.plano(s jsonb,v jsonb,instante timestamptz,nova jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE c jsonb:=s->'contrato';p jsonb;np jsonb;ps jsonb:='[]';n integer:=jsonb_array_length(s->'parcelas');i integer:=0;changed integer:=0;pid integer;amount numeric;share numeric;total numeric:=0;today date:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;d date;prev date;nextd date;firstd date;lastd date;action text;
BEGIN
 v:=obrigacoes51.proposta(v);action:=v->>'acao';
 IF action NOT IN('adicionar','editar') OR c->>'status' IS DISTINCT FROM 'ativo' OR c->>'modalidade' IS DISTINCT FROM 'mensal' OR c->>'tipo_taxa' IS DISTINCT FROM 'mensal' OR n NOT BETWEEN 1 AND 60 OR c->'contrato_origem_id' IS DISTINCT FROM 'null'::jsonb OR c->>'num_parcelas' IS DISTINCT FROM n::text OR c->>'numero_parcelas' IS DISTINCT FROM n::text THEN RAISE EXCEPTION '51 edição/inclusão requer contrato mensal ativo íntegro' USING ERRCODE='0A000';END IF;
 IF action='adicionar' THEN
 IF n>=60 THEN RAISE EXCEPTION '51 máximo 60 parcelas' USING ERRCODE='22023';END IF;
 amount:=obrigacoes51.dinheiro(v->>'valor');d:=obrigacoes51.dia(v->>'dataVencimento');firstd:=(c->>'data_vencimento_primeira')::date;
 IF firstd IS NULL OR extract(day FROM firstd)>28 OR d<=today OR d IS DISTINCT FROM public.multimodal_data(firstd,'mensal',n) THEN RAISE EXCEPTION '51 inclusão: data informada deve ser próximo mês explícito ancorado1..28' USING ERRCODE='22023';END IF;
 END IF;
 IF action='editar' THEN
 pid:=obrigacoes51.id(v->'parcelaId');IF (EXISTS(SELECT 1 FROM obrigacoes51.adicionais WHERE parcela_id=pid LIMIT 1) OR EXISTS(SELECT 1 FROM inclusao52.adicionais WHERE parcela_id=pid LIMIT 1)) THEN RAISE EXCEPTION '51 editar componente adicional exige regra própria; não virar principal/juros' USING ERRCODE='0A000';END IF;
 SELECT (j->>'data_vencimento')::date INTO prev FROM jsonb_array_elements(s->'parcelas') j WHERE (j->>'numero')::int<(SELECT (x->>'numero')::int FROM jsonb_array_elements(s->'parcelas') x WHERE (x->>'id')::int=pid) ORDER BY (j->>'numero')::int DESC LIMIT 1;
 SELECT (j->>'data_vencimento')::date INTO nextd FROM jsonb_array_elements(s->'parcelas') j WHERE (j->>'numero')::int>(SELECT (x->>'numero')::int FROM jsonb_array_elements(s->'parcelas') x WHERE (x->>'id')::int=pid) ORDER BY (j->>'numero')::int LIMIT 1;
 END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'numero')::int LOOP
 i:=i+1;np:=p;
 IF p->>'numero' IS DISTINCT FROM i::text OR p->>'numero_parcela' IS DISTINCT FROM i::text THEN RAISE EXCEPTION '51 sequência original divergente' USING ERRCODE='23514';END IF;
 IF action='adicionar' OR (p->>'id')::int=pid THEN
 IF p->>'status' IS DISTINCT FROM 'pendente' OR (p->>'data_vencimento')::date<=today OR (p->>'valor_pago')::numeric IS DISTINCT FROM 0::numeric OR p->'data_pagamento' IS DISTINCT FROM 'null'::jsonb OR (p->>'saldo_residual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_multa')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_desconto')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_manual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_diaria_usada')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor')::numeric IS DISTINCT FROM (p->>'valor_original')::numeric THEN RAISE EXCEPTION '51 alvo somente integralmente aberto futuro sem baixa/encargos' USING ERRCODE='23514';END IF;
 IF action='adicionar' AND (p->>'data_vencimento')::date IS DISTINCT FROM public.multimodal_data(firstd,'mensal',i-1) THEN RAISE EXCEPTION '51 append requer calendário mensal; exceção individual não é sanada' USING ERRCODE='23514';END IF;
 IF action='editar' THEN
 share:=(p->>'valor_original')::numeric-(p->>'valor_juros')::numeric;amount:=CASE WHEN v ? 'novoValor' THEN obrigacoes51.dinheiro(v->>'novoValor') ELSE (p->>'valor')::numeric END;d:=CASE WHEN v ? 'novaDataVencimento' THEN obrigacoes51.dia(v->>'novaDataVencimento') ELSE (p->>'data_vencimento')::date END;
 IF share<=0 OR amount<share OR d<=today OR d<(c->>'data_inicio')::date OR (prev IS NOT NULL AND d<=prev) OR (nextd IS NOT NULL AND d>=nextd) THEN RAISE EXCEPTION '51 preservar principal e DATE estrita entre vizinhos reais' USING ERRCODE='22023';END IF;
 IF amount IS DISTINCT FROM (p->>'valor')::numeric OR d IS DISTINCT FROM (p->>'data_vencimento')::date THEN np:=p||jsonb_build_object('valor',amount,'valor_original',amount,'valor_juros',amount-share,'data_vencimento',d,'updatedAt',instante);changed:=1;END IF;
 END IF;
 END IF;
 total:=total+(np->>'valor')::numeric;ps:=ps||jsonb_build_array(np);
 END LOOP;
 IF action='adicionar' THEN
 IF nova IS NOT NULL THEN
 np:=nova||jsonb_build_object('user_id',(c->>'user_id')::int,'contrato_id',(c->>'id')::int,'cliente_id',(c->>'cliente_id')::int,'koletor_id',(c->>'koletor_id')::int,'conta_caixa_id',(c->>'conta_caixa_id')::int,'numero',n+1,'numero_parcela',n+1,'valor',amount,'valor_original',amount,'valor_juros',0,'valor_pago',0,'valor_multa',0,'valor_desconto',0,'saldo_residual',0,'multa_manual',0,'multa_diaria_usada',0,'data_vencimento',d,'data_pagamento',NULL,'status','pendente','createdAt',instante,'updatedAt',instante);
 ps:=ps||jsonb_build_array(np);END IF;
 total:=total+amount;n:=n+1;changed:=1;c:=c||jsonb_build_object('num_parcelas',n,'numero_parcelas',n,'data_vencimento',d);
 ELSE
 IF changed=0 THEN RAISE EXCEPTION '51 sem delta real' USING ERRCODE='22023';END IF;
 SELECT (j->>'data_vencimento')::date INTO firstd FROM jsonb_array_elements(ps) j ORDER BY (j->>'numero')::int LIMIT 1;SELECT (j->>'data_vencimento')::date INTO lastd FROM jsonb_array_elements(ps) j ORDER BY (j->>'numero')::int DESC LIMIT 1;
 c:=c||jsonb_build_object('data_vencimento_primeira',firstd,'dia_vencimento',extract(day FROM firstd)::int,'data_vencimento',lastd);
 END IF;
 IF NOT public.multimodal_moeda(total) THEN RAISE EXCEPTION '51 overflow nominal/histórico' USING ERRCODE='22023';END IF;
 IF action='adicionar' OR total IS DISTINCT FROM (c->>'total_contrato')::numeric THEN c:=c||jsonb_build_object('total_contrato',total,'valor_parcela',round(total/n,2));END IF;
 c:=c||jsonb_build_object('updatedAt',instante);
 RETURN jsonb_build_object('contrato',c,'parcelas',(SELECT jsonb_agg(j ORDER BY (j->>'id')::int) FROM jsonb_array_elements(ps) j),'totalContrato',total::numeric(12,2)::text,'jurosTotal',(SELECT sum((j->>'valor_juros')::numeric)::numeric(12,2)::text FROM jsonb_array_elements(ps) j),'obrigacaoCancelada','0.00','alteradas',1,'regra','obrigacoes51_v1');
END $$;
CREATE OR REPLACE FUNCTION obrigacoes51.replay21(uid integer,cid integer,target jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE origin public.emprestimos_rpc_origens%ROWTYPE;creation public.emprestimos_rpc_operacoes%ROWTYPE;ev record;pending manutencao44.operacoes%ROWTYPE;s jsonb;initial jsonb;before_s jsonb;after_s jsonb;expected jsonb;plan jsonb;p jsonb;ps jsonb;h jsonb;nc jsonb;stamp timestamptz;dates date[];n integer;applied integer:=0;total integer;seen text[]:='{}';candidates integer;
BEGIN
 SELECT * INTO STRICT origin FROM public.emprestimos_rpc_origens WHERE contrato_id=cid AND user_id=uid LIMIT 1;SELECT * INTO STRICT creation FROM public.emprestimos_rpc_operacoes WHERE id=origin.operacao_id AND user_id=uid LIMIT 1;
 initial:=jsonb_build_object('contrato',creation.auditoria->'contrato','parcelas',creation.auditoria->'parcelas','origem',to_jsonb(origin),
 'ledger',jsonb_build_array((SELECT to_jsonb(t) FROM public.transacoes_caixa t WHERE id=origin.transacao_caixa_id LIMIT 1)),
 'historico',jsonb_build_array((SELECT to_jsonb(hh) FROM public.contrato_historico hh WHERE id=(creation.auditoria->>'historicoId')::bigint LIMIT 1)));
 PERFORM obrigacoes51.validar44_base(uid,cid,initial);s:=initial;n:=jsonb_array_length(s->'parcelas');
 SELECT count(*) INTO total FROM (
 SELECT id::text tag FROM manutencao44.operacoes WHERE contrato_id=cid AND user_id=uid AND resultado IS NOT NULL
 UNION ALL SELECT id::text FROM obrigacoes51.operacoes WHERE contrato_id=cid AND user_id=uid AND resultado IS NOT NULL AND request->'proposta'->>'acao' IN('editar','adicionar')
 ) e;
 IF total>1024 THEN RAISE EXCEPTION '51 cadeia21 excedeu limite fechado' USING ERRCODE='54000';END IF;
 WHILE applied<total LOOP
 SELECT count(*) INTO candidates FROM (
 SELECT id::text tag,antes FROM manutencao44.operacoes WHERE contrato_id=cid AND user_id=uid AND resultado IS NOT NULL
 UNION ALL SELECT id::text,antes->'financeiro' FROM obrigacoes51.operacoes WHERE contrato_id=cid AND user_id=uid AND resultado IS NOT NULL AND request->'proposta'->>'acao' IN('editar','adicionar')
 ) e WHERE e.antes=s AND NOT(e.tag=ANY(seen));
 IF candidates<>1 THEN RAISE EXCEPTION '51 cadeia21 ausente/ramificada/inconsistente' USING ERRCODE='23514';END IF;
 SELECT * INTO STRICT ev FROM (
 SELECT id::text tag,'44' kind,request,antes,depois,resultado,concluida_em,hash_payload hash_req FROM manutencao44.operacoes WHERE contrato_id=cid AND user_id=uid AND resultado IS NOT NULL
 UNION ALL SELECT id::text,'51',request,antes->'financeiro',depois->'financeiro',resultado,concluida_em,hash_request FROM obrigacoes51.operacoes WHERE contrato_id=cid AND user_id=uid AND resultado IS NOT NULL AND request->'proposta'->>'acao' IN('editar','adicionar')
 ) e WHERE e.antes=s AND NOT(e.tag=ANY(seen)) LIMIT 1;
 after_s:=ev.depois;stamp:=(after_s->'contrato'->>'updatedAt')::timestamptz;expected:=s;h:=after_s->'historico'->jsonb_array_length(s->'historico');
 IF ev.hash_req IS DISTINCT FROM obrigacoes51.hash(ev.request) OR ev.concluida_em IS NULL OR stamp IS NULL OR ev.concluida_em<stamp OR h->>'contrato_id' IS DISTINCT FROM cid::text OR h->>'user_id' IS DISTINCT FROM uid::text OR (h->>'created_at')::timestamptz IS DISTINCT FROM stamp OR h->'valor_anterior' IS DISTINCT FROM 'null'::jsonb OR h->'valor_novo' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION '51 cadeia21 request/timestamp/histórico inválido' USING ERRCODE='23514';END IF;
 IF ev.kind='51' AND ev.request->'proposta'->>'acao'='adicionar' THEN
 PERFORM inclusao52.provar(ev.tag::uuid);SELECT linha_inicial INTO STRICT p FROM inclusao52.adicionais WHERE operacao51=ev.tag::uuid LIMIT 1;plan:=inclusao52.plano(s,ev.request->'proposta',stamp,p);expected:=jsonb_set(jsonb_set(expected,'{contrato}',plan->'contrato'),'{parcelas}',(SELECT jsonb_agg(j ORDER BY (j->>'numero')::int,(j->>'id')::int) FROM jsonb_array_elements(plan->'parcelas') j));n:=jsonb_array_length(expected->'parcelas');
 ELSIF ev.kind='51' THEN
 IF ev.request IS DISTINCT FROM obrigacoes51.request(ev.request) OR ev.request->>'estadoHash' IS DISTINCT FROM obrigacoes51.hash(jsonb_build_object('base',(SELECT antes FROM obrigacoes51.operacoes WHERE id=ev.tag::uuid LIMIT 1),'dia',ev.request->>'dataCalculo')) OR ev.resultado->'request' IS DISTINCT FROM ev.request OR ev.resultado->'resultado'->>'operationId' IS DISTINCT FROM ev.tag OR h->>'tipo' IS DISTINCT FROM 'edicao_parcela' OR h->>'descricao' IS DISTINCT FROM 'Edição51 '||ev.tag||': '||(ev.request->>'motivo') THEN RAISE EXCEPTION '51 edição21 prova divergente' USING ERRCODE='23514';END IF;
 plan:=obrigacoes51.plano(s,ev.request->'proposta',stamp);expected:=jsonb_set(jsonb_set(expected,'{contrato}',plan->'contrato'),'{parcelas}',(SELECT jsonb_agg(j ORDER BY (j->>'numero')::int,(j->>'id')::int) FROM jsonb_array_elements(plan->'parcelas') j));
 ELSE
 SELECT array_agg(d::date ORDER BY ord) INTO dates FROM jsonb_array_elements_text(ev.request->'vencimentos') WITH ORDINALITY x(d,ord);PERFORM manutencao44.agenda(cid,dates,(s->'contrato'->>'data_inicio')::date,n);
 IF ev.request IS DISTINCT FROM manutencao44.request(cid,obrigacoes51.hash(s),dates,ev.request->>'motivo') OR h->>'tipo' IS DISTINCT FROM 'edicao_calendario' OR h->>'descricao' IS DISTINCT FROM 'Calendário auditado '||ev.tag||': '||(ev.request->>'motivo') THEN RAISE EXCEPTION '51 calendário21 prova divergente' USING ERRCODE='23514';END IF;
 ps:='[]';FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'numero')::int,(value->>'id')::int LOOP ps:=ps||jsonb_build_array(p||jsonb_build_object('data_vencimento',dates[(p->>'numero')::int],'status',CASE WHEN dates[(p->>'numero')::int]<(stamp AT TIME ZONE 'America/Sao_Paulo')::date THEN 'atrasada' WHEN dates[(p->>'numero')::int]=(stamp AT TIME ZONE 'America/Sao_Paulo')::date THEN 'vencendo_hoje' ELSE 'pendente' END,'updatedAt',stamp));END LOOP;
 nc:=s->'contrato'||jsonb_build_object('data_vencimento_primeira',dates[1],'data_vencimento',dates[n],'dia_vencimento',extract(day FROM dates[1])::int,'updatedAt',stamp);expected:=jsonb_set(jsonb_set(expected,'{contrato}',nc),'{parcelas}',ps);
 END IF;
 expected:=jsonb_set(expected,'{historico}',s->'historico'||jsonb_build_array(h));IF expected IS DISTINCT FROM after_s THEN RAISE EXCEPTION '51 cadeia21 delta integral divergente' USING ERRCODE='23514';END IF;
 s:=after_s;seen:=array_append(seen,ev.tag);applied:=applied+1;
 END LOOP;
 -- Existing44 calls its validator after its DML/readback, before closing op44. Prove that in-progress exact request too.
 IF s IS DISTINCT FROM target THEN
 SELECT * INTO pending FROM manutencao44.operacoes WHERE contrato_id=cid AND user_id=uid AND resultado IS NULL AND antes=s AND pg_xact_status(xmin::text::xid8)='in progress' LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION '51 cadeia21 terminal não corresponde estado físico' USING ERRCODE='23514';END IF;
 stamp:=(target->'contrato'->>'updatedAt')::timestamptz;SELECT array_agg(d::date ORDER BY ord) INTO dates FROM jsonb_array_elements_text(pending.request->'vencimentos') WITH ORDINALITY x(d,ord);PERFORM manutencao44.agenda(cid,dates,(s->'contrato'->>'data_inicio')::date,n);
 IF pending.request IS DISTINCT FROM manutencao44.request(cid,obrigacoes51.hash(s),dates,pending.request->>'motivo') THEN RAISE EXCEPTION '51 pendente44 exata inválida' USING ERRCODE='23514';END IF;
 ps:='[]';FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'numero')::int,(value->>'id')::int LOOP ps:=ps||jsonb_build_array(p||jsonb_build_object('data_vencimento',dates[(p->>'numero')::int],'status',CASE WHEN dates[(p->>'numero')::int]<(stamp AT TIME ZONE 'America/Sao_Paulo')::date THEN 'atrasada' WHEN dates[(p->>'numero')::int]=(stamp AT TIME ZONE 'America/Sao_Paulo')::date THEN 'vencendo_hoje' ELSE 'pendente' END,'updatedAt',stamp));END LOOP;
 nc:=s->'contrato'||jsonb_build_object('data_vencimento_primeira',dates[1],'data_vencimento',dates[n],'dia_vencimento',extract(day FROM dates[1])::int,'updatedAt',stamp);h:=target->'historico'->jsonb_array_length(s->'historico');expected:=jsonb_set(jsonb_set(jsonb_set(s,'{contrato}',nc),'{parcelas}',ps),'{historico}',s->'historico'||jsonb_build_array(h));
 IF h->>'tipo' IS DISTINCT FROM 'edicao_calendario' OR h->>'descricao' IS DISTINCT FROM 'Calendário auditado '||pending.id::text||': '||(pending.request->>'motivo') OR h->>'user_id' IS DISTINCT FROM uid::text OR expected IS DISTINCT FROM target THEN RAISE EXCEPTION '51 pendente44 delta exato divergente' USING ERRCODE='23514';END IF;s:=target;
 END IF;RETURN s;
END $$;
CREATE OR REPLACE FUNCTION manutencao44.validar(uid integer,cid integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$ DECLARE s jsonb;BEGIN s:=public.ciclo_validar(uid,cid);IF EXISTS(SELECT 1 FROM obrigacoes51.operacoes WHERE contrato_id=cid AND user_id=uid AND resultado IS NOT NULL AND request->'proposta'->>'acao' IN('editar','adicionar') LIMIT 1) THEN RETURN obrigacoes51.replay21(uid,cid,s);END IF;RETURN obrigacoes51.validar44_base(uid,cid,s);END $$;
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
 PERFORM public.caixa37_validar_livro(uid);
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
CREATE OR REPLACE FUNCTION obrigacoes51.executar(uid integer,k uuid,req jsonb,recovery boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE r jsonb;v jsonb;q jsonb;b jsonb;afterb jsonb;s jsonb;plan jsonb;expected jsonb;p jsonb;np jsonb;h jsonb;res jsonb;closed jsonb;old obrigacoes51.operacoes%ROWTYPE;f obrigacoes51.fences%ROWTYPE;mop public.multimodal_operacoes%ROWTYPE;oid51 uuid;cid integer;pid integer;dest integer;ids integer[];a text;source text;instante timestamptz;day date;subkey uuid;subq jsonb;receipt jsonb;sumcash numeric:=0;oldledger jsonb;newledger jsonb;
BEGIN
 PERFORM obrigacoes51.verificar();r:=obrigacoes51.request(req);v:=r->'proposta';cid:=(r->>'contratoId')::int;a:=v->>'acao';IF uid IS NULL OR uid<=0 OR k IS NULL THEN RAISE EXCEPTION '51 owner/UUID obrigatórios' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('obrigacoes51:'||uid::text||':'||k::text,51));
 -- Exact committed proof is replayed BEFORE current eligibility; no DML, no fence fabricated.
 SELECT * INTO old FROM obrigacoes51.operacoes WHERE user_id=uid AND chave=k LIMIT 1;
 IF FOUND THEN
 IF old.request IS DISTINCT FROM r OR old.hash_request IS DISTINCT FROM obrigacoes51.hash(r) THEN RAISE EXCEPTION '51 UUID request divergente' USING ERRCODE='23505';END IF;
 IF old.resultado IS NULL OR old.hash_resultado IS DISTINCT FROM obrigacoes51.hash(old.resultado) THEN RAISE EXCEPTION '51 prova incompleta/corrompida' USING ERRCODE='23514';END IF;RETURN old.resultado;END IF;
 IF a='adicionar' AND EXISTS(SELECT 1 FROM public.multimodal_origens o JOIN public.contratos c ON c.id=o.contrato_id WHERE o.contrato_id=cid AND c.modalidade IN('semanal','quinzenal','diario') LIMIT 1) THEN PERFORM public.multimodal_barreira(uid,'multimodal_manutencao48',k,false);END IF;
 PERFORM obrigacoes51.travar(uid,cid);
 SELECT * INTO f FROM obrigacoes51.fences WHERE user_id=uid AND chave=k LIMIT 1;
 IF FOUND THEN
 IF f.request IS DISTINCT FROM r OR f.hash_request IS DISTINCT FROM obrigacoes51.hash(r) THEN RAISE EXCEPTION '51 fence request divergente' USING ERRCODE='23505';END IF;
 IF NOT recovery THEN RAISE EXCEPTION '51 UUID fenced terminal' USING ERRCODE='23514';END IF;
 RETURN jsonb_build_object('status','fenced','sameIntentOnly',true,'versao','obrigacoes51_v1','userId',uid,'idempotencyKey',k,'request',r);END IF;
 IF recovery THEN
 INSERT INTO obrigacoes51.fences(user_id,chave,contrato_id,request,hash_request) VALUES(uid,k,cid,r,obrigacoes51.hash(r));RETURN jsonb_build_object('status','fenced','sameIntentOnly',true,'versao','obrigacoes51_v1','userId',uid,'idempotencyKey',k,'request',r);END IF;
 instante:=clock_timestamp();day:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;
 IF a='adicionar' THEN b:=obrigacoes51.base(uid,cid);IF NOT(b->>'origemTipo'='multimodal35' AND b->'financeiro'->'contrato'->>'modalidade'='mensal') AND (r->>'estadoHash' IS DISTINCT FROM obrigacoes51.hash(jsonb_build_object('base',b,'dia',day::text)) OR r->>'dataCalculo' IS DISTINCT FROM day::text) THEN RAISE EXCEPTION '52 cotação/base/BRT expirou antes da elegibilidade' USING ERRCODE='40001';END IF;END IF;
 q:=obrigacoes51.cotacao(uid,cid,v,instante);
 IF q->>'estadoHash' IS DISTINCT FROM r->>'estadoHash' OR q->>'dataCalculo' IS DISTINCT FROM r->>'dataCalculo' THEN RAISE EXCEPTION '51 cotação/estado/BRT expirou' USING ERRCODE='40001';END IF;
 b:=obrigacoes51.base(uid,cid);s:=b->'financeiro';source:=b->>'origemTipo';SELECT array_agg(j::int ORDER BY ord) INTO ids FROM jsonb_array_elements_text(q->'idsAfetados') WITH ORDINALITY x(j,ord);
 INSERT INTO obrigacoes51.operacoes(user_id,chave,contrato_id,request,hash_request,antes) VALUES(uid,k,cid,r,obrigacoes51.hash(r),b) RETURNING id INTO oid51;
 IF a IN('adicionar','editar') THEN
 IF a='adicionar' AND NOT(source='multimodal35' AND s->'contrato'->>'modalidade'='mensal') THEN ids:=inclusao52.adicionar(uid,k,cid,oid51,s,v,r->>'motivo',instante,source);
 ELSIF source='multimodal35' THEN
 -- A closed action on existing48 protocol, not a fictitious receiving family.
 res:=manutencao48.executar(uid,k,cid,obrigacoes51.hash(s),v,r->>'motivo');
 IF a='adicionar' THEN SELECT array_agg(parcela_id) INTO ids FROM obrigacoes51.adicionais WHERE operacao48=(res->>'operationId')::uuid;END IF;
 ELSE
 plan:=obrigacoes51.plano(s,v,instante);expected:=s;PERFORM public.ciclo_autorizar('receber',(s->'contrato'->>'conta_caixa_id')::int,cid);
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') LOOP
 SELECT value INTO STRICT np FROM jsonb_array_elements(plan->'parcelas') WHERE value->'id'=p->'id';
 IF np IS DISTINCT FROM p THEN
 UPDATE public.parcelas SET valor=(np->>'valor')::numeric,valor_original=(np->>'valor_original')::numeric,valor_juros=(np->>'valor_juros')::numeric,data_vencimento=(np->>'data_vencimento')::date,"updatedAt"=instante WHERE id=(p->>'id')::int AND contrato_id=cid AND user_id=uid;
 IF NOT FOUND OR (SELECT to_jsonb(x) FROM public.parcelas x WHERE id=(p->>'id')::int LIMIT 1) IS DISTINCT FROM np THEN RAISE EXCEPTION '51 edição21 readback alvo divergente' USING ERRCODE='23514';END IF;END IF;END LOOP;
 UPDATE public.contratos SET total_contrato=(plan->'contrato'->>'total_contrato')::numeric,valor_parcela=(plan->'contrato'->>'valor_parcela')::numeric,data_vencimento_primeira=(plan->'contrato'->>'data_vencimento_primeira')::date,data_vencimento=(plan->'contrato'->>'data_vencimento')::date,dia_vencimento=(plan->'contrato'->>'dia_vencimento')::int,"updatedAt"=instante WHERE id=cid AND user_id=uid;
 INSERT INTO public.contrato_historico(contrato_id,user_id,tipo,descricao,created_at) VALUES(cid,uid::text,'edicao_parcela','Edição51 '||oid51::text||': '||(r->>'motivo'),instante) RETURNING to_jsonb(contrato_historico) INTO h;
 expected:=jsonb_set(jsonb_set(expected,'{contrato}',plan->'contrato'),'{parcelas}',(SELECT jsonb_agg(j ORDER BY (j->>'numero')::int,(j->>'id')::int) FROM jsonb_array_elements(plan->'parcelas') j));expected:=jsonb_set(expected,'{historico}',s->'historico'||jsonb_build_array(h));
 IF public.ciclo_snapshot(cid) IS DISTINCT FROM expected THEN RAISE EXCEPTION '51 edição21 snapshot/delta integral divergente' USING ERRCODE='23514';END IF;
 UPDATE public.ciclo_estados SET snapshot=expected WHERE contrato_id=cid AND user_id=uid AND origem_completa;IF NOT FOUND THEN RAISE EXCEPTION '51 estado21 predecessor ausente' USING ERRCODE='23514';END IF;DELETE FROM public.ciclo_autorizacoes ca WHERE ca.xid=txid_current() AND ca.pid=pg_backend_pid();PERFORM public.ciclo_validar(uid,cid);
 END IF;
 ELSIF a='cancelar' THEN
 FOREACH pid IN ARRAY ids LOOP SELECT to_jsonb(x) INTO STRICT p FROM public.parcelas x WHERE id=pid AND contrato_id=cid LIMIT 1;INSERT INTO obrigacoes51.cancelamentos VALUES(uid,cid,pid,oid51,obrigacoes51.registrada(p),(p->>'valor_pago')::numeric,p->>'status');END LOOP;
 IF v->'alvo'->>'tipo'='contrato' THEN INSERT INTO obrigacoes51.encerramentos VALUES(uid,cid,oid51);END IF;
 ELSIF a='arquivar' THEN
 INSERT INTO obrigacoes51.arquivos VALUES(uid,cid,CASE WHEN v->'alvo'->>'tipo'='parcela' THEN (v->'alvo'->>'parcelaId')::int ELSE NULL END,oid51);
 ELSIF a='quitar' THEN
 dest:=(v->>'contaCaixaId')::int;
 FOREACH pid IN ARRAY ids LOOP
 -- All calls stay inside THIS transaction. Sequential hash recotation never crosses APP/network.
 subkey:=gen_random_uuid();
 IF source='multimodal35' THEN subq:=public.multimodal_cotacao(uid,cid,pid,instante);receipt:=public.rpc_receber_emprestimo_multimodal(uid,subkey,cid,pid,(subq->>'totalExigido')::numeric,(subq->>'totalExigido')::numeric,day,subq->>'estadoHash','integral','Quitação51 dinheiro real '||oid51::text);
 ELSIF source='prospectivo21' THEN subq:=public.ciclo_cotacao(uid,cid,pid);receipt:=public.rpc_receber_emprestimo_prospectivo(uid,subkey,cid,pid,(subq->>'totalExigido')::numeric,(subq->>'totalExigido')::numeric,day,subq->>'estadoHash','integral','Quitação51 dinheiro real '||oid51::text);
 ELSE subq:=public.legados_validar(uid,cid,pid,dest);receipt:=public.rpc_receber_legado(uid,subkey,cid,pid,dest,subq->>'totalExigido',subq->>'totalExigido',day,subq->>'estadoHash',subq->>'regra','Quitação51 dinheiro real '||oid51::text);END IF;
 sumcash:=sumcash+(subq->>'totalExigido')::numeric;
 END LOOP;
 IF sumcash IS DISTINCT FROM (v->>'valorRecebido')::numeric THEN RAISE EXCEPTION '51 soma de baixas não equivale dinheiro real informado' USING ERRCODE='23514';END IF;
 END IF;
 afterb:=obrigacoes51.base(uid,cid);
 IF a IN('cancelar','arquivar') AND (afterb->'financeiro' IS DISTINCT FROM b->'financeiro' OR afterb->'conta' IS DISTINCT FROM b->'conta' OR afterb->'livroConta' IS DISTINCT FROM b->'livroConta') THEN RAISE EXCEPTION '51 renúncia/arquivo não muda base nem Caixa' USING ERRCODE='23514';END IF;
 IF a IN('adicionar','editar') AND (afterb->'financeiro'->'ledger' IS DISTINCT FROM b->'financeiro'->'ledger' OR afterb->'conta' IS DISTINCT FROM b->'conta' OR afterb->'livroConta' IS DISTINCT FROM b->'livroConta') THEN RAISE EXCEPTION '51 manutenção não movimenta Caixa' USING ERRCODE='23514';END IF;
 IF a='quitar' THEN
 SELECT coalesce(sum(t.valor),0) INTO sumcash FROM public.transacoes_caixa t WHERE t.contrato_id=cid AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'financeiro'->'ledger') oldt WHERE (oldt->>'id')::int=t.id);
 IF sumcash IS DISTINCT FROM (v->>'valorRecebido')::numeric OR EXISTS(SELECT 1 FROM public.transacoes_caixa t WHERE t.contrato_id=cid AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'financeiro'->'ledger') oldt WHERE (oldt->>'id')::int=t.id) AND (t.tipo IS DISTINCT FROM 'entrada' OR t.user_id IS DISTINCT FROM uid OR t.conta_caixa_id IS DISTINCT FROM dest OR t.parcela_id IS NULL OR NOT(t.parcela_id=ANY(ids)))) OR EXISTS(SELECT 1 FROM public.parcelas WHERE id=ANY(ids) AND (status IS DISTINCT FROM 'paga' OR saldo_residual IS DISTINCT FROM 0::numeric OR data_pagamento IS DISTINCT FROM day)) THEN RAISE EXCEPTION '51 quitação requer entradas reais e baixas integrais atômicas próprias' USING ERRCODE='23514';END IF;
 END IF;
 IF (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date IS DISTINCT FROM day THEN RAISE EXCEPTION '51 virada civil BRT, rollback inteiro' USING ERRCODE='40001';END IF;
 res:=jsonb_build_object('operationId',oid51,'contratoId',cid,'acao',a,'idsAfetados',ids,'valorRecebido',CASE WHEN a='quitar' THEN v->>'valorRecebido' ELSE '0.00' END,'contaDestinoId',dest,'caixaPreservado',a<>'quitar');closed:=obrigacoes51.fechar(uid,k,r,oid51,res);
 UPDATE obrigacoes51.operacoes SET depois=afterb,resultado=closed,hash_resultado=obrigacoes51.hash(closed),concluida_em=clock_timestamp() WHERE id=oid51;IF a='adicionar' AND NOT(source='multimodal35' AND s->'contrato'->>'modalidade'='mensal') THEN IF source='multimodal35' THEN PERFORM inclusao52.provar35(oid51);ELSE PERFORM inclusao52.provar(oid51);END IF;END IF;RETURN closed;
END $$;
CREATE OR REPLACE FUNCTION public.ciclo_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE oldj jsonb; newj jsonb; cid integer; aid integer; protegido boolean; autorizado boolean; despesa_autorizada boolean;
BEGIN
 IF inclusao52.consumir('ciclo_guardar',TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END) THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.cheques40_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.telefone41_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.assinaturas42_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.caixa37_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF public.multa36_consumir('ciclo_guardar',TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END) THEN RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;
 IF public.renovacao_consumir_capacidade(TG_TABLE_NAME,TG_OP,oldj,newj) THEN
   IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='contas_caixa' THEN
   aid:=(oldj->>'id')::int; PERFORM pg_advisory_xact_lock(22022,aid);
   IF EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens o JOIN public.contratos c ON c.id=o.contrato_id WHERE c.conta_caixa_id=aid)
     AND (TG_OP='DELETE' OR oldj->'user_id' IS DISTINCT FROM newj->'user_id' OR oldj->'saldo' IS DISTINCT FROM newj->'saldo') THEN
     RAISE EXCEPTION 'Conta protegida: owner/saldo-base/exclusão imutáveis' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='transacoes_caixa' THEN
   aid:=coalesce((newj->>'conta_caixa_id')::int,(oldj->>'conta_caixa_id')::int);
   PERFORM pg_advisory_xact_lock(22022,aid);
   IF TG_OP='UPDATE' AND (oldj->>'conta_caixa_id')::int IS DISTINCT FROM aid THEN PERFORM pg_advisory_xact_lock(22022,(oldj->>'conta_caixa_id')::int); END IF;
   protegido:=EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens o JOIN public.contratos c ON c.id=o.contrato_id WHERE c.conta_caixa_id IN(aid,(oldj->>'conta_caixa_id')::int) OR o.contrato_id IN((newj->>'contrato_id')::int,(oldj->>'contrato_id')::int))
     OR EXISTS(SELECT 1 FROM public.parcelas p JOIN public.emprestimos_rpc_origens o ON o.contrato_id=p.contrato_id WHERE p.id IN((newj->>'parcela_id')::int,(oldj->>'parcela_id')::int));
   autorizado:=EXISTS(SELECT 1 FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid() AND conta_id=aid
     AND ((acao='criar' AND newj->>'tipo'='saida' AND newj->>'categoria'='emprestimo_liberado') OR (acao='receber' AND contrato_id=(newj->>'contrato_id')::int AND newj->>'tipo'='entrada' AND newj->>'categoria'='pagamento_parcela')));
   -- 0025: consumo atômico de UMA linha exata; sem bypass de outros triggers/tabelas.
   IF TG_OP='INSERT' THEN
     DELETE FROM public.ciclo_despesas_autorizacoes a
      WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.conta_id=aid
        AND a.user_id=(newj->>'user_id')::integer AND a.esperado=newj-'id'
        AND newj->>'categoria'='despesa_operacional'
        AND newj->'contrato_id'='null'::jsonb AND newj->'parcela_id'='null'::jsonb
      RETURNING true INTO despesa_autorizada;
     IF NOT coalesce(despesa_autorizada,false) AND EXISTS(SELECT 1 FROM public.ciclo_despesas_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN
       RAISE EXCEPTION '0025: lançamento diferente da capability exata' USING ERRCODE='42501';
     END IF;
     autorizado:=autorizado OR coalesce(despesa_autorizada,false);
   END IF;
   IF protegido AND (TG_OP<>'INSERT' OR NOT autorizado) THEN RAISE EXCEPTION 'Livro protegido: somente RPC append-only' USING ERRCODE='42501'; END IF;
 ELSE
   cid:=CASE WHEN TG_TABLE_NAME='contratos' THEN coalesce((newj->>'id')::int,(oldj->>'id')::int) ELSE coalesce((newj->>'contrato_id')::int,(oldj->>'contrato_id')::int) END;
   protegido:=EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id IN(cid,(oldj->>'contrato_id')::int));
   autorizado:=EXISTS(SELECT 1 FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid() AND acao='receber' AND contrato_id=cid);
   IF protegido AND (TG_OP='DELETE' OR NOT autorizado OR (TG_TABLE_NAME='parcelas' AND TG_OP='INSERT')) THEN RAISE EXCEPTION 'Contrato/parcelas/trilha protegidos' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.legados_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE a jsonb; b jsonb; cids integer[]:='{}'; aids integer[]:='{}'; uids integer[]:='{}'; k integer; protegido boolean:=false; cap public.legados_capacidades%ROWTYPE; etapa text;
BEGIN
 IF inclusao52.consumir('legados_guardar',TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END) THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.cheques40_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.telefone41_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.assinaturas42_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.caixa37_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF public.multa36_consumir('legados_guardar',TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END) THEN RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN a:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN b:=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='contratos' THEN cids:=ARRAY[(a->>'id')::integer,(b->>'id')::integer];
 ELSE cids:=ARRAY[(a->>'contrato_id')::integer,(b->>'contrato_id')::integer]; END IF;
 IF TG_TABLE_NAME IN('parcelas','transacoes_caixa') THEN
  cids:=cids||ARRAY(SELECT contrato_id FROM public.parcelas WHERE id IN((a->>'parcela_id')::integer,(b->>'parcela_id')::integer));
 END IF;
 IF TG_TABLE_NAME='emprestimos_rpc_operacoes' THEN
  cids:=cids||ARRAY[(a->'resultado'->>'id')::integer,(b->'resultado'->>'id')::integer];
  aids:=aids||ARRAY[(a->'payload'->>'contaCaixaId')::integer,(b->'payload'->>'contaCaixaId')::integer];
  uids:=uids||ARRAY[(a->'payload'->>'userId')::integer,(b->'payload'->>'userId')::integer];
 END IF;
 aids:=aids||ARRAY[(a->>'conta_caixa_id')::integer,(b->>'conta_caixa_id')::integer];
 IF TG_TABLE_NAME='contas_caixa' THEN aids:=aids||ARRAY[(a->>'id')::integer,(b->>'id')::integer]; END IF;
 aids:=aids||ARRAY(SELECT conta_caixa_id FROM public.contratos WHERE id=ANY(cids));
 uids:=uids||ARRAY[(a->>'user_id')::integer,(b->>'user_id')::integer];
 IF TG_TABLE_NAME='users' THEN uids:=uids||ARRAY[(a->>'id')::integer,(b->>'id')::integer]; END IF;
 uids:=uids||ARRAY(SELECT user_id FROM public.contratos WHERE id=ANY(cids))||ARRAY(SELECT user_id FROM public.contas_caixa WHERE id=ANY(aids));
 FOR k IN SELECT DISTINCT v FROM unnest(aids) v WHERE v IS NOT NULL ORDER BY v LOOP
  IF NOT pg_try_advisory_xact_lock(22022,k) THEN RAISE EXCEPTION 'PROTOCOLO_CONCORRENTE' USING ERRCODE='40001'; END IF;
 END LOOP;
 FOR k IN SELECT DISTINCT v FROM unnest(uids) v WHERE v IS NOT NULL ORDER BY v LOOP
  IF NOT pg_try_advisory_xact_lock(34034,k) THEN RAISE EXCEPTION 'PROTOCOLO_CONCORRENTE' USING ERRCODE='40001'; END IF;
 END LOOP;
 FOR k IN SELECT DISTINCT v FROM unnest(cids) v WHERE v IS NOT NULL ORDER BY v LOOP
  IF NOT pg_try_advisory_xact_lock(34035,k) THEN RAISE EXCEPTION 'PROTOCOLO_CONCORRENTE' USING ERRCODE='40001'; END IF;
 END LOOP;
 -- Owners dos vínculos financeiros concluídos não mudam silenciosamente após o commit.
 IF TG_TABLE_NAME IN('clientes','koletores') AND TG_OP<>'INSERT' AND
  (TG_OP='DELETE' OR a->'user_id' IS DISTINCT FROM b->'user_id') AND EXISTS(
   SELECT 1 FROM public.legados_estados e JOIN public.contratos c ON c.id=e.contrato_id WHERE
    (TG_TABLE_NAME='clientes' AND c.cliente_id=(a->>'id')::integer) OR
    (TG_TABLE_NAME='koletores' AND (c.koletor_id=(a->>'id')::integer OR EXISTS(SELECT 1 FROM public.parcelas p WHERE p.contrato_id=c.id AND p.koletor_id=(a->>'id')::integer)))
  ) THEN RAISE EXCEPTION 'OWNER_LEGADO_IMUTAVEL' USING ERRCODE='42501'; END IF;
 -- Proteção pós-adesão é só novo estado financeiro, não origem e não saneamento.
 protegido:=EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=ANY(cids));
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP<>'INSERT' AND EXISTS(
  SELECT 1 FROM public.legados_auditoria au WHERE au.transacao_id=(a->>'id')::integer
 ) THEN protegido:=true; END IF;
 IF TG_TABLE_NAME='contas_caixa' AND TG_OP<>'INSERT' AND EXISTS(
  SELECT 1 FROM public.legados_estados e JOIN public.contratos c ON c.id=e.contrato_id WHERE c.conta_caixa_id=(a->>'id')::integer OR EXISTS(SELECT 1 FROM public.parcelas p WHERE p.contrato_id=c.id AND p.conta_caixa_id=(a->>'id')::integer)
  UNION ALL SELECT 1 FROM public.legados_auditoria au JOIN public.transacoes_caixa t ON t.id=au.transacao_id WHERE t.conta_caixa_id=(a->>'id')::integer
 ) AND (TG_OP='DELETE' OR a->'user_id' IS DISTINCT FROM b->'user_id' OR a->'saldo' IS DISTINCT FROM b->'saldo') THEN
  RAISE EXCEPTION 'CONTA_LEGADA_IMUTAVEL' USING ERRCODE='42501'; END IF;
 IF protegido THEN
  etapa:=CASE TG_TABLE_NAME WHEN 'parcelas' THEN 'parcela' WHEN 'contratos' THEN 'contrato' WHEN 'transacoes_caixa' THEN 'ledger' WHEN 'contrato_historico' THEN 'historico' END;
  SELECT * INTO cap FROM public.legados_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid();
  IF etapa IS NULL OR cap.etapa IS DISTINCT FROM etapa OR TG_OP='DELETE'
   OR (TG_TABLE_NAME='parcelas' AND (TG_OP<>'UPDATE' OR (b->>'id')::integer IS DISTINCT FROM cap.parcela_id OR (b->>'contrato_id')::integer IS DISTINCT FROM cap.contrato_id))
   OR (TG_TABLE_NAME='contratos' AND (TG_OP<>'UPDATE' OR (b->>'id')::integer IS DISTINCT FROM cap.contrato_id))
   OR (TG_TABLE_NAME IN('transacoes_caixa','contrato_historico') AND (TG_OP<>'INSERT' OR (b->>'contrato_id')::integer IS DISTINCT FROM cap.contrato_id))
   OR (TG_TABLE_NAME='transacoes_caixa' AND ((b->>'conta_caixa_id')::integer IS DISTINCT FROM cap.conta_id OR (b->>'parcela_id')::integer IS DISTINCT FROM cap.parcela_id OR b->>'tipo' IS DISTINCT FROM 'entrada' OR b->>'categoria' IS DISTINCT FROM 'pagamento_parcela')) THEN
   RAISE EXCEPTION 'HISTORICO_LEGADO_PROTEGIDO' USING ERRCODE='42501'; END IF;
  DELETE FROM public.legados_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid();
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.legados_validar(uid integer,cid integer,pid integer,aid integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $fn$
DECLARE c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; alvo public.parcelas%ROWTYPE; t public.transacoes_caixa%ROWTYPE;
 a public.contas_caixa%ROWTYPE; h public.contrato_historico%ROWTYPE; ids integer[]; s jsonb; e public.legados_estados%ROWTYPE;
 soma numeric; pernas integer; n integer; renov boolean; hj date:=(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 PERFORM public.legados_verificar();
 IF uid IS NULL OR uid<=0 OR cid IS NULL OR cid<=0 OR pid IS NULL OR pid<=0 OR aid IS NULL OR aid<=0 THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.contratos WHERE id=cid;
 SELECT * INTO alvo FROM public.parcelas WHERE id=pid;
 IF c.id IS NULL OR c.user_id IS DISTINCT FROM uid OR alvo.id IS NULL OR alvo.contrato_id IS DISTINCT FROM cid OR alvo.user_id IS DISTINCT FROM uid OR alvo.cliente_id IS DISTINCT FROM c.cliente_id
  OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=uid)
  OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=aid AND user_id=uid AND ativo IS TRUE) THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.ciclo_estados WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.ciclo_operacoes WHERE contrato_id=cid)
  OR EXISTS(SELECT 1 FROM public.emprestimos_rpc_operacoes WHERE (resultado->>'id')::integer=cid OR (auditoria->'contrato'->>'id')::integer=cid) THEN RAISE EXCEPTION 'TRILHO_PROSPECTIVO' USING ERRCODE='23514'; END IF;
 IF c.status NOT IN('ativo','atrasado') OR c.status IS NULL OR c.modalidade IS DISTINCT FROM 'mensal' OR c.tipo_taxa IS DISTINCT FROM 'mensal' OR c.contrato_origem_id IS NOT NULL THEN RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514'; END IF;
 IF c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid) THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
 IF to_regclass('public.parcelas_renovacoes') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.parcelas_renovacoes WHERE contrato_id=$1)' INTO renov USING cid;
  IF renov THEN RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514'; END IF;
 END IF;
 SELECT * INTO e FROM public.legados_estados WHERE contrato_id=cid;
 s:=public.legados_snapshot(cid);
 IF e.contrato_id IS NOT NULL AND (e.user_id IS DISTINCT FROM uid OR e.snapshot IS DISTINCT FROM s) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
 ids:=ARRAY[aid,c.conta_caixa_id]||ARRAY(SELECT conta_caixa_id FROM public.parcelas WHERE contrato_id=cid)||ARRAY(SELECT conta_caixa_id FROM public.transacoes_caixa WHERE contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid));
 FOR n IN SELECT DISTINCT v FROM unnest(ids) v WHERE v IS NOT NULL ORDER BY v LOOP
  SELECT * INTO a FROM public.contas_caixa WHERE id=n;
  IF a.id IS NULL OR a.user_id IS DISTINCT FROM uid OR a.ativo IS DISTINCT FROM true THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
  -- Saldo-base não é reconciliado/alterado; negativo é válido para entrada.
  IF NOT public.legados_moeda(a.saldo) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens o JOIN public.contratos co ON co.id=o.contrato_id WHERE co.conta_caixa_id=n)
   OR EXISTS(SELECT 1 FROM public.ciclo_estados ce JOIN public.contratos co ON co.id=ce.contrato_id WHERE co.conta_caixa_id=n) THEN RAISE EXCEPTION 'CONTA_PROTEGIDA' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid GROUP BY numero HAVING count(*)>1) THEN RAISE EXCEPTION 'DESCENDENTE_INVALIDO' USING ERRCODE='23514'; END IF;
 FOR p IN SELECT * FROM public.parcelas WHERE contrato_id=cid ORDER BY id LOOP
  IF p.user_id IS DISTINCT FROM uid OR p.cliente_id IS DISTINCT FROM c.cliente_id OR (p.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=p.koletor_id AND user_id=uid)) THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
  IF p.numero IS NULL OR p.numero<=0 OR p.numero_parcela IS NULL OR p.numero_parcela IS DISTINCT FROM p.numero THEN RAISE EXCEPTION 'ALIAS_DIVERGENTE' USING ERRCODE='23514'; END IF;
  IF NOT public.legados_moeda(p.valor) OR p.valor<=0 OR (p.valor_original IS NOT NULL AND (NOT public.legados_moeda(p.valor_original) OR p.valor_original IS DISTINCT FROM p.valor)) OR p.data_vencimento IS NULL OR NOT isfinite(p.data_vencimento) THEN RAISE EXCEPTION 'PRINCIPAL_INVALIDO' USING ERRCODE='23514'; END IF;
  IF p.valor_juros IS DISTINCT FROM 0::numeric OR p.valor_multa IS DISTINCT FROM 0::numeric OR p.valor_desconto IS DISTINCT FROM 0::numeric OR p.multa_manual IS DISTINCT FROM 0::numeric OR p.multa_diaria_usada IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'ENCARGOS_AMBIGUOS' USING ERRCODE='23514'; END IF;
  IF to_jsonb(p) ? 'contagem_renovacoes' AND (to_jsonb(p)->>'contagem_renovacoes')::integer IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514'; END IF;
  SELECT count(*),coalesce(sum(valor),0) INTO pernas,soma FROM public.transacoes_caixa WHERE parcela_id=p.id;
  IF p.status IN('pendente','atrasada','atrasado','vencendo_hoje') THEN
   IF pernas<>0 OR (p.valor_pago IS NOT NULL AND p.valor_pago IS DISTINCT FROM 0::numeric) OR p.saldo_residual IS DISTINCT FROM 0::numeric OR p.data_pagamento IS NOT NULL THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  ELSIF p.status IN('paga','pago') AND p.id<>pid THEN
   IF pernas=0 OR p.valor_pago IS DISTINCT FROM p.valor OR p.saldo_residual IS DISTINCT FROM 0::numeric OR p.data_pagamento IS NULL OR NOT isfinite(p.data_pagamento) OR soma IS DISTINCT FROM p.valor_pago
    OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE parcela_id=p.id AND (tipo IS DISTINCT FROM 'entrada' OR categoria IS DISTINCT FROM 'pagamento_parcela' OR data_transacao IS DISTINCT FROM p.data_pagamento)) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  ELSE RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514'; END IF;
 END LOOP;
 -- Ledger inteiro de TODAS contas pertinentes e vínculos, jamais filtrado por owner.
 FOR t IN SELECT * FROM public.transacoes_caixa WHERE conta_caixa_id=ANY(ids) OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid) ORDER BY id LOOP
  IF t.user_id IS DISTINCT FROM uid OR NOT public.legados_moeda(t.valor) OR t.valor<=0 OR t.tipo IS NULL OR t.tipo NOT IN('entrada','saida') OR t.data_transacao IS NULL OR NOT isfinite(t.data_transacao)
   OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=t.conta_caixa_id AND user_id=uid AND ativo IS TRUE) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  IF t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas pp JOIN public.contratos cc ON cc.id=pp.contrato_id WHERE pp.id=t.parcela_id AND pp.user_id=uid AND cc.user_id=uid AND pp.cliente_id=cc.cliente_id AND pp.contrato_id=t.contrato_id) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  IF t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos WHERE id=t.contrato_id AND user_id=uid) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  -- Sem regra para atribuir entrada avulsa ou estorno: recusar, não inferir zero líquido.
  IF NOT public.caixa37_perna_comprovada(t.id,uid) AND ((t.tipo='entrada' AND t.parcela_id IS NULL) OR (t.contrato_id=cid AND t.parcela_id IS NULL AND (t.tipo IS DISTINCT FROM 'saida' OR t.categoria IS DISTINCT FROM 'emprestimo_liberado' OR t.conta_caixa_id IS DISTINCT FROM c.conta_caixa_id OR t.valor IS DISTINCT FROM c.valor_principal OR t.data_transacao IS DISTINCT FROM c.data_inicio)) OR (t.contrato_id IS NULL AND t.parcela_id IS NULL) ) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR h IN SELECT * FROM public.contrato_historico WHERE contrato_id=cid LOOP
  IF h.user_id IS DISTINCT FROM uid::text THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
  IF h.tipo='inclusao_obrigacao' THEN IF NOT inclusao52.historico_valido(uid,cid,to_jsonb(h)) THEN RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514';END IF;ELSIF h.tipo IS NULL OR h.tipo NOT IN('criacao','pagamento') OR (h.tipo='pagamento' AND NOT EXISTS(SELECT 1 FROM public.legados_auditoria WHERE historico_id=h.id AND user_id=uid)) THEN RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514'; END IF;
 END LOOP;
 -- PII não sai da RPC: prova/hash somente no backend. Conta/owners fazem parte da cotação.
 s:=s||jsonb_build_object('cliente',(SELECT jsonb_build_object('id',id,'user_id',user_id) FROM public.clientes WHERE id=c.cliente_id),
  'contas',(SELECT jsonb_agg(to_jsonb(ac) ORDER BY ac.id) FROM public.contas_caixa ac WHERE ac.id=ANY(ids)),
  'koletores',(SELECT jsonb_agg(jsonb_build_object('id',id,'user_id',user_id) ORDER BY id) FROM public.koletores WHERE id=c.koletor_id OR id IN(SELECT koletor_id FROM public.parcelas WHERE contrato_id=cid)),
  'livroContas',(SELECT coalesce(jsonb_agg(to_jsonb(tx) ORDER BY tx.id),'[]'::jsonb) FROM public.transacoes_caixa tx WHERE tx.conta_caixa_id=ANY(ids)),
  'regra','recebimento_legado_sem_recalculo_v1','contaDestino',aid,'diaBrt',hj);
 RETURN jsonb_build_object('elegivel',true,'regra','recebimento_legado_sem_recalculo_v1','contratoId',cid,'parcelaId',pid,'contaCaixaId',aid,
  'totalExigido',alvo.valor::numeric(12,2)::text,'estadoHash',encode(extensions.digest(s::text,'sha256'),'hex'),'dataPagamento',hj,'validadeDataCivil',hj);
END;
$fn$;

CREATE FUNCTION inclusao52.metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT obrigacoes51.hash(jsonb_build_object('schema',(SELECT to_jsonb(n) FROM pg_namespace n WHERE nspname='inclusao52'),'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace='inclusao52'::regnamespace OR oid=to_regprocedure('public.rpc_capacidade_inclusao52()')),'classes',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY oid) FROM pg_class c WHERE relnamespace='inclusao52'::regnamespace),'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE relnamespace='inclusao52'::regnamespace),'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE connamespace='inclusao52'::regnamespace),'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE relnamespace='inclusao52'::regnamespace),'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE relnamespace='inclusao52'::regnamespace),'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE relnamespace='inclusao52'::regnamespace),'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY indexrelid) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE relnamespace='inclusao52'::regnamespace)));
$$;
CREATE FUNCTION inclusao52.verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN PERFORM obrigacoes51.verificar();IF (SELECT assinatura FROM inclusao52.manifesto WHERE id=1 LIMIT 1) IS DISTINCT FROM inclusao52.metadata() THEN RAISE EXCEPTION '52 catálogo divergente; sem reseal runtime' USING ERRCODE='55000';END IF;END $$;
CREATE FUNCTION public.rpc_capacidade_inclusao52() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN PERFORM inclusao52.verificar();RETURN jsonb_build_object('versao','inclusao52_v1','predecessor','obrigacoes51_v1','disponivel',true,'coortes',jsonb_build_array('prospectivo21_mensal','multimodal35_semanal','multimodal35_quinzenal','multimodal35_diario','legado34_mensal_estrito'),'classificacao','obrigacao_adicional_nao_desembolsada','caixaPreservado',true);END $$;
DO $$ DECLARE p record;t text;BEGIN
 FOR p IN SELECT oid FROM pg_proc WHERE pronamespace='inclusao52'::regnamespace OR oid=to_regprocedure('public.rpc_capacidade_inclusao52()') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.oid::regprocedure);END LOOP;
 GRANT EXECUTE ON FUNCTION public.rpc_capacidade_inclusao52() TO service_role;
 FOREACH t IN ARRAY ARRAY['manifesto','adicionais','capacidades'] LOOP EXECUTE format('ALTER TABLE inclusao52.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON inclusao52.%I FROM PUBLIC,anon,authenticated,service_role',t);END LOOP;
END $$;
DO $after52$ DECLARE e jsonb;BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"obrigacoes51.base","bodyHash":"19c1a8986974444e699e87a40640a25768291d0a3c0ec20b3d33c92bce758f24","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"obrigacoes51.eventos_leitura","bodyHash":"e6fbe9c6a8823c8de858d76b4482e3d06033c5779f6ebf405c961fd52da92b70","config":["search_path=pg_catalog, pg_temp"]},{"name":"obrigacoes51.estado","bodyHash":"cbdb504680ef4d27df0ed4b7171354545c3c6c8c3c152f3d98090f8ddfde971b","config":["search_path=pg_catalog, pg_temp"]},{"name":"obrigacoes51.plano","bodyHash":"cb575b453113ccbe2e5a0baed27d3e7183f396d9c87878329fd9fa67fe5832af","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"obrigacoes51.replay21","bodyHash":"dbc1e4b4f015b6036964c24848af0a76ca6a8dad15efd0a0874ed8ff92907679","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"manutencao44.validar","bodyHash":"184dad23a7d3a8fd6f54a5354a2dd09660971b0e7f15b796bad0cdd0114c8af1","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"obrigacoes51.cotacao","bodyHash":"73b7a390ffd043198985eae42e8d892bec1a24e159f17eae0cda98b5b915fa57","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"obrigacoes51.executar","bodyHash":"846fdc658f7ed58b519b62c66d73bb1d41c7643bd5fc855d4c366356bf0ff801","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"public.ciclo_guardar","bodyHash":"3c3bf035a3dd8a0b817cddda0b04851b808d83fedc70531dc7fc1d99c5c5aa66","config":["search_path=pg_catalog, pg_temp"]},{"name":"public.legados_guardar","bodyHash":"16549fd46e41abbbff304dd3fd3df3f18a10758dd640407798cad56ebcec2537","config":["search_path=pg_catalog, pg_temp"]},{"name":"public.legados_validar","bodyHash":"58d2d9afe8c86dbe27344bdad0d6a011ec7098896fef5a46776730615c777a63","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"inclusao52.plano","bodyHash":"7d63b4eea6064a40897a7a2f72c3a0ba23dc74fc6b8961dbffde4c02ff9c3e75","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"inclusao52.consumir","bodyHash":"6749704400d7c07ce16eabbf5f038884512021c7ba6310ec91fd9c58846881a4","config":["search_path=pg_catalog, pg_temp"]},{"name":"inclusao52.escrever","bodyHash":"5b8d071f35ad042b23e1d76c92d9e0d913adba441c9b3dcd732189abe8641d9a","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"inclusao52.provar","bodyHash":"6c838ab5d648b71fcb337681ad86c0dd48ed92379376074e79df3e228fe50a6a","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"inclusao52.historico_valido","bodyHash":"f45bf25dec2f3349caedc00b093ddd7f14b6f39b09c1c2d67b4c0d319e89d021","config":["search_path=pg_catalog, pg_temp"]},{"name":"inclusao52.commit_check","bodyHash":"002d44bbf2275b923ae0f715b324a5be55b738a941671087a1d1bd4e78c4b373","config":["search_path=pg_catalog, pg_temp"]},{"name":"inclusao52.provar35","bodyHash":"683de1daec82f41ab882c21ce3d2c4de2cd2677c8c753aae2047d43b2512376b","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"inclusao52.validar35","bodyHash":"6e9639e1105dfe76b2cc3dfd6d8e58181d9e85dbc712d69ef9e6f42228da58e8","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"inclusao52.validar","bodyHash":"08cfd6d4a4015634678998447628930f30fb448e5338641b022926023a7c11ad","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"inclusao52.adicionar","bodyHash":"5c78149f6bb5d68b3dd9e7fb6055e0c9adc76803f0acdc77e24d03efa56c7210","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"inclusao52.metadata","bodyHash":"07f5c179922c216d3b9475180cc9799672056f5c8fc31299a2f3101cf61630e8","config":["search_path=pg_catalog, pg_temp"]},{"name":"inclusao52.verificar","bodyHash":"a37ebb05e7186063f0b2bd3594a8cbf28d3294cf3fe3bf99c4d8d0da46b23ce0","config":["search_path=pg_catalog, pg_temp"]},{"name":"public.rpc_capacidade_inclusao52","bodyHash":"5316e00d1f818800ad19ffdb5684d3768e7a83f5bfafd00d2d76f7eb7a92554c","config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name' AND p.proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres' LIMIT 1) AND p.prosecdef AND to_jsonb(p.proconfig)=e->'config' AND encode(extensions.digest(p.prosrc,'sha256'),'hex')=e->>'bodyHash' AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE') AND has_function_privilege('service_role',p.oid,'EXECUTE')=(e->>'name'='public.rpc_capacidade_inclusao52') LIMIT 1) THEN RAISE EXCEPTION '52 successor pin/config/ACL divergente %',e->>'name' USING ERRCODE='55000';END IF;END LOOP;
 IF EXISTS(SELECT 1 FROM witness52_functions w LEFT JOIN pg_proc p ON p.oid=w.oid WHERE CASE WHEN '["obrigacoes51.base","obrigacoes51.eventos_leitura","obrigacoes51.estado","obrigacoes51.plano","obrigacoes51.replay21","manutencao44.validar","obrigacoes51.cotacao","obrigacoes51.executar","public.ciclo_guardar","public.legados_guardar","public.legados_validar"]'::jsonb @> to_jsonb(w.name) THEN to_jsonb(p)-'prosrc' IS DISTINCT FROM w.snapshot-'prosrc' ELSE to_jsonb(p) IS DISTINCT FROM w.snapshot END LIMIT 1) THEN RAISE EXCEPTION '52 predecessor function fora allowlist prosrc' USING ERRCODE='55000';END IF;

 IF EXISTS(SELECT 1 FROM witness52_attributes w LEFT JOIN pg_attribute a ON a.attrelid=w.attrelid AND a.attnum=w.attnum WHERE to_jsonb(a) IS DISTINCT FROM w.snapshot LIMIT 1) THEN RAISE EXCEPTION '52 predecessor rowtype mudou' USING ERRCODE='55000';END IF;
 IF EXISTS(SELECT 1 FROM witness52_catalog w LEFT JOIN (SELECT 'class' kind,c.oid,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] snapshot FROM pg_class c UNION ALL SELECT 'trigger',oid,to_jsonb(t) FROM pg_trigger t UNION ALL SELECT 'constraint',oid,to_jsonb(c) FROM pg_constraint c UNION ALL SELECT 'policy',oid,to_jsonb(p) FROM pg_policy p UNION ALL SELECT 'default',oid,to_jsonb(d) FROM pg_attrdef d UNION ALL SELECT 'index',indexrelid,to_jsonb(i) FROM pg_index i) a ON a.kind=w.kind AND a.oid=w.oid WHERE a.snapshot IS DISTINCT FROM w.snapshot LIMIT 1) THEN RAISE EXCEPTION '52 predecessor catálogo fora allowlist' USING ERRCODE='55000';END IF;
END $after52$;
-- INSTALL ONLY after allowlisted body witnesses; no flags, financial rows or old trails.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
UPDATE manutencao44.manifesto SET assinatura=manutencao44.metadata() WHERE id=1;
UPDATE calendario46.manifesto SET assinatura=calendario46.metadata() WHERE id=1;
ALTER TABLE private47.manifesto DISABLE TRIGGER imutavel47;
UPDATE private47.manifesto m SET predecessoras=(SELECT jsonb_object_agg(e.key,CASE WHEN '["obrigacoes51.base","obrigacoes51.eventos_leitura","obrigacoes51.estado","obrigacoes51.plano","obrigacoes51.replay21","manutencao44.validar","obrigacoes51.cotacao","obrigacoes51.executar","public.ciclo_guardar","public.legados_guardar","public.legados_validar"]'::jsonb @> to_jsonb(n.nspname||'.'||p.proname) THEN to_jsonb(p) ELSE e.value END) FROM jsonb_each(m.predecessoras) e JOIN pg_proc p ON p.oid=e.key::oid JOIN pg_namespace n ON n.oid=p.pronamespace),assinatura=private47.metadata() WHERE id=1;
ALTER TABLE private47.manifesto ENABLE TRIGGER imutavel47;
DO $$ DECLARE sig text;BEGIN sig:=private47.metadata();ALTER TABLE private47.manifesto DISABLE TRIGGER imutavel47;UPDATE private47.manifesto SET assinatura=sig WHERE id=1;ALTER TABLE private47.manifesto ENABLE TRIGGER imutavel47;END $$;
UPDATE manutencao48.manifesto SET assinatura=manutencao48.metadata() WHERE id=1;
UPDATE obrigacoes51.manifesto SET assinatura=obrigacoes51.metadata() WHERE id=1;
INSERT INTO inclusao52.manifesto VALUES(1,inclusao52.metadata());
SELECT inclusao52.verificar();
COMMIT;
