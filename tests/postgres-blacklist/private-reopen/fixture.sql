-- Executar APÓS ../fixture.sql, somente no cluster descartável PG17.
-- Estende users INTEGER (ids 1/2 sintéticos preservados); não usa dados/segredos reais.
CREATE SEQUENCE public.users_id_seq AS integer;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE public.users
  ADD COLUMN "openId" varchar(64) NOT NULL DEFAULT 'manual_synthetic',
  ADD COLUMN name text,
  ADD COLUMN email varchar(320),
  ADD COLUMN "passwordHash" varchar(255),
  ADD COLUMN "loginMethod" varchar(64),
  ADD COLUMN role varchar(20) NOT NULL DEFAULT 'user',
  ADD COLUMN "createdAt" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN "lastSignedIn" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN session_version integer NOT NULL DEFAULT 0,
  ADD COLUMN onboarding_completo boolean NOT NULL DEFAULT false,
  ADD COLUMN nome_empresa varchar(255);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.password_resets (
  id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES public.users(id),
  token varchar(255) NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false, "createdAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.synthetic_financial(user_id integer REFERENCES public.users(id), marker text);
INSERT INTO public.synthetic_financial VALUES(1,'finanças não modificadas');
-- NÃO é contrato produtivo inferido: apenas metadata de Storage simulada.
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL,
  file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects(id integer PRIMARY KEY, bucket_id text REFERENCES storage.buckets(id), name text);
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
INSERT INTO storage.buckets VALUES('cobrapro-blacklist-private','cobrapro-blacklist-private',false,
  2097152,ARRAY['image/webp','image/jpeg','image/png']);
