CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.users (id integer PRIMARY KEY, marker text NOT NULL);
INSERT INTO public.users VALUES (1, 'synthetic');
CREATE TABLE public.password_resets (id integer PRIMARY KEY, token text NOT NULL);
INSERT INTO public.password_resets VALUES (1, 'synthetic-not-a-real-token');
CREATE TABLE public.transacoes_caixa (id integer PRIMARY KEY, valor numeric NOT NULL);
INSERT INTO public.transacoes_caixa VALUES (1, 100.00);
GRANT ALL ON ALL TABLES IN SCHEMA public TO PUBLIC, anon, authenticated, service_role;
-- Uma política permissiva não deve contornar a revogação de ACL.
CREATE POLICY permissive_test ON public.users USING (true) WITH CHECK (true);
