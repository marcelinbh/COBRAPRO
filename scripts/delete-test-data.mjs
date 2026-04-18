import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não encontrada");
  process.exit(1);
}

async function main() {
  const conn = await createConnection(DATABASE_URL);
  
  try {
    // Buscar clientes de teste
    const [clientes] = await conn.execute(
      "SELECT id, nome FROM clientes WHERE nome LIKE '%Teste Bateria%' OR nome LIKE '%Bateria%'"
    );
    
    console.log("Clientes de teste encontrados:", JSON.stringify(clientes, null, 2));
    
    if (clientes.length === 0) {
      console.log("Nenhum cliente de teste encontrado.");
      await conn.end();
      return;
    }
    
    for (const cliente of clientes) {
      console.log(`\nProcessando cliente: ${cliente.nome} (ID: ${cliente.id})`);
      
      // Buscar contratos do cliente
      const [contratos] = await conn.execute(
        "SELECT id FROM contratos WHERE cliente_id = ?",
        [cliente.id]
      );
      console.log(`  Contratos encontrados: ${contratos.length}`);
      
      for (const contrato of contratos) {
        // Excluir parcelas do contrato
        const [delParcelas] = await conn.execute(
          "DELETE FROM parcelas WHERE contrato_id = ?",
          [contrato.id]
        );
        console.log(`  Parcelas excluídas do contrato ${contrato.id}: ${delParcelas.affectedRows}`);
        
        // Excluir contrato
        await conn.execute("DELETE FROM contratos WHERE id = ?", [contrato.id]);
        console.log(`  Contrato ${contrato.id} excluído`);
      }
      
      // Excluir cliente
      await conn.execute("DELETE FROM clientes WHERE id = ?", [cliente.id]);
      console.log(`  Cliente ${cliente.nome} excluído com sucesso`);
    }
    
    console.log("\nLimpeza concluída com sucesso!");
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
