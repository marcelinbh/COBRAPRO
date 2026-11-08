-- 0020: somente despesas NOVAS. Não depende de 0013/0015, não reconcilia legado.
-- Aplicar como uma unidade; qualquer incompatibilidade aborta, sem reparar homônimos.
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(20261107, 20);

DO $preflight$
DECLARE r record; actual text; expected text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated') THEN
    RAISE EXCEPTION '0020: roles backend/clientes ausentes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace
                 WHERE e.extname='pgcrypto' AND n.nspname='extensions') THEN
    RAISE EXCEPTION '0020: pgcrypto deve existir em extensions';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('users','id','integer',true),
    ('contas_caixa','id','integer',true),('contas_caixa','user_id','integer',false),
    ('contas_caixa','ativo','boolean',true),('contas_caixa','saldo','numeric(15,2)',true),
    ('contas_pagar','id','integer',true),('contas_pagar','user_id','integer',false),
    ('contas_pagar','descricao','character varying(255)',true),('contas_pagar','categoria','character varying(50)',false),
    ('contas_pagar','valor','numeric(15,2)',true),('contas_pagar','data_vencimento','date',true),
    ('contas_pagar','data_pagamento','date',false),('contas_pagar','status','character varying(20)',false),
    ('contas_pagar','recorrente','boolean',false),('contas_pagar','frequencia','character varying(20)',false),
    ('contas_pagar','conta_caixa_id','integer',false),('contas_pagar','observacoes','text',false),
    ('contas_pagar','createdAt','timestamp with time zone',true),('contas_pagar','updatedAt','timestamp with time zone',true),
    ('transacoes_caixa','id','integer',true),('transacoes_caixa','conta_caixa_id','integer',true),
    ('transacoes_caixa','tipo','character varying(10)',true),('transacoes_caixa','categoria','character varying(50)',false),
    ('transacoes_caixa','descricao','text',true),('transacoes_caixa','valor','numeric(15,2)',true),
    ('transacoes_caixa','data_transacao','date',true),('transacoes_caixa','contrato_id','integer',false),
    ('transacoes_caixa','parcela_id','integer',false),('transacoes_caixa','createdAt','timestamp with time zone',true),
    ('transacoes_caixa','user_id','integer',false)
  ) x(tab,col,typ,nn) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
      WHERE n.nspname='public' AND c.relname=r.tab AND c.relkind='r' AND a.attname=r.col
        AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated='' AND a.attidentity=''
        AND pg_catalog.format_type(a.atttypid,a.atttypmod)=r.typ AND a.attnotnull=r.nn) THEN
      RAISE EXCEPTION '0020: coluna incompatível public.%.%',r.tab,r.col;
    END IF;
  END LOOP;
  -- VARCHAR CHECK produtivo, não enums planejados. Categoria do Caixa NÃO tem CHECK no snapshot.
  CREATE TEMP TABLE despesas_rpc_check_modelo(status varchar(20),categoria varchar(50),frequencia varchar(20),tipo varchar(10)) ON COMMIT DROP;
  FOR r IN SELECT * FROM (VALUES
    ('contas_pagar','contas_pagar_status_check', 'CHECK (status::text = ANY (ARRAY[''pendente''::character varying, ''pago''::character varying, ''atrasado''::character varying, ''cancelado''::character varying]::text[]))'),
    ('contas_pagar','contas_pagar_categoria_check', 'CHECK (categoria::text = ANY (ARRAY[''aluguel''::character varying, ''energia''::character varying, ''agua''::character varying, ''internet''::character varying, ''telefone''::character varying, ''salario''::character varying, ''imposto''::character varying, ''fornecedor''::character varying, ''outros''::character varying]::text[]))'),
    ('contas_pagar','contas_pagar_frequencia_check', 'CHECK (frequencia::text = ANY (ARRAY[''mensal''::character varying, ''semanal''::character varying, ''quinzenal''::character varying, ''anual''::character varying]::text[]))'),
    ('transacoes_caixa','transacoes_caixa_tipo_check', 'CHECK (tipo::text = ANY (ARRAY[''entrada''::character varying, ''saida''::character varying]::text[]))')
  ) x(tab,con,def) LOOP
    SELECT pg_catalog.pg_get_constraintdef(c.oid,false) INTO actual FROM pg_catalog.pg_constraint c
      WHERE c.conrelid=pg_catalog.to_regclass('public.'||r.tab) AND c.conname=r.con
        AND c.contype='c' AND c.convalidated AND NOT c.connoinherit;
    EXECUTE 'ALTER TABLE pg_temp.despesas_rpc_check_modelo ADD CONSTRAINT modelo '||r.def;
    SELECT pg_catalog.pg_get_constraintdef(oid,false) INTO expected FROM pg_catalog.pg_constraint
      WHERE conrelid='pg_temp.despesas_rpc_check_modelo'::regclass AND conname='modelo';
    IF actual IS DISTINCT FROM expected THEN
      RAISE EXCEPTION '0020: CHECK incompatível %.%: %',r.tab,r.con,actual;
    END IF;
    ALTER TABLE pg_temp.despesas_rpc_check_modelo DROP CONSTRAINT modelo;
  END LOOP;
  DROP TABLE pg_temp.despesas_rpc_check_modelo;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.transacoes_caixa'::regclass
             AND contype='c' AND conname<>'transacoes_caixa_tipo_check') THEN
    RAISE EXCEPTION '0020: CHECK de Caixa não previsto; revisar contrato antes de instalar';
  END IF;
  -- Não aceitar homônimos em schemas alternativos (inclusive views e tipos compostos).
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname IN ('despesas_rpc_origens','despesas_rpc_pagamentos','despesas_rpc_operacoes')
      AND n.nspname<>'public') THEN RAISE EXCEPTION '0020: tabela homônima fora de public'; END IF;
  FOR r IN SELECT p.oid,p.proname,p.proowner,p.pronamespace,p.proargtypes
    FROM pg_catalog.pg_proc p WHERE p.proname IN ('despesas_rpc_executar',
      'rpc_criar_despesa_prospectiva','rpc_pagar_despesa_prospectiva','rpc_estornar_despesa_prospectiva') LOOP
    expected := CASE r.proname
      WHEN 'despesas_rpc_executar' THEN 'integer,uuid,text,jsonb'
      WHEN 'rpc_criar_despesa_prospectiva' THEN 'integer,text,text,numeric,date,text,uuid'
      WHEN 'rpc_pagar_despesa_prospectiva' THEN 'integer,integer,integer,date,uuid'
      ELSE 'integer,integer,uuid,date,text,uuid' END;
    IF r.pronamespace<>'public'::regnamespace OR pg_catalog.pg_get_userbyid(r.proowner)<>current_user
       OR r.oid<>coalesce(pg_catalog.to_regprocedure('public.'||r.proname||'('||expected||')'),0) THEN
      RAISE EXCEPTION '0020: homônimo/owner/assinatura de função incompatível: %',r.proname;
    END IF;
  END LOOP;
