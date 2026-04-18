import "dotenv/config";

const key = process.env.BREVO_API_KEY;
console.log("BREVO_API_KEY presente:", !!key, "| Primeiros chars:", key ? key.substring(0, 12) + "..." : "N/A");

if (!key) {
  console.error("BREVO_API_KEY não configurada!");
  process.exit(1);
}

// Testar conta
const res = await fetch("https://api.brevo.com/v3/account", {
  headers: { "api-key": key, Accept: "application/json" },
});
const data = await res.json();
console.log("Status HTTP:", res.status);
console.log("Resposta:", JSON.stringify(data).substring(0, 300));

// Testar envio de e-mail
if (res.status === 200) {
  console.log("\nTestando envio de e-mail...");
  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "CobraPro", email: "noreply@cobrapro.online" },
      to: [{ email: "contato@vitalfinanceira.com", name: "Teste" }],
      subject: "Teste Webhook Kiwify - CobraPro",
      htmlContent: "<p>Teste de envio via Brevo. Se recebeu este e-mail, a integração está funcionando!</p>",
    }),
  });
  const emailData = await emailRes.json();
  console.log("Email status:", emailRes.status, JSON.stringify(emailData));
}
