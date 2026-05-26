export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Retorna sempre /login — autenticação própria via email/senha (Supabase), SEM OAuth do Manus
export const getLoginUrl = (_returnPath?: string) => "/login";