END
$preflight$;

-- Modelo efêmero confiável permite comparar TODOS os campos/defaults, CHECKs, FKs e
-- índices de homônimos; IF NOT EXISTS sozinho não certificaria nada. Nunca adota dados.
CREATE SCHEMA despesas_rpc_0020_modelo;
REVOKE ALL ON SCHEMA despesas_rpc_0020_modelo FROM PUBLIC, anon, authenticated, service_role;
DO $tables$
DECLARE s text; tab text; a jsonb; b jsonb;
BEGIN
  FOREACH s IN ARRAY ARRAY['despesas_rpc_0020_modelo','public'] LOOP
    IF s='despesas_rpc_0020_modelo' OR pg_catalog.to_regclass(s||'.despesas_rpc_operacoes') IS NULL THEN
      EXECUTE pg_catalog.format($ddl$
        CREATE TABLE %I.despesas_rpc_operacoes (
          id uuid PRIMARY KEY,
          user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
          chave_idempotencia uuid NOT NULL,
          tipo text NOT NULL CHECK (tipo IN ('criar','pagar','estornar')),
          payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
          hash_payload bytea NOT NULL CHECK (octet_length(hash_payload)=32),
          resultado jsonb NOT NULL CHECK (jsonb_typeof(resultado)='object' AND resultado->>'success'='true'),
          auditoria jsonb NOT NULL CHECK (jsonb_typeof(auditoria)='object' AND auditoria ? 'depois'),
          criado_em timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT despesas_rpc_operacoes_user_chave_uk UNIQUE(user_id,chave_idempotencia)
        )$ddl$,s);
    END IF;
    IF s='despesas_rpc_0020_modelo' OR pg_catalog.to_regclass(s||'.despesas_rpc_origens') IS NULL THEN
      EXECUTE pg_catalog.format($ddl$
        CREATE TABLE %1$I.despesas_rpc_origens (
          despesa_id integer PRIMARY KEY REFERENCES public.contas_pagar(id) ON DELETE RESTRICT,
          user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
          operacao_id uuid NOT NULL UNIQUE REFERENCES %1$I.despesas_rpc_operacoes(id)
            ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
          snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
          criado_em timestamptz NOT NULL DEFAULT now()
        )$ddl$,s);
    END IF;
    IF s='despesas_rpc_0020_modelo' OR pg_catalog.to_regclass(s||'.despesas_rpc_pagamentos') IS NULL THEN
      EXECUTE pg_catalog.format($ddl$
        CREATE TABLE %1$I.despesas_rpc_pagamentos (
          despesa_id integer PRIMARY KEY REFERENCES %1$I.despesas_rpc_origens(despesa_id) ON DELETE RESTRICT,
          user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
          operacao_id uuid NOT NULL UNIQUE REFERENCES %1$I.despesas_rpc_operacoes(id)
            ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
          conta_caixa_id integer NOT NULL REFERENCES public.contas_caixa(id) ON DELETE RESTRICT,
          valor numeric(15,2) NOT NULL CHECK (valor>0 AND valor<=9999999999999.99),
          data_pagamento date NOT NULL,
          saida_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id) ON DELETE RESTRICT,
          saida_snapshot jsonb NOT NULL CHECK (jsonb_typeof(saida_snapshot)='object'),
          despesa_snapshot jsonb NOT NULL CHECK (jsonb_typeof(despesa_snapshot)='object'),
          operacao_estorno_id uuid UNIQUE REFERENCES %1$I.despesas_rpc_operacoes(id)
            ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
          estorno_id integer UNIQUE REFERENCES public.transacoes_caixa(id) ON DELETE RESTRICT,
          estorno_snapshot jsonb,
          CONSTRAINT despesas_rpc_pagamentos_estorno_check CHECK (
            (operacao_estorno_id IS NULL AND estorno_id IS NULL AND estorno_snapshot IS NULL) OR
            (operacao_estorno_id IS NOT NULL AND estorno_id IS NOT NULL AND estorno_snapshot IS NOT NULL
             AND jsonb_typeof(estorno_snapshot)='object' AND estorno_id<>saida_id))
        )$ddl$,s);
    END IF;
  END LOOP;
  FOREACH tab IN ARRAY ARRAY['despesas_rpc_operacoes','despesas_rpc_origens','despesas_rpc_pagamentos'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=pg_catalog.to_regclass('public.'||tab)
                   AND relkind='r' AND relpersistence='p' AND NOT relispartition) THEN
      RAISE EXCEPTION '0020: homônimo não é tabela permanente: %',tab;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass('public.'||tab)
      AND pg_catalog.pg_get_userbyid(c.relowner)<>current_user) THEN
      RAISE EXCEPTION '0020: proprietário inesperado: %',tab;
    END IF;
    -- Includes exact column order, type, nullability, collation, identity, generation and defaults.
    SELECT jsonb_agg(jsonb_build_array(attnum,attname,pg_catalog.format_type(atttypid,atttypmod),
      attnotnull,attidentity,attgenerated,attcollation,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) ORDER BY attnum)
      INTO a FROM pg_catalog.pg_attribute x LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=x.attrelid AND d.adnum=x.attnum
      WHERE x.attrelid=pg_catalog.to_regclass('public.'||tab) AND attnum>0 AND NOT attisdropped;
    SELECT jsonb_agg(jsonb_build_array(attnum,attname,pg_catalog.format_type(atttypid,atttypmod),
      attnotnull,attidentity,attgenerated,attcollation,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) ORDER BY attnum)
      INTO b FROM pg_catalog.pg_attribute x LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=x.attrelid AND d.adnum=x.attnum
      WHERE x.attrelid=pg_catalog.to_regclass('despesas_rpc_0020_modelo.'||tab) AND attnum>0 AND NOT attisdropped;
    IF a IS DISTINCT FROM b THEN RAISE EXCEPTION '0020: campos/defaults incompatíveis: %',tab; END IF;
    SELECT jsonb_agg(jsonb_build_array(conname,contype,convalidated,condeferrable,condeferred,
      pg_catalog.pg_get_constraintdef(oid,false)) ORDER BY conname) INTO a
      FROM pg_catalog.pg_constraint WHERE conrelid=pg_catalog.to_regclass('public.'||tab);
    SELECT jsonb_agg(jsonb_build_array(conname,contype,convalidated,condeferrable,condeferred,
      replace(pg_catalog.pg_get_constraintdef(oid,false),'despesas_rpc_0020_modelo.','public.')) ORDER BY conname) INTO b
      FROM pg_catalog.pg_constraint WHERE conrelid=pg_catalog.to_regclass('despesas_rpc_0020_modelo.'||tab);
    -- pg_get_constraintdef omits visible public qualification.
    a := replace(a::text,'public.','')::jsonb; b := replace(b::text,'public.','')::jsonb;
    IF a IS DISTINCT FROM b THEN RAISE EXCEPTION '0020: CHECK/FK/unique incompatíveis: %',tab; END IF;
    SELECT jsonb_agg(jsonb_build_array(c.relname,i.indisunique,i.indisvalid,i.indisready,
      pg_catalog.pg_get_indexdef(i.indexrelid)) ORDER BY c.relname) INTO a
      FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid
      WHERE i.indrelid=pg_catalog.to_regclass('public.'||tab);
    SELECT jsonb_agg(jsonb_build_array(c.relname,i.indisunique,i.indisvalid,i.indisready,
      replace(pg_catalog.pg_get_indexdef(i.indexrelid),'despesas_rpc_0020_modelo.','public.')) ORDER BY c.relname) INTO b
      FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid
      WHERE i.indrelid=pg_catalog.to_regclass('despesas_rpc_0020_modelo.'||tab);
    IF a IS DISTINCT FROM b THEN RAISE EXCEPTION '0020: índices incompatíveis: %',tab; END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=pg_catalog.to_regclass('public.'||tab) AND NOT tgisinternal)
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=pg_catalog.to_regclass('public.'||tab)) THEN
      RAISE EXCEPTION '0020: trigger/policy inesperado: %',tab;
    END IF;
    EXECUTE pg_catalog.format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE pg_catalog.format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',tab);
    -- DML somente pelo definer; service_role pode inspecionar a trilha, não fabricá-la via REST.
    EXECUTE pg_catalog.format('GRANT SELECT ON TABLE public.%I TO service_role',tab);
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c,
      LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) g
      WHERE c.oid=pg_catalog.to_regclass('public.'||tab) AND g.grantee<>c.relowner
        AND NOT (g.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role')
                 AND g.privilege_type='SELECT' AND NOT g.is_grantable))
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a, LATERAL pg_catalog.aclexplode(a.attacl) g
        WHERE a.attrelid=pg_catalog.to_regclass('public.'||tab)
          AND g.grantee<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid=a.attrelid)) THEN
      RAISE EXCEPTION '0020: grants residuais de tabela/coluna incompatíveis: %',tab;
    END IF;
  END LOOP;
