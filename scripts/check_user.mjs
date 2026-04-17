import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Variáveis de ambiente não encontradas");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data, error } = await supabase
  .from("users")
  .select("id, email, name, role, loginMethod, passwordHash, createdAt")
  .eq("email", "contato@vitalfinanceira.com")
  .maybeSingle();

if (error) {
  console.error("Erro:", error.message);
} else if (!data) {
  console.log("❌ Usuário NÃO encontrado no banco!");
  
  // Listar todos os usuários para ver o que existe
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, email, name, role, loginMethod")
    .limit(20);
  
  console.log("\nUsuários existentes no banco:");
  allUsers?.forEach(u => {
    console.log(`  - ${u.email} | role: ${u.role} | method: ${u.loginMethod}`);
  });
} else {
  console.log("✅ Usuário encontrado:");
  console.log(`  Email: ${data.email}`);
  console.log(`  Nome: ${data.name}`);
  console.log(`  Role: ${data.role}`);
  console.log(`  LoginMethod: ${data.loginMethod}`);
  console.log(`  Tem passwordHash: ${!!data.passwordHash}`);
  console.log(`  Hash (primeiros 20 chars): ${data.passwordHash?.substring(0, 20)}...`);
}
