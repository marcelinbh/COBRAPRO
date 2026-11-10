-- Synthetic fixture matching the parent-confirmed production catalog. No PII.
CREATE TABLE public.users (
  id SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  "passwordHash" VARCHAR(255),
  "loginMethod" VARCHAR(64),
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastSignedIn" TIMESTAMPTZ NOT NULL DEFAULT now(),
  onboarding_completo BOOLEAN NOT NULL DEFAULT false,
  nome_empresa VARCHAR(255),
  session_version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE public.password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.synthetic_financial(user_id INTEGER REFERENCES public.users(id), marker TEXT);
INSERT INTO public.users("openId",name,email,"passwordHash",role,onboarding_completo,nome_empresa,session_version)
  VALUES('manual_1','Nome manual',' Manual@Example.Invalid ','preserve-manual-hash','admin',true,'Empresa manual',17),
  ('manual_2','Ambíguo1','ambiguous@example.invalid','preserve-2','user',false,NULL,9),
  ('manual_3','Ambíguo2',' AMBIGUOUS@EXAMPLE.INVALID ','preserve-3','admin',true,NULL,3);
INSERT INTO public.synthetic_financial VALUES(1,'private synthetic financial marker');
-- Real Supabase known-role defaults, including PG17 MAINTAIN. New package must
-- strip only these on initial install. Unknown defaults must refuse + rollback.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
