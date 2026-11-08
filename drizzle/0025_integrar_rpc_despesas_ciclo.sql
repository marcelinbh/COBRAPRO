-- 0025: integração LOCAL mínima de 0020 + 0021 + 0022; one-shot, fail-closed.
-- Não certifica legado nem autoriza rollout. Nenhuma escrita de dados antigos.
-- Owners devem ser current_user: postgres em produção, ubuntu no fixture sintético.
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(20261107,20);
SELECT pg_catalog.pg_advisory_xact_lock(20261108,25);
DO $preflight$
DECLARE expected jsonb; actual jsonb; constraint_casts jsonb; r record; fid oid; owner_oid oid;
BEGIN
 IF current_setting('server_version_num')::int/10000<>17 THEN RAISE EXCEPTION '0025: requer PostgreSQL17 exato'; END IF;
 SELECT oid INTO owner_oid FROM pg_catalog.pg_roles WHERE rolname=current_user;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto' AND n.nspname='extensions') THEN RAISE EXCEPTION '0025: pgcrypto extensions obrigatório'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN('service_role','anon','authenticated') AND (rolsuper OR pg_has_role(oid,owner_oid,'MEMBER'))) THEN RAISE EXCEPTION '0025: caller role privilegiada/owner membership'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relname='ciclo_despesas_autorizacoes') THEN RAISE EXCEPTION '0025: capability homônima/reaplicação recusada'; END IF;
 -- Comparação de TODOS os corpos 0020/21/22 e metadados, não apenas nomes.
 expected := '[{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_contrato integer","types":"text, integer, integer","result":"void","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4d0e4fab1cee716b3eca5dbb261f36e47383276b9982dbc2c4629b7917348729","defaults":null},{"proname":"ciclo_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2014f6ae985ced68bc9f5edb938763b3edbf021d0cde91406fb4746f9dee96ae","defaults":null},{"proname":"ciclo_encargos","args":"p_original numeric, p_multa numeric, p_mora numeric, p_vencimento date, p_instante timestamp with time zone","types":"numeric, numeric, numeric, date, timestamp with time zone","result":"jsonb","lang":"sql","prosecdef":false,"provolatile":"i","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d3487e4663c8d2a5f917cf1e61a9d00c4314de10e48c5c2db0da40155c227dd1","defaults":null},{"proname":"ciclo_finalizar_criacao","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"876c462d273e641da7351f56fcd4608939c4c76d7a424d83774f913426974b3b","defaults":null},{"proname":"ciclo_guardar","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"f120151dd3f4de11381b60a15402e05bdcb8187fed1cb40c536a8f1be8d7eb2e","defaults":null},{"proname":"ciclo_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"673632820324638377f46d8b4011c35249c59001ff878d03880cb586f728c434","defaults":null},{"proname":"ciclo_snapshot","args":"p_contrato integer","types":"integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"5573383b340f3d434d9f68d1b450eddd1d32b1d236a705fc818a57f2ca6333bd","defaults":null},{"proname":"ciclo_validar","args":"p_user integer, p_contrato integer","types":"integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d7c746affad83bf7200a5fe45577f746e2f16e662215efcdfa10e36915d67ea2","defaults":null},{"proname":"despesas_rpc_executar","args":"p_user_id integer, p_chave_idempotencia uuid, p_tipo text, p_payload jsonb","types":"integer, uuid, text, jsonb","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"2a66afef3714bc03d2e64e0ee338c42fe8eb9c9d6ec24da62df5b3e247f04e54","defaults":null},{"proname":"rpc_cotar_emprestimo_prospectivo","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"03f44f5198c9b8360458158aa07dd8961d6a58abfe86efdaacfca76ced6eed31","defaults":null},{"proname":"rpc_criar_despesa_prospectiva","args":"p_user_id integer, p_descricao text, p_categoria text, p_valor numeric, p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid","types":"integer, text, text, numeric, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"5ec9afba4e0fc002b2a35668fb051ddbeb4928b07ce5cbd9193de6ddc2ce0c2f","defaults":null},{"proname":"rpc_criar_emprestimo","args":"p_user_id integer, p_chave_idempotencia uuid, p_cliente_id integer, p_conta_caixa_id integer, p_modalidade text, p_tipo_taxa text, p_valor_principal numeric, p_taxa_juros numeric, p_numero_parcelas integer, p_data_inicio date, p_data_desembolso date, p_vencimentos date[], p_descricao text, p_observacoes text","types":"integer, uuid, integer, integer, text, text, numeric, numeric, integer, date, date, date[], text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":2,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"da42793f843737e74b52111a9e1db50d15a11f7f5bb1fc23d3257cc4df245d38","defaults":"NULL::text, NULL::text"},{"proname":"rpc_estornar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid, p_data_estorno date, p_motivo text, p_chave_idempotencia uuid","types":"integer, integer, uuid, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"21e8ef83b6e15bf4ea6b95da37d5c53066976398569a54caabc1e8f727b9ce52","defaults":null},{"proname":"rpc_pagar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid","types":"integer, integer, integer, date, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"4141fda7c7b4710e9b8d5ad1e89ab6ff6beb1e273ecc59c3ee2ac582dfa942ac","defaults":null},{"proname":"rpc_receber_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"59446e73faf55c1dce25c38d833182bd79f15551b1914550d588736773b6bf4f","defaults":"NULL::text"}]'::jsonb;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.proname IN(SELECT x->>'proname' FROM jsonb_array_elements(expected) x)
   AND (p.pronamespace<>'public'::regnamespace OR p.proowner<>owner_oid)) THEN RAISE EXCEPTION '0025: schema/owner de função incompatível'; END IF;
 SELECT jsonb_agg(jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),'types',oidvectortypes(p.proargtypes),'result',pg_get_function_result(p.oid),'lang',l.lanname,'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,'pronargdefaults',p.pronargdefaults,'defaults',pg_get_expr(p.proargdefaults,0),'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) ORDER BY p.proname)
 INTO actual FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.proname IN(SELECT x->>'proname' FROM jsonb_array_elements(expected) x);
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0025: corpo/hash/overload/assinatura/configuração incompatível'; END IF;
 FOR r IN SELECT p.* FROM pg_catalog.pg_proc p WHERE p.proname IN(SELECT x->>'proname' FROM jsonb_array_elements(expected) x) LOOP
   IF EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(r.proacl,pg_catalog.acldefault('f',r.proowner))) g WHERE g.grantee<>owner_oid AND NOT(r.proname LIKE 'rpc_%' AND g.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role') AND g.privilege_type='EXECUTE' AND NOT g.is_grantable))
     OR (r.proname LIKE 'rpc_%' AND NOT has_function_privilege('service_role',r.oid,'EXECUTE'))
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_depend WHERE classid='pg_proc'::regclass AND objid=r.oid AND deptype='e') THEN RAISE EXCEPTION '0025: grants/dependência de função incompatível: %',r.proname; END IF;
 END LOOP;
 -- Metadados normalizados sem OIDs: todas colunas/defaults/CHECKs/FKs/índices das trilhas.
 expected := '[{"relname":"ciclo_autorizacoes","relrowsecurity":true,"relforcerowsecurity":false,"relkind":"r","relpersistence":"p","relispartition":false,"columns":[[1,"xid","bigint",true,"","",null,null],[2,"pid","integer",true,"","",null,null],[3,"acao","text",true,"","","default",null],[4,"conta_id","integer",true,"","",null,null],[5,"contrato_id","integer",false,"","",null,null]],"constraints":[["ciclo_autorizacoes_acao_check","c",true,false,false,"CHECK ((acao = ANY (ARRAY[''criar''::text, ''receber''::text])))"],["ciclo_autorizacoes_conta_id_fkey","f",true,false,false,"FOREIGN KEY (conta_id) REFERENCES contas_caixa(id) ON DELETE RESTRICT"],["ciclo_autorizacoes_contrato_id_fkey","f",true,false,false,"FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE RESTRICT"],["ciclo_autorizacoes_pkey","p",true,false,false,"PRIMARY KEY (xid, pid)"]],"indexes":[["ciclo_autorizacoes_pkey",true,true,true,"CREATE UNIQUE INDEX ciclo_autorizacoes_pkey ON public.ciclo_autorizacoes USING btree (xid, pid)"]]},{"relname":"ciclo_estados","relrowsecurity":true,"relforcerowsecurity":false,"relkind":"r","relpersistence":"p","relispartition":false,"columns":[[1,"contrato_id","integer",true,"","",null,null],[2,"user_id","integer",true,"","",null,null],[3,"snapshot","jsonb",true,"","",null,null],[4,"origem_completa","boolean",true,"","",null,null],[5,"created_at","timestamp with time zone",true,"","",null,"now()"]],"constraints":[["ciclo_estados_contrato_id_fkey","f",true,false,false,"FOREIGN KEY (contrato_id) REFERENCES emprestimos_rpc_origens(contrato_id) ON DELETE RESTRICT"],["ciclo_estados_pkey","p",true,false,false,"PRIMARY KEY (contrato_id)"],["ciclo_estados_user_id_fkey","f",true,false,false,"FOREIGN KEY (user_id) REFERENCES users(id)"]],"indexes":[["ciclo_estados_pkey",true,true,true,"CREATE UNIQUE INDEX ciclo_estados_pkey ON public.ciclo_estados USING btree (contrato_id)"]]},{"relname":"ciclo_operacoes","relrowsecurity":true,"relforcerowsecurity":false,"relkind":"r","relpersistence":"p","relispartition":false,"columns":[[1,"id","uuid",true,"","",null,"gen_random_uuid()"],[2,"user_id","integer",true,"","",null,null],[3,"chave_idempotencia","uuid",true,"","",null,null],[4,"hash_payload","text",true,"","","default",null],[5,"contrato_id","integer",true,"","",null,null],[6,"parcela_id","integer",true,"","",null,null],[7,"payload","jsonb",true,"","",null,null],[8,"resultado","jsonb",false,"","",null,null],[9,"auditoria","jsonb",false,"","",null,null],[10,"concluida_em","timestamp with time zone",false,"","",null,null]],"constraints":[["ciclo_operacoes_check","c",true,false,false,"CHECK ((((resultado IS NULL) AND (auditoria IS NULL) AND (concluida_em IS NULL)) OR ((resultado IS NOT NULL) AND (auditoria IS NOT NULL) AND (concluida_em IS NOT NULL))))"],["ciclo_operacoes_contrato_id_fkey","f",true,false,false,"FOREIGN KEY (contrato_id) REFERENCES emprestimos_rpc_origens(contrato_id) ON DELETE RESTRICT"],["ciclo_operacoes_hash_payload_check","c",true,false,false,"CHECK ((hash_payload ~ ''^[0-9a-f]{64}$''::text))"],["ciclo_operacoes_parcela_id_fkey","f",true,false,false,"FOREIGN KEY (parcela_id) REFERENCES parcelas(id) ON DELETE RESTRICT"],["ciclo_operacoes_pkey","p",true,false,false,"PRIMARY KEY (id)"],["ciclo_operacoes_user_id_chave_idempotencia_key","u",true,false,false,"UNIQUE (user_id, chave_idempotencia)"],["ciclo_operacoes_user_id_fkey","f",true,false,false,"FOREIGN KEY (user_id) REFERENCES users(id)"],["ciclo_operacoes_user_id_id_key","u",true,false,false,"UNIQUE (user_id, id)"]],"indexes":[["ciclo_operacoes_pkey",true,true,true,"CREATE UNIQUE INDEX ciclo_operacoes_pkey ON public.ciclo_operacoes USING btree (id)"],["ciclo_operacoes_user_id_chave_idempotencia_key",true,true,true,"CREATE UNIQUE INDEX ciclo_operacoes_user_id_chave_idempotencia_key ON public.ciclo_operacoes USING btree (user_id, chave_idempotencia)"],["ciclo_operacoes_user_id_id_key",true,true,true,"CREATE UNIQUE INDEX ciclo_operacoes_user_id_id_key ON public.ciclo_operacoes USING btree (user_id, id)"]]},{"relname":"ciclo_pernas","relrowsecurity":true,"relforcerowsecurity":false,"relkind":"r","relpersistence":"p","relispartition":false,"columns":[[1,"operacao_id","uuid",true,"","",null,null],[2,"user_id","integer",true,"","",null,null],[3,"transacao_id","integer",true,"","",null,null],[4,"snapshot","jsonb",true,"","",null,null]],"constraints":[["ciclo_pernas_operacao_id_fkey","f",true,false,false,"FOREIGN KEY (operacao_id) REFERENCES ciclo_operacoes(id) ON DELETE RESTRICT"],["ciclo_pernas_pkey","p",true,false,false,"PRIMARY KEY (operacao_id)"],["ciclo_pernas_transacao_id_fkey","f",true,false,false,"FOREIGN KEY (transacao_id) REFERENCES transacoes_caixa(id) ON DELETE RESTRICT"],["ciclo_pernas_transacao_id_key","u",true,false,false,"UNIQUE (transacao_id)"],["ciclo_pernas_user_id_operacao_id_fkey","f",true,false,false,"FOREIGN KEY (user_id, operacao_id) REFERENCES ciclo_operacoes(user_id, id) ON DELETE RESTRICT"]],"indexes":[["ciclo_pernas_pkey",true,true,true,"CREATE UNIQUE INDEX ciclo_pernas_pkey ON public.ciclo_pernas USING btree (operacao_id)"],["ciclo_pernas_transacao_id_key",true,true,true,"CREATE UNIQUE INDEX ciclo_pernas_transacao_id_key ON public.ciclo_pernas USING btree (transacao_id)"]]},{"columns":[[1,"id","integer",true,"","",null,"nextval(''contas_caixa_id_seq''::regclass)"],[2,"nome","character varying(255)",true,"","","default",null],[3,"tipo","character varying(20)",true,"","","default","''caixa''::character varying"],[4,"saldo","numeric(15,2)",true,"","",null,"0"],[5,"ativo","boolean",true,"","",null,"true"],[6,"createdAt","timestamp with time zone",true,"","",null,"now()"],[7,"updatedAt","timestamp with time zone",true,"","",null,"now()"],[8,"user_id","integer",false,"","",null,null]],"indexes":[["contas_caixa_pkey",true,true,true,"CREATE UNIQUE INDEX contas_caixa_pkey ON public.contas_caixa USING btree (id)"],["idx_contas_caixa_user_id",false,true,true,"CREATE INDEX idx_contas_caixa_user_id ON public.contas_caixa USING btree (user_id)"]],"relkind":"r","relname":"contas_caixa","constraints":[["contas_caixa_pkey","p",true,false,false,"PRIMARY KEY (id)"],["contas_caixa_tipo_check","c",true,false,false,"CHECK (((tipo)::text = ANY (ARRAY[(''caixa''::character varying)::text, (''banco''::character varying)::text, (''digital''::character varying)::text])))"],["contas_caixa_user_id_fkey","f",true,false,false,"FOREIGN KEY (user_id) REFERENCES users(id)"]],"relispartition":false,"relpersistence":"p","relrowsecurity":true,"relforcerowsecurity":false},{"columns":[[1,"id","integer",true,"","",null,"nextval(''contas_pagar_id_seq''::regclass)"],[2,"descricao","character varying(255)",true,"","","default",null],[3,"categoria","character varying(50)",false,"","","default","''outros''::character varying"],[4,"valor","numeric(15,2)",true,"","",null,null],[5,"data_vencimento","date",true,"","",null,null],[6,"data_pagamento","date",false,"","",null,null],[7,"status","character varying(20)",false,"","","default","''pendente''::character varying"],[8,"recorrente","boolean",false,"","",null,"false"],[9,"frequencia","character varying(20)",false,"","","default",null],[10,"conta_caixa_id","integer",false,"","",null,null],[11,"observacoes","text",false,"","","default",null],[12,"createdAt","timestamp with time zone",true,"","",null,"now()"],[13,"updatedAt","timestamp with time zone",true,"","",null,"now()"],[14,"user_id","integer",false,"","",null,null]],"indexes":[["contas_pagar_pkey",true,true,true,"CREATE UNIQUE INDEX contas_pagar_pkey ON public.contas_pagar USING btree (id)"],["idx_contas_pagar_user_id",false,true,true,"CREATE INDEX idx_contas_pagar_user_id ON public.contas_pagar USING btree (user_id)"]],"relkind":"r","relname":"contas_pagar","constraints":[["contas_pagar_categoria_check","c",true,false,false,"CHECK (((categoria)::text = ANY (ARRAY[(''aluguel''::character varying)::text, (''energia''::character varying)::text, (''agua''::character varying)::text, (''internet''::character varying)::text, (''telefone''::character varying)::text, (''salario''::character varying)::text, (''imposto''::character varying)::text, (''fornecedor''::character varying)::text, (''outros''::character varying)::text])))"],["contas_pagar_conta_caixa_id_fkey","f",true,false,false,"FOREIGN KEY (conta_caixa_id) REFERENCES contas_caixa(id)"],["contas_pagar_frequencia_check","c",true,false,false,"CHECK (((frequencia)::text = ANY (ARRAY[(''mensal''::character varying)::text, (''semanal''::character varying)::text, (''quinzenal''::character varying)::text, (''anual''::character varying)::text])))"],["contas_pagar_pkey","p",true,false,false,"PRIMARY KEY (id)"],["contas_pagar_status_check","c",true,false,false,"CHECK (((status)::text = ANY (ARRAY[(''pendente''::character varying)::text, (''pago''::character varying)::text, (''atrasado''::character varying)::text, (''cancelado''::character varying)::text])))"],["contas_pagar_user_id_fkey","f",true,false,false,"FOREIGN KEY (user_id) REFERENCES users(id)"]],"relispartition":false,"relpersistence":"p","relrowsecurity":true,"relforcerowsecurity":false},{"relname":"despesas_rpc_operacoes","relrowsecurity":true,"relforcerowsecurity":false,"relkind":"r","relpersistence":"p","relispartition":false,"columns":[[1,"id","uuid",true,"","",null,null],[2,"user_id","integer",true,"","",null,null],[3,"chave_idempotencia","uuid",true,"","",null,null],[4,"tipo","text",true,"","","default",null],[5,"payload","jsonb",true,"","",null,null],[6,"hash_payload","bytea",true,"","",null,null],[7,"resultado","jsonb",true,"","",null,null],[8,"auditoria","jsonb",true,"","",null,null],[9,"criado_em","timestamp with time zone",true,"","",null,"now()"]],"constraints":[["despesas_rpc_operacoes_auditoria_check","c",true,false,false,"CHECK (((jsonb_typeof(auditoria) = ''object''::text) AND (auditoria ? ''depois''::text)))"],["despesas_rpc_operacoes_hash_payload_check","c",true,false,false,"CHECK ((octet_length(hash_payload) = 32))"],["despesas_rpc_operacoes_payload_check","c",true,false,false,"CHECK ((jsonb_typeof(payload) = ''object''::text))"],["despesas_rpc_operacoes_pkey","p",true,false,false,"PRIMARY KEY (id)"],["despesas_rpc_operacoes_resultado_check","c",true,false,false,"CHECK (((jsonb_typeof(resultado) = ''object''::text) AND ((resultado ->> ''success''::text) = ''true''::text)))"],["despesas_rpc_operacoes_tipo_check","c",true,false,false,"CHECK ((tipo = ANY (ARRAY[''criar''::text, ''pagar''::text, ''estornar''::text])))"],["despesas_rpc_operacoes_user_chave_uk","u",true,false,false,"UNIQUE (user_id, chave_idempotencia)"],["despesas_rpc_operacoes_user_id_fkey","f",true,false,false,"FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT"]],"indexes":[["despesas_rpc_operacoes_pkey",true,true,true,"CREATE UNIQUE INDEX despesas_rpc_operacoes_pkey ON public.despesas_rpc_operacoes USING btree (id)"],["despesas_rpc_operacoes_user_chave_uk",true,true,true,"CREATE UNIQUE INDEX despesas_rpc_operacoes_user_chave_uk ON public.despesas_rpc_operacoes USING btree (user_id, chave_idempotencia)"]]},{"relname":"despesas_rpc_origens","relrowsecurity":true,"relforcerowsecurity":false,"relkind":"r","relpersistence":"p","relispartition":false,"columns":[[1,"despesa_id","integer",true,"","",null,null],[2,"user_id","integer",true,"","",null,null],[3,"operacao_id","uuid",true,"","",null,null],[4,"snapshot","jsonb",true,"","",null,null],[5,"criado_em","timestamp with time zone",true,"","",null,"now()"]],"constraints":[["despesas_rpc_origens_despesa_id_fkey","f",true,false,false,"FOREIGN KEY (despesa_id) REFERENCES contas_pagar(id) ON DELETE RESTRICT"],["despesas_rpc_origens_operacao_id_fkey","f",true,true,true,"FOREIGN KEY (operacao_id) REFERENCES despesas_rpc_operacoes(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED"],["despesas_rpc_origens_operacao_id_key","u",true,false,false,"UNIQUE (operacao_id)"],["despesas_rpc_origens_pkey","p",true,false,false,"PRIMARY KEY (despesa_id)"],["despesas_rpc_origens_snapshot_check","c",true,false,false,"CHECK ((jsonb_typeof(snapshot) = ''object''::text))"],["despesas_rpc_origens_user_id_fkey","f",true,false,false,"FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT"]],"indexes":[["despesas_rpc_origens_operacao_id_key",true,true,true,"CREATE UNIQUE INDEX despesas_rpc_origens_operacao_id_key ON public.despesas_rpc_origens USING btree (operacao_id)"],["despesas_rpc_origens_pkey",true,true,true,"CREATE UNIQUE INDEX despesas_rpc_origens_pkey ON public.despesas_rpc_origens USING btree (despesa_id)"]]},{"relname":"despesas_rpc_pagamentos","relrowsecurity":true,"relforcerowsecurity":false,"relkind":"r","relpersistence":"p","relispartition":false,"columns":[[1,"despesa_id","integer",true,"","",null,null],[2,"user_id","integer",true,"","",null,null],[3,"operacao_id","uuid",true,"","",null,null],[4,"conta_caixa_id","integer",true,"","",null,null],[5,"valor","numeric(15,2)",true,"","",null,null],[6,"data_pagamento","date",true,"","",null,null],[7,"saida_id","integer",true,"","",null,null],[8,"saida_snapshot","jsonb",true,"","",null,null],[9,"despesa_snapshot","jsonb",true,"","",null,null],[10,"operacao_estorno_id","uuid",false,"","",null,null],[11,"estorno_id","integer",false,"","",null,null],[12,"estorno_snapshot","jsonb",false,"","",null,null]],"constraints":[["despesas_rpc_pagamentos_conta_caixa_id_fkey","f",true,false,false,"FOREIGN KEY (conta_caixa_id) REFERENCES contas_caixa(id) ON DELETE RESTRICT"],["despesas_rpc_pagamentos_despesa_id_fkey","f",true,false,false,"FOREIGN KEY (despesa_id) REFERENCES despesas_rpc_origens(despesa_id) ON DELETE RESTRICT"],["despesas_rpc_pagamentos_despesa_snapshot_check","c",true,false,false,"CHECK ((jsonb_typeof(despesa_snapshot) = ''object''::text))"],["despesas_rpc_pagamentos_estorno_check","c",true,false,false,"CHECK ((((operacao_estorno_id IS NULL) AND (estorno_id IS NULL) AND (estorno_snapshot IS NULL)) OR ((operacao_estorno_id IS NOT NULL) AND (estorno_id IS NOT NULL) AND (estorno_snapshot IS NOT NULL) AND (jsonb_typeof(estorno_snapshot) = ''object''::text) AND (estorno_id <> saida_id))))"],["despesas_rpc_pagamentos_estorno_id_fkey","f",true,false,false,"FOREIGN KEY (estorno_id) REFERENCES transacoes_caixa(id) ON DELETE RESTRICT"],["despesas_rpc_pagamentos_estorno_id_key","u",true,false,false,"UNIQUE (estorno_id)"],["despesas_rpc_pagamentos_operacao_estorno_id_fkey","f",true,true,true,"FOREIGN KEY (operacao_estorno_id) REFERENCES despesas_rpc_operacoes(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED"],["despesas_rpc_pagamentos_operacao_estorno_id_key","u",true,false,false,"UNIQUE (operacao_estorno_id)"],["despesas_rpc_pagamentos_operacao_id_fkey","f",true,true,true,"FOREIGN KEY (operacao_id) REFERENCES despesas_rpc_operacoes(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED"],["despesas_rpc_pagamentos_operacao_id_key","u",true,false,false,"UNIQUE (operacao_id)"],["despesas_rpc_pagamentos_pkey","p",true,false,false,"PRIMARY KEY (despesa_id)"],["despesas_rpc_pagamentos_saida_id_fkey","f",true,false,false,"FOREIGN KEY (saida_id) REFERENCES transacoes_caixa(id) ON DELETE RESTRICT"],["despesas_rpc_pagamentos_saida_id_key","u",true,false,false,"UNIQUE (saida_id)"],["despesas_rpc_pagamentos_saida_snapshot_check","c",true,false,false,"CHECK ((jsonb_typeof(saida_snapshot) = ''object''::text))"],["despesas_rpc_pagamentos_user_id_fkey","f",true,false,false,"FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT"],["despesas_rpc_pagamentos_valor_check","c",true,false,false,"CHECK (((valor > (0)::numeric) AND (valor <= 9999999999999.99)))"]],"indexes":[["despesas_rpc_pagamentos_estorno_id_key",true,true,true,"CREATE UNIQUE INDEX despesas_rpc_pagamentos_estorno_id_key ON public.despesas_rpc_pagamentos USING btree (estorno_id)"],["despesas_rpc_pagamentos_operacao_estorno_id_key",true,true,true,"CREATE UNIQUE INDEX despesas_rpc_pagamentos_operacao_estorno_id_key ON public.despesas_rpc_pagamentos USING btree (operacao_estorno_id)"],["despesas_rpc_pagamentos_operacao_id_key",true,true,true,"CREATE UNIQUE INDEX despesas_rpc_pagamentos_operacao_id_key ON public.despesas_rpc_pagamentos USING btree (operacao_id)"],["despesas_rpc_pagamentos_pkey",true,true,true,"CREATE UNIQUE INDEX despesas_rpc_pagamentos_pkey ON public.despesas_rpc_pagamentos USING btree (despesa_id)"],["despesas_rpc_pagamentos_saida_id_key",true,true,true,"CREATE UNIQUE INDEX despesas_rpc_pagamentos_saida_id_key ON public.despesas_rpc_pagamentos USING btree (saida_id)"]]},{"relname":"emprestimos_rpc_operacoes","relrowsecurity":true,"relforcerowsecurity":false,"relkind":"r","relpersistence":"p","relispartition":false,"columns":[[1,"id","uuid",true,"","",null,"gen_random_uuid()"],[2,"user_id","integer",true,"","",null,null],[3,"chave_idempotencia","uuid",true,"","",null,null],[4,"hash_payload","text",true,"","","default",null],[5,"payload","jsonb",true,"","",null,null],[6,"resultado","jsonb",false,"","",null,null],[7,"auditoria","jsonb",false,"","",null,null],[8,"created_at","timestamp with time zone",true,"","",null,"now()"],[9,"concluida_em","timestamp with time zone",false,"","",null,null]],"constraints":[["emprestimos_rpc_operacoes_check","c",true,false,false,"CHECK ((((resultado IS NULL) AND (concluida_em IS NULL) AND (auditoria IS NULL)) OR ((resultado IS NOT NULL) AND (concluida_em IS NOT NULL) AND (auditoria IS NOT NULL))))"],["emprestimos_rpc_operacoes_hash_payload_check","c",true,false,false,"CHECK ((hash_payload ~ ''^[0-9a-f]{64}$''::text))"],["emprestimos_rpc_operacoes_pkey","p",true,false,false,"PRIMARY KEY (id)"],["emprestimos_rpc_operacoes_user_id_chave_idempotencia_key","u",true,false,false,"UNIQUE (user_id, chave_idempotencia)"],["emprestimos_rpc_operacoes_user_id_fkey","f",true,false,false,"FOREIGN KEY (user_id) REFERENCES users(id)"],["emprestimos_rpc_operacoes_user_id_id_key","u",true,false,false,"UNIQUE (user_id, id)"]],"indexes":[["emprestimos_rpc_operacoes_pkey",true,true,true,"CREATE UNIQUE INDEX emprestimos_rpc_operacoes_pkey ON public.emprestimos_rpc_operacoes USING btree (id)"],["emprestimos_rpc_operacoes_user_id_chave_idempotencia_key",true,true,true,"CREATE UNIQUE INDEX emprestimos_rpc_operacoes_user_id_chave_idempotencia_key ON public.emprestimos_rpc_operacoes USING btree (user_id, chave_idempotencia)"],["emprestimos_rpc_operacoes_user_id_id_key",true,true,true,"CREATE UNIQUE INDEX emprestimos_rpc_operacoes_user_id_id_key ON public.emprestimos_rpc_operacoes USING btree (user_id, id)"]]},{"relname":"emprestimos_rpc_origens","relrowsecurity":true,"relforcerowsecurity":false,"relkind":"r","relpersistence":"p","relispartition":false,"columns":[[1,"contrato_id","integer",true,"","",null,null],[2,"user_id","integer",true,"","",null,null],[3,"operacao_id","uuid",true,"","",null,null],[4,"transacao_caixa_id","integer",true,"","",null,null],[5,"regra","text",true,"","","default",null],[6,"created_at","timestamp with time zone",true,"","",null,"now()"]],"constraints":[["emprestimos_rpc_origens_contrato_id_fkey","f",true,false,false,"FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE RESTRICT"],["emprestimos_rpc_origens_operacao_id_key","u",true,false,false,"UNIQUE (operacao_id)"],["emprestimos_rpc_origens_pkey","p",true,false,false,"PRIMARY KEY (contrato_id)"],["emprestimos_rpc_origens_regra_check","c",true,false,false,"CHECK ((regra = ''mensal_simples_v1''::text))"],["emprestimos_rpc_origens_transacao_caixa_id_fkey","f",true,false,false,"FOREIGN KEY (transacao_caixa_id) REFERENCES transacoes_caixa(id) ON DELETE RESTRICT"],["emprestimos_rpc_origens_transacao_caixa_id_key","u",true,false,false,"UNIQUE (transacao_caixa_id)"],["emprestimos_rpc_origens_user_id_fkey","f",true,false,false,"FOREIGN KEY (user_id) REFERENCES users(id)"],["emprestimos_rpc_origens_user_id_operacao_id_fkey","f",true,false,false,"FOREIGN KEY (user_id, operacao_id) REFERENCES emprestimos_rpc_operacoes(user_id, id)"]],"indexes":[["emprestimos_rpc_origens_operacao_id_key",true,true,true,"CREATE UNIQUE INDEX emprestimos_rpc_origens_operacao_id_key ON public.emprestimos_rpc_origens USING btree (operacao_id)"],["emprestimos_rpc_origens_pkey",true,true,true,"CREATE UNIQUE INDEX emprestimos_rpc_origens_pkey ON public.emprestimos_rpc_origens USING btree (contrato_id)"],["emprestimos_rpc_origens_transacao_caixa_id_key",true,true,true,"CREATE UNIQUE INDEX emprestimos_rpc_origens_transacao_caixa_id_key ON public.emprestimos_rpc_origens USING btree (transacao_caixa_id)"]]},{"columns":[[1,"id","integer",true,"","",null,"nextval(''transacoes_caixa_id_seq''::regclass)"],[2,"conta_caixa_id","integer",true,"","",null,null],[3,"tipo","character varying(10)",true,"","","default",null],[4,"categoria","character varying(50)",false,"","","default",null],[5,"descricao","text",true,"","","default",null],[6,"valor","numeric(15,2)",true,"","",null,null],[7,"data_transacao","date",true,"","",null,null],[8,"contrato_id","integer",false,"","",null,null],[9,"parcela_id","integer",false,"","",null,null],[10,"createdAt","timestamp with time zone",true,"","",null,"now()"],[11,"user_id","integer",false,"","",null,null]],"indexes":[["idx_transacoes_caixa_user_id",false,true,true,"CREATE INDEX idx_transacoes_caixa_user_id ON public.transacoes_caixa USING btree (user_id)"],["transacoes_caixa_pkey",true,true,true,"CREATE UNIQUE INDEX transacoes_caixa_pkey ON public.transacoes_caixa USING btree (id)"]],"relkind":"r","relname":"transacoes_caixa","constraints":[["transacoes_caixa_conta_caixa_id_fkey","f",true,false,false,"FOREIGN KEY (conta_caixa_id) REFERENCES contas_caixa(id)"],["transacoes_caixa_contrato_id_fkey","f",true,false,false,"FOREIGN KEY (contrato_id) REFERENCES contratos(id)"],["transacoes_caixa_parcela_id_fkey","f",true,false,false,"FOREIGN KEY (parcela_id) REFERENCES parcelas(id)"],["transacoes_caixa_pkey","p",true,false,false,"PRIMARY KEY (id)"],["transacoes_caixa_tipo_check","c",true,false,false,"CHECK (((tipo)::text = ANY (ARRAY[(''entrada''::character varying)::text, (''saida''::character varying)::text])))"],["transacoes_caixa_user_id_fkey","f",true,false,false,"FOREIGN KEY (user_id) REFERENCES users(id)"]],"relispartition":false,"relpersistence":"p","relrowsecurity":true,"relforcerowsecurity":false}]'::jsonb;
 -- Só cinco CHECKs comprovados PG17.6/17.11: whitelist de strings completas.
 -- Não altera baseline, tipos, valores, ordem, coluna, operador, casts desconhecidos ou FKs.
 constraint_casts := '{"contas_caixa":{"contas_caixa_tipo_check":{"CHECK (((tipo)::text = ANY ((ARRAY[''caixa''::character varying, ''banco''::character varying, ''digital''::character varying])::text[])))":"CHECK (((tipo)::text = ANY (ARRAY[(''caixa''::character varying)::text, (''banco''::character varying)::text, (''digital''::character varying)::text])))"}},"contas_pagar":{"contas_pagar_categoria_check":{"CHECK (((categoria)::text = ANY ((ARRAY[''aluguel''::character varying, ''energia''::character varying, ''agua''::character varying, ''internet''::character varying, ''telefone''::character varying, ''salario''::character varying, ''imposto''::character varying, ''fornecedor''::character varying, ''outros''::character varying])::text[])))":"CHECK (((categoria)::text = ANY (ARRAY[(''aluguel''::character varying)::text, (''energia''::character varying)::text, (''agua''::character varying)::text, (''internet''::character varying)::text, (''telefone''::character varying)::text, (''salario''::character varying)::text, (''imposto''::character varying)::text, (''fornecedor''::character varying)::text, (''outros''::character varying)::text])))"},"contas_pagar_frequencia_check":{"CHECK (((frequencia)::text = ANY ((ARRAY[''mensal''::character varying, ''semanal''::character varying, ''quinzenal''::character varying, ''anual''::character varying])::text[])))":"CHECK (((frequencia)::text = ANY (ARRAY[(''mensal''::character varying)::text, (''semanal''::character varying)::text, (''quinzenal''::character varying)::text, (''anual''::character varying)::text])))"},"contas_pagar_status_check":{"CHECK (((status)::text = ANY ((ARRAY[''pendente''::character varying, ''pago''::character varying, ''atrasado''::character varying, ''cancelado''::character varying])::text[])))":"CHECK (((status)::text = ANY (ARRAY[(''pendente''::character varying)::text, (''pago''::character varying)::text, (''atrasado''::character varying)::text, (''cancelado''::character varying)::text])))"}},"transacoes_caixa":{"transacoes_caixa_tipo_check":{"CHECK (((tipo)::text = ANY ((ARRAY[''entrada''::character varying, ''saida''::character varying])::text[])))":"CHECK (((tipo)::text = ANY (ARRAY[(''entrada''::character varying)::text, (''saida''::character varying)::text])))"}}}'::jsonb;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relname IN(SELECT x->>'relname' FROM jsonb_array_elements(expected) x) AND(c.relnamespace<>'public'::regnamespace OR c.relowner<>owner_oid)) THEN RAISE EXCEPTION '0025: schema/owner de tabela incompatível'; END IF;
 SELECT jsonb_agg(jsonb_build_object('relname',c.relname,'relrowsecurity',c.relrowsecurity,'relforcerowsecurity',c.relforcerowsecurity,'relkind',c.relkind,'relpersistence',c.relpersistence,'relispartition',c.relispartition,
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,co.collname,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum LEFT JOIN pg_catalog.pg_collation co ON co.oid=a.attcollation WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(conname,contype,convalidated,condeferrable,condeferred,CASE WHEN c.relname IN('contas_caixa','contas_pagar','transacoes_caixa') AND contype='c' THEN coalesce(constraint_casts->c.relname->conname->>pg_get_constraintdef(oid,false),pg_get_constraintdef(oid,false)) ELSE pg_get_constraintdef(oid,false) END) ORDER BY conname) FROM pg_catalog.pg_constraint WHERE conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(x.relname,i.indisunique,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid)) ORDER BY x.relname) FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=c.oid)) ORDER BY c.relname)
 INTO actual FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname IN(SELECT x->>'relname' FROM jsonb_array_elements(expected) x);
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0025: tabelas/defaults/CHECK/FK/índices incompatíveis'; END IF;
 FOR r IN SELECT c.* FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname IN(SELECT x->>'relname' FROM jsonb_array_elements(expected) x) AND c.relname NOT IN('contas_caixa','contas_pagar','transacoes_caixa') LOOP
   IF EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(r.relacl,pg_catalog.acldefault('r',r.relowner))) g WHERE g.grantee<>owner_oid AND NOT(r.relname LIKE 'despesas_rpc_%' AND g.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role') AND g.privilege_type='SELECT' AND NOT g.is_grantable))
    OR (r.relname LIKE 'despesas_rpc_%' AND NOT has_table_privilege('service_role',r.oid,'SELECT'))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a,LATERAL pg_catalog.aclexplode(a.attacl) g WHERE a.attrelid=r.oid AND g.grantee<>owner_oid)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=r.oid) THEN RAISE EXCEPTION '0025: grants de tabela/coluna/policy incompatíveis: %',r.relname; END IF;
 END LOOP;
 -- Guardas habilitadas e exatas; qualquer trigger extra no caminho é NO-GO.
 expected := '[{"relname":"ciclo_pernas","tgname":"ciclo_perna_imutavel","def":"CREATE TRIGGER ciclo_perna_imutavel BEFORE DELETE OR UPDATE ON public.ciclo_pernas FOR EACH ROW EXECUTE FUNCTION ciclo_imutavel()","tgenabled":"O","tgtype":27,"tgconstraint":0,"function":"ciclo_imutavel()"},{"relname":"contas_caixa","tgname":"ciclo_conta","def":"CREATE TRIGGER ciclo_conta BEFORE DELETE OR UPDATE ON public.contas_caixa FOR EACH ROW EXECUTE FUNCTION ciclo_guardar()","tgenabled":"O","tgtype":27,"tgconstraint":0,"function":"ciclo_guardar()"},{"relname":"contrato_historico","tgname":"ciclo_historico","def":"CREATE TRIGGER ciclo_historico BEFORE INSERT OR DELETE OR UPDATE ON public.contrato_historico FOR EACH ROW EXECUTE FUNCTION ciclo_guardar()","tgenabled":"O","tgtype":31,"tgconstraint":0,"function":"ciclo_guardar()"},{"relname":"contratos","tgname":"ciclo_contrato","def":"CREATE TRIGGER ciclo_contrato BEFORE DELETE OR UPDATE ON public.contratos FOR EACH ROW EXECUTE FUNCTION ciclo_guardar()","tgenabled":"O","tgtype":27,"tgconstraint":0,"function":"ciclo_guardar()"},{"relname":"emprestimos_rpc_operacoes","tgname":"ciclo_criacao_snapshot","def":"CREATE TRIGGER ciclo_criacao_snapshot AFTER UPDATE ON public.emprestimos_rpc_operacoes FOR EACH ROW EXECUTE FUNCTION ciclo_finalizar_criacao()","tgenabled":"O","tgtype":17,"tgconstraint":0,"function":"ciclo_finalizar_criacao()"},{"relname":"emprestimos_rpc_origens","tgname":"ciclo_origem_imutavel","def":"CREATE TRIGGER ciclo_origem_imutavel BEFORE DELETE OR UPDATE ON public.emprestimos_rpc_origens FOR EACH ROW EXECUTE FUNCTION ciclo_imutavel()","tgenabled":"O","tgtype":27,"tgconstraint":0,"function":"ciclo_imutavel()"},{"relname":"parcelas","tgname":"ciclo_parcela","def":"CREATE TRIGGER ciclo_parcela BEFORE INSERT OR DELETE OR UPDATE ON public.parcelas FOR EACH ROW EXECUTE FUNCTION ciclo_guardar()","tgenabled":"O","tgtype":31,"tgconstraint":0,"function":"ciclo_guardar()"},{"relname":"transacoes_caixa","tgname":"ciclo_ledger","def":"CREATE TRIGGER ciclo_ledger BEFORE INSERT OR DELETE OR UPDATE ON public.transacoes_caixa FOR EACH ROW EXECUTE FUNCTION ciclo_guardar()","tgenabled":"O","tgtype":31,"tgconstraint":0,"function":"ciclo_guardar()"}]'::jsonb;
 SELECT jsonb_agg(jsonb_build_object('relname',c.relname,'tgname',t.tgname,'def',pg_get_triggerdef(t.oid,false),'tgenabled',t.tgenabled,'tgtype',t.tgtype,'tgconstraint',t.tgconstraint::bigint,'function',t.tgfoid::regprocedure::text) ORDER BY c.relname,t.tgname)
 INTO actual FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal
 AND c.relname IN('contas_caixa','contas_pagar','transacoes_caixa','contratos','parcelas','contrato_historico','despesas_rpc_origens','despesas_rpc_pagamentos','despesas_rpc_operacoes','emprestimos_rpc_origens','emprestimos_rpc_operacoes','ciclo_autorizacoes','ciclo_estados','ciclo_operacoes','ciclo_pernas');
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0025: trigger incompatível/desabilitado/extra'; END IF;
 -- Nada de capabilities antigas em aberto: tabela 0022 não é um canal manual.
 IF EXISTS(SELECT 1 FROM public.ciclo_autorizacoes) THEN RAISE EXCEPTION '0025: capability residual 0022'; END IF;