END
$tables$;
DROP SCHEMA despesas_rpc_0020_modelo CASCADE;

-- Nenhuma sequência nova (IDs operacionais UUID). Preserva privilégios legados; garante
-- uso backend das duas sequências existentes utilizadas pelas RPCs.
DO $sequences$
DECLARE tab text; seq text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['contas_pagar','transacoes_caixa'] LOOP
    seq := pg_catalog.pg_get_serial_sequence('public.'||tab,'id');
    IF seq IS NULL THEN RAISE EXCEPTION '0020: sequência de % ausente',tab; END IF;
    EXECUTE pg_catalog.format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated',seq);
    EXECUTE pg_catalog.format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role',seq);
  END LOOP;
END
$sequences$;

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

CREATE OR REPLACE FUNCTION public.rpc_criar_despesa_prospectiva(
  p_user_id integer, p_descricao text, p_categoria text, p_valor numeric,
  p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
SET TimeZone = 'UTC'
AS $$ SELECT public.despesas_rpc_executar(p_user_id,p_chave_idempotencia,'criar',
  jsonb_build_object('descricao',p_descricao,'categoria',p_categoria,'valor',p_valor,
    'dataVencimento',p_data_vencimento,'observacoes',p_observacoes)) $$;

CREATE OR REPLACE FUNCTION public.rpc_pagar_despesa_prospectiva(
  p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
SET TimeZone = 'UTC'
AS $$ SELECT public.despesas_rpc_executar(p_user_id,p_chave_idempotencia,'pagar',
  jsonb_build_object('despesaId',p_despesa_id,'contaCaixaId',p_conta_caixa_id,'data',p_data_pagamento)) $$;

CREATE OR REPLACE FUNCTION public.rpc_estornar_despesa_prospectiva(
  p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid,
  p_data_estorno date, p_motivo text, p_chave_idempotencia uuid
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
SET TimeZone = 'UTC'
AS $$ SELECT public.despesas_rpc_executar(p_user_id,p_chave_idempotencia,'estornar',
  jsonb_build_object('despesaId',p_despesa_id,'pagamentoOperationId',p_pagamento_operation_id,'data',p_data_estorno,'motivo',p_motivo)) $$;

REVOKE ALL ON FUNCTION public.despesas_rpc_executar(integer,uuid,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_criar_despesa_prospectiva(integer,text,text,numeric,date,text,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_pagar_despesa_prospectiva(integer,integer,integer,date,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_estornar_despesa_prospectiva(integer,integer,uuid,date,text,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_criar_despesa_prospectiva(integer,text,text,numeric,date,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_pagar_despesa_prospectiva(integer,integer,integer,date,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_estornar_despesa_prospectiva(integer,integer,uuid,date,text,uuid) TO service_role;

DO $function_acl$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p,
    LATERAL pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) g
    WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('despesas_rpc_executar',
      'rpc_criar_despesa_prospectiva','rpc_pagar_despesa_prospectiva','rpc_estornar_despesa_prospectiva')
      AND g.grantee<>p.proowner AND NOT (p.proname<>'despesas_rpc_executar'
        AND g.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role')
        AND g.privilege_type='EXECUTE' AND NOT g.is_grantable)) THEN
    RAISE EXCEPTION '0020: grants residuais de função incompatíveis';
  END IF;
END
$function_acl$;
COMMIT;
