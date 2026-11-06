import { config } from "dotenv";
import { pathToFileURL } from "node:url";

const BREVO_TIMEOUT_MS = 10_000;

/** Diagnóstico sem retry e sem ler/logar corpos, credenciais ou destinatários. */
export async function runBrevoDiagnostic({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  if (argv.includes("--help")) {
    logger.log("Uso: node scripts/test-brevo.mjs [--send]");
    logger.log("Padrão: consulta somente /account. Envio exige --send e BREVO_TEST_TO explícita.");
    return 0;
  }
  if (argv.some((arg) => arg !== "--send")) {
    logger.error("Argumento inválido. Use --help para consultar o uso.");
    return 1;
  }

  const key = env.BREVO_API_KEY;
  if (typeof key !== "string" || !key.trim()) {
    logger.error("BREVO_API_KEY não configurada.");
    return 1;
  }

  const shouldSend = argv.includes("--send");
  const recipient = typeof env.BREVO_TEST_TO === "string" ? env.BREVO_TEST_TO.trim() : "";
  if (shouldSend && !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(recipient)) {
    logger.error("Envio não iniciado: defina BREVO_TEST_TO com um destinatário válido explícito.");
    return 1;
  }

  try {
    const accountResponse = await fetchImpl("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: { "api-key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
    });
    logger.log(`Conta: HTTP ${accountResponse.status}`);
    if (accountResponse.status < 200 || accountResponse.status >= 300) {
      return 1;
    }
    if (!shouldSend) {
      logger.log("Consulta concluída; nenhum e-mail enviado. Envio exige --send e BREVO_TEST_TO.");
      return 0;
    }

    const emailResponse = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "CobraPro", email: "noreply@cobrapro.online" },
        to: [{ email: recipient }],
        subject: "Diagnóstico Brevo - CobraPro",
        htmlContent: "<p>Teste de envio autorizado do diagnóstico Brevo.</p>",
      }),
      signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
    });
    logger.log(`Envio: HTTP ${emailResponse.status}`);
    return emailResponse.status >= 200 && emailResponse.status < 300 ? 0 : 1;
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    logger.error(timeout
      ? "Diagnóstico interrompido por timeout; não haverá retry automático."
      : "Diagnóstico interrompido por falha de rede; não haverá retry automático.");
    if (shouldSend) {
      logger.error("Se o POST foi iniciado, a entrega pode ser indeterminada. Não repita sem reconciliar.");
    }
    return 1;
  }
}

// Importar este módulo em testes não carrega .env nem inicia chamadas de rede.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  config({ quiet: true });
  process.exitCode = await runBrevoDiagnostic();
}
