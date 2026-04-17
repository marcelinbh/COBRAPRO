import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Variáveis de ambiente não encontradas");
  process.exit(1);
}

const supabase = createClient(url, key);

// 1. Listar todos os usuários
console.log("=== Todos os usuários no banco ===");
const { data: allUsers, error: listError } = await supabase
  .from("users")
  .select("id, email, name, role, loginMethod, passwordHash")
  .order("id");

if (listError) {
  console.error("Erro ao listar:", listError.message);
} else {
  allUsers?.forEach(u => {
    console.log(`  ID: ${u.id} | ${u.email} | role: ${u.role} | method: ${u.loginMethod} | temSenha: ${!!u.passwordHash}`);
  });
}

// 2. Corrigir senha do contato@vitalfinanceira.com
console.log("\n=== Corrigindo senha de contato@vitalfinanceira.com ===");
const passwordHash = await bcrypt.hash("97556511", 12);

const { error: updateError } = await supabase
  .from("users")
  .update({ 
    passwordHash,
    loginMethod: "email",
    role: "admin"
  })
  .eq("email", "contato@vitalfinanceira.com");

if (updateError) {
  console.error("Erro ao atualizar:", updateError.message);
} else {
  console.log("✅ Senha atualizada com sucesso!");
}

// 3. Verificar se a senha está correta
const { data: user } = await supabase
  .from("users")
  .select("id, email, passwordHash, role, loginMethod")
  .eq("email", "contato@vitalfinanceira.com")
  .maybeSingle();

if (user) {
  const valid = await bcrypt.compare("97556511", user.passwordHash);
  console.log(`✅ Verificação da senha: ${valid ? "CORRETA" : "INCORRETA"}`);
  console.log(`   Role: ${user.role}, LoginMethod: ${user.loginMethod}`);
}