END;
$preflight$;

-- Capacidade transacional privada, restrita a uma única linha exata de despesa.
-- Não altera a capability original 0022 nem permite UPDATE/DELETE ou vínculo loan.
CREATE TABLE public.ciclo_despesas_autorizacoes (
 xid bigint NOT NULL, pid integer NOT NULL,
 acao text NOT NULL CHECK(acao IN('pagar','estornar')),
 conta_id integer NOT NULL REFERENCES public.contas_caixa(id) ON DELETE RESTRICT,
 user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 despesa_id integer NOT NULL REFERENCES public.despesas_rpc_origens(despesa_id) ON DELETE RESTRICT,
 operacao_id uuid NOT NULL,
 esperado jsonb NOT NULL CHECK(jsonb_typeof(esperado)='object'
   AND esperado->>'categoria'='despesa_operacional'
   AND esperado->'contrato_id'='null'::jsonb AND esperado->'parcela_id'='null'::jsonb
   AND ((acao='pagar' AND esperado->>'tipo'='saida') OR(acao='estornar' AND esperado->>'tipo'='entrada'))),
 PRIMARY KEY(xid,pid),
 FOREIGN KEY(operacao_id) REFERENCES public.despesas_rpc_operacoes(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.ciclo_despesas_autorizacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ciclo_despesas_autorizacoes FROM PUBLIC,anon,authenticated,service_role;

-- Overload novo, privado; somente despesas_rpc_executar owner trusted emite.
-- Nenhum proxy genérico executável por service_role. Permissão é ACL, não superuser.
CREATE FUNCTION public.ciclo_autorizar(p_acao text,p_conta integer,p_user integer,p_despesa integer,
 p_operacao uuid,p_valor numeric,p_data date,p_descricao text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $capability$
BEGIN
 IF p_acao IS NULL OR p_acao NOT IN('pagar','estornar') OR p_operacao IS NULL
   OR p_valor IS NULL OR p_valor<=0 OR p_valor::text IN('NaN','Infinity','-Infinity')
   OR scale(p_valor)>2 OR p_data IS NULL OR NOT isfinite(p_data)
   OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=p_conta AND user_id=p_user AND ativo=true)
   OR NOT EXISTS(SELECT 1 FROM public.despesas_rpc_origens o JOIN public.contas_pagar d ON d.id=o.despesa_id WHERE o.despesa_id=p_despesa AND o.user_id=p_user AND d.user_id=p_user AND d.valor=p_valor AND p_descricao=(CASE WHEN p_acao='pagar' THEN 'Pagamento: ' ELSE 'Estorno: ' END)||d.descricao)
 THEN RAISE EXCEPTION '0025: intenção de capability inválida' USING ERRCODE='42501'; END IF;
 INSERT INTO public.ciclo_despesas_autorizacoes(xid,pid,acao,conta_id,user_id,despesa_id,operacao_id,esperado)
 VALUES(txid_current(),pg_backend_pid(),p_acao,p_conta,p_user,p_despesa,p_operacao,
   jsonb_build_object('conta_caixa_id',p_conta,'user_id',p_user,'tipo',CASE WHEN p_acao='pagar' THEN 'saida' ELSE 'entrada' END,
   'categoria','despesa_operacional','descricao',p_descricao,'valor',p_valor::numeric(15,2),'data_transacao',p_data,
   'contrato_id',NULL,'parcela_id',NULL,'createdAt',now()));
 -- Sem ON CONFLICT: nunca substituir capability pendente nem tolerar nesting.
END;
$capability$;
REVOKE ALL ON FUNCTION public.ciclo_autorizar(text,integer,integer,integer,uuid,numeric,date,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.ciclo_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE oldj jsonb; newj jsonb; cid integer; aid integer; protegido boolean; autorizado boolean; despesa_autorizada boolean;
BEGIN
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

-- Corpo 0020 byte-a-byte preservado, exceto lock global e DUAS emissões abaixo.
CREATE OR REPLACE FUNCTION public.despesas_rpc_executar(
  p_user_id integer, p_chave_idempotencia uuid, p_tipo text, p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET TimeZone = 'UTC'
AS $rpc$
DECLARE
  v_op public.despesas_rpc_operacoes%ROWTYPE;
  v_origem public.despesas_rpc_origens%ROWTYPE;
  v_pg public.despesas_rpc_pagamentos%ROWTYPE;
  v_d public.contas_pagar%ROWTYPE;
  v_conta public.contas_caixa%ROWTYPE;
  v_tx public.transacoes_caixa%ROWTYPE;
  v_hash bytea; v_id uuid := pg_catalog.gen_random_uuid(); v_result jsonb;
  v_antes jsonb; v_depois jsonb; v_saida jsonb; v_estorno jsonb;
  v_valor numeric; v_conta_id integer; v_data date; v_vencimento date;
  v_descricao text; v_categoria text; v_obs text; v_motivo text; v_pagamento_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_user_id<=0 OR p_chave_idempotencia IS NULL
     OR p_tipo IS NULL OR p_tipo NOT IN ('criar','pagar','estornar')
     OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Intenção inválida';
  END IF;
  -- A API interna não é executável por service_role: só wrappers tipados montam o payload.
  IF p_tipo='criar' THEN
    v_valor := (p_payload->>'valor')::numeric;
    v_descricao := btrim(p_payload->>'descricao'); v_categoria := p_payload->>'categoria';
    v_obs := p_payload->>'observacoes'; v_vencimento := (p_payload->>'dataVencimento')::date;
    IF v_valor IS NULL OR v_valor::text IN ('NaN','Infinity','-Infinity') OR v_valor<=0
       OR v_valor>9999999999999.99 OR scale(v_valor)>2
       OR v_descricao IS NULL OR length(v_descricao) NOT BETWEEN 1 AND 255
       OR v_categoria IS NULL OR v_categoria NOT IN ('aluguel','energia','agua','internet','telefone','salario','imposto','fornecedor','outros')
       OR v_vencimento IS NULL OR NOT isfinite(v_vencimento)
       OR v_vencimento NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
       OR length(coalesce(v_obs,''))>10000 THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Despesa inválida: valor positivo, escala 2, limite e data civil obrigatórios';
    END IF;
    p_payload := jsonb_set(jsonb_set(p_payload,'{valor}',to_jsonb(v_valor::numeric(15,2))),'{descricao}',to_jsonb(v_descricao));
  ELSE
    IF (p_payload->>'despesaId')::integer IS NULL OR (p_payload->>'despesaId')::integer<=0 THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Despesa inválida';
    END IF;
    v_data := (p_payload->>'data')::date;
    IF v_data IS NULL OR NOT isfinite(v_data) OR v_data NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Data civil obrigatória';
    END IF;
    IF p_tipo='pagar' THEN
      v_conta_id := (p_payload->>'contaCaixaId')::integer;
      IF v_conta_id IS NULL OR v_conta_id<=0 THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Conta inválida'; END IF;
    ELSE
      v_pagamento_id := (p_payload->>'pagamentoOperationId')::uuid; v_motivo := btrim(p_payload->>'motivo');
      IF v_pagamento_id IS NULL OR v_motivo IS NULL OR length(v_motivo) NOT BETWEEN 1 AND 2000 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Pagamento original e motivo obrigatórios';
      END IF;
      p_payload := jsonb_set(p_payload,'{motivo}',to_jsonb(v_motivo));
    END IF;
  END IF;
  v_hash := extensions.digest(convert_to(jsonb_build_object('tipo',p_tipo,'userId',p_user_id,'payload',p_payload)::text,'UTF8'),'sha256');
  -- Mesma ordem em todas as intenções: chave -> usuário -> despesa -> origem/pagamento
  -- -> conta -> livro ordenado. Uma chave cobre TODOS os tipos de intenção do owner.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||':'||p_chave_idempotencia::text,20));
  PERFORM id FROM public.users WHERE id=p_user_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Usuário inválido'; END IF;
  SELECT * INTO v_op FROM public.despesas_rpc_operacoes WHERE user_id=p_user_id AND chave_idempotencia=p_chave_idempotencia;
  IF FOUND THEN
    IF v_op.tipo<>p_tipo OR v_op.hash_payload<>v_hash OR v_op.payload<>p_payload THEN
      RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='Chave reutilizada com payload diferente';
    END IF;
    RETURN v_op.resultado; -- confirmação persistida exata, inclusive após resposta perdida
  END IF;
  IF p_tipo='criar' THEN
    INSERT INTO public.contas_pagar(descricao,categoria,valor,data_vencimento,status,recorrente,frequencia,
      conta_caixa_id,data_pagamento,observacoes,user_id,"createdAt","updatedAt")
      VALUES(v_descricao,v_categoria,v_valor,v_vencimento,'pendente',false,NULL,NULL,NULL,v_obs,p_user_id,now(),now()) RETURNING * INTO v_d;
    v_depois := to_jsonb(v_d);
    INSERT INTO public.despesas_rpc_origens(despesa_id,user_id,operacao_id,snapshot) VALUES(v_d.id,p_user_id,v_id,v_depois);
  ELSE
    SELECT * INTO v_d FROM public.contas_pagar WHERE id=(p_payload->>'despesaId')::integer AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Despesa não encontrada'; END IF;
    v_antes := to_jsonb(v_d);
    SELECT * INTO v_origem FROM public.despesas_rpc_origens WHERE despesa_id=v_d.id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Despesa legada ou sem proveniência'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.despesas_rpc_operacoes o WHERE o.id=v_origem.operacao_id
      AND o.user_id=p_user_id AND o.tipo='criar' AND o.auditoria->'depois'=v_origem.snapshot
      AND (o.resultado->>'despesaId')::integer=v_d.id
      AND o.hash_payload=extensions.digest(convert_to(jsonb_build_object('tipo',o.tipo,'userId',o.user_id,'payload',o.payload)::text,'UTF8'),'sha256')) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Proveniência adulterada';
    END IF;
    SELECT * INTO v_pg FROM public.despesas_rpc_pagamentos WHERE despesa_id=v_d.id FOR UPDATE;
    IF p_tipo='pagar' THEN
      IF FOUND OR v_d.status IS DISTINCT FROM 'pendente' OR v_antes IS DISTINCT FROM v_origem.snapshot THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Estado ou valor original da despesa alterado';
      END IF;
    ELSE
      IF NOT FOUND OR v_pg.user_id<>p_user_id OR v_pg.operacao_id<>v_pagamento_id
        OR v_pg.estorno_id IS NOT NULL OR v_d.status IS DISTINCT FROM 'pago'
        OR v_antes IS DISTINCT FROM v_pg.despesa_snapshot
        OR v_d.valor IS DISTINCT FROM (v_origem.snapshot->>'valor')::numeric
        OR v_pg.valor IS DISTINCT FROM v_d.valor OR v_pg.conta_caixa_id IS DISTINCT FROM v_d.conta_caixa_id
        OR v_pg.data_pagamento IS DISTINCT FROM v_d.data_pagamento OR v_data<v_pg.data_pagamento THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Pagamento não elegível para estorno';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.despesas_rpc_operacoes o WHERE o.id=v_pg.operacao_id
        AND o.user_id=p_user_id AND o.tipo='pagar' AND o.auditoria->'depois'=v_pg.despesa_snapshot
        AND o.auditoria->'saida'=v_pg.saida_snapshot AND o.auditoria->'antes'=v_origem.snapshot
        AND (o.resultado->>'transacaoSaidaId')::integer=v_pg.saida_id
        AND o.hash_payload=extensions.digest(convert_to(jsonb_build_object('tipo',o.tipo,'userId',o.user_id,'payload',o.payload)::text,'UTF8'),'sha256')) THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Pagamento sem auditoria verificável';
      END IF;
      v_conta_id := v_pg.conta_caixa_id;
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(22022,v_conta_id); -- 0025: antes do lock de linha da conta
    SELECT * INTO v_conta FROM public.contas_caixa WHERE id=v_conta_id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND OR v_conta.ativo IS DISTINCT FROM true OR v_conta.saldo::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Conta indisponível para o owner';
    END IF;
    PERFORM t.id FROM public.transacoes_caixa t WHERE t.conta_caixa_id=v_conta_id ORDER BY t.id FOR SHARE;
    IF EXISTS (SELECT 1 FROM public.transacoes_caixa WHERE conta_caixa_id=v_conta_id
      AND (user_id IS DISTINCT FROM p_user_id OR valor::text IN ('NaN','Infinity','-Infinity') OR valor<=0
           OR tipo NOT IN ('entrada','saida') OR NOT isfinite(data_transacao))) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Livro da conta possui owner/valores inconsistentes';
    END IF;
    v_valor := v_d.valor;
    IF p_tipo='pagar' THEN
      PERFORM public.ciclo_autorizar('pagar',v_conta_id,p_user_id,v_d.id,v_id,v_valor,v_data,'Pagamento: '||v_d.descricao); -- 0025: capability exata após validações
      INSERT INTO public.transacoes_caixa(conta_caixa_id,tipo,categoria,descricao,valor,data_transacao,user_id)
        VALUES(v_conta_id,'saida','despesa_operacional','Pagamento: '||v_d.descricao,v_valor,v_data,p_user_id) RETURNING * INTO v_tx;
      v_saida := to_jsonb(v_tx);
      UPDATE public.contas_pagar SET status='pago',data_pagamento=v_data,conta_caixa_id=v_conta_id,"updatedAt"=now()
        WHERE id=v_d.id RETURNING * INTO v_d;
      v_depois := to_jsonb(v_d);
      INSERT INTO public.despesas_rpc_pagamentos(despesa_id,user_id,operacao_id,conta_caixa_id,valor,data_pagamento,saida_id,saida_snapshot,despesa_snapshot)
        VALUES(v_d.id,p_user_id,v_id,v_conta_id,v_valor,v_data,v_tx.id,v_saida,v_depois);
      v_pagamento_id := v_id;
    ELSE
      SELECT * INTO v_tx FROM public.transacoes_caixa WHERE id=v_pg.saida_id FOR SHARE;
      IF NOT FOUND OR to_jsonb(v_tx) IS DISTINCT FROM v_pg.saida_snapshot
        OR v_tx.tipo<>'saida' OR v_tx.categoria IS DISTINCT FROM 'despesa_operacional'
        OR v_tx.user_id IS DISTINCT FROM p_user_id OR v_tx.conta_caixa_id<>v_conta_id
        OR v_tx.valor<>v_valor OR v_tx.data_transacao<>v_pg.data_pagamento
        OR v_tx.contrato_id IS NOT NULL OR v_tx.parcela_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Saída original ausente ou alterada';
      END IF;
      v_saida := to_jsonb(v_tx);
      PERFORM public.ciclo_autorizar('estornar',v_conta_id,p_user_id,v_d.id,v_id,v_valor,v_data,'Estorno: '||v_d.descricao); -- 0025: capability exata após validações
      INSERT INTO public.transacoes_caixa(conta_caixa_id,tipo,categoria,descricao,valor,data_transacao,user_id)
        VALUES(v_conta_id,'entrada','despesa_operacional','Estorno: '||v_d.descricao,v_tx.valor,v_data,p_user_id) RETURNING * INTO v_tx;
      v_estorno := to_jsonb(v_tx);
      -- Preserva conta, valor e data de pagamento como evidência; não apaga saída.
      UPDATE public.contas_pagar SET status='cancelado',"updatedAt"=now() WHERE id=v_d.id RETURNING * INTO v_d;
      v_depois := to_jsonb(v_d);
      UPDATE public.despesas_rpc_pagamentos SET operacao_estorno_id=v_id,estorno_id=v_tx.id,estorno_snapshot=v_estorno WHERE despesa_id=v_d.id;
    END IF;
  END IF;
  v_result := jsonb_build_object('success',true,'acao',p_tipo,'operationId',v_id,'userId',p_user_id,
    'chaveIdempotencia',p_chave_idempotencia,'despesaId',v_d.id,'status',v_d.status,'valor',v_d.valor::text,
    'contaCaixaId',v_d.conta_caixa_id,'dataVencimento',v_d.data_vencimento,'dataPagamento',v_d.data_pagamento,
    'dataEstorno',CASE WHEN p_tipo='estornar' THEN v_data ELSE NULL END,'pagamentoOperationId',v_pagamento_id,
    'transacaoSaidaId',v_saida->>'id','transacaoEstornoId',v_estorno->>'id');
  INSERT INTO public.despesas_rpc_operacoes(id,user_id,chave_idempotencia,tipo,payload,hash_payload,resultado,auditoria)
    VALUES(v_id,p_user_id,p_chave_idempotencia,p_tipo,p_payload,v_hash,v_result,
      jsonb_build_object('antes',v_antes,'depois',v_depois,'origemOperationId',CASE WHEN p_tipo='criar' THEN v_id ELSE v_origem.operacao_id END,
        'saida',v_saida,'estorno',v_estorno,'motivo',v_motivo));
  RETURN v_result;
END
$rpc$;
REVOKE ALL ON FUNCTION public.despesas_rpc_executar(integer,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
