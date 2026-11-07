DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.oid,c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' LOOP
    IF NOT r.relrowsecurity THEN RAISE EXCEPTION 'RLS ausente: %', r.relname; END IF;
    IF has_table_privilege('anon',r.oid,'SELECT') OR has_table_privilege('anon',r.oid,'INSERT') OR has_table_privilege('anon',r.oid,'UPDATE') OR has_table_privilege('anon',r.oid,'DELETE') OR has_table_privilege('authenticated',r.oid,'SELECT') OR has_table_privilege('authenticated',r.oid,'UPDATE') THEN
      RAISE EXCEPTION 'ACL pública não foi contida: %', r.relname;
    END IF;
    IF NOT has_table_privilege('service_role',r.oid,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Backend sem acesso: %',r.relname; END IF;
  END LOOP;
  IF (SELECT valor FROM public.transacoes_caixa WHERE id=1) <> 100 THEN RAISE EXCEPTION 'Valor alterado'; END IF;
  IF (SELECT count(*) FROM public.users) <> 1 OR (SELECT count(*) FROM public.password_resets) <> 1 THEN RAISE EXCEPTION 'Linhas alteradas'; END IF;
END $$;
SET ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM marker FROM public.users; RAISE EXCEPTION 'anon acessou users'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN UPDATE public.transacoes_caixa SET valor=999 WHERE id=1; RAISE EXCEPTION 'authenticated alterou Caixa'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ BEGIN
  IF (SELECT marker FROM public.users WHERE id=1) <> 'synthetic' THEN RAISE EXCEPTION 'Backend sem leitura'; END IF;
  INSERT INTO public.transacoes_caixa VALUES (2,20);
  UPDATE public.transacoes_caixa SET valor=21 WHERE id=2;
  DELETE FROM public.transacoes_caixa WHERE id=2;
END $$;
RESET ROLE;
