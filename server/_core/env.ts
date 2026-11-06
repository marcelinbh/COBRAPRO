export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  evolutionApiUrl: process.env.EVOLUTION_API_URL ?? "http://147.182.191.118:8080",
  // Nunca manter chave de provedor no código: a produção exige variável criptografada.
  evolutionApiKey: process.env.EVOLUTION_API_KEY ?? "",
  evolutionWebhookToken: process.env.EVOLUTION_WEBHOOK_TOKEN ?? "",
  // Transição: callbacks antigos ainda podem carregar o segredo na query até
  // todas as instâncias serem reconfiguradas com header customizado.
  evolutionWebhookAllowLegacyQuery: process.env.EVOLUTION_WEBHOOK_ALLOW_LEGACY_QUERY !== "false",
  facebookCapiToken: process.env.FACEBOOK_CAPI_TOKEN ?? "",
  facebookPixelId: "2748566625524880",
  // Liberação explícita e reversível: sem migration/preflight a baixa segue bloqueada.
  enableRpcRecebimentoParcela: process.env.ENABLE_RPC_RECEBIMENTO_PARCELA === "true",
  // Ativar somente após a 0016; depois, não desligar para ressuscitar sessões antigas.
  enableSessionRevocation: process.env.ENABLE_SESSION_REVOCATION === "true",
};
