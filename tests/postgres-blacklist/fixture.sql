-- Apenas cluster descartável do runner. Nenhum dado real ou schema de produção.
CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE outsider NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE TABLE public.users (id integer PRIMARY KEY);
INSERT INTO public.users (id) VALUES (1), (2);
