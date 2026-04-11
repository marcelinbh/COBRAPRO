-- Criar clientes de teste com atraso
INSERT INTO users (id, openId, name, email, passwordHash, loginMethod, role, lastSignedIn, createdAt, updatedAt) 
VALUES 
  (100, 'test-user-100', 'Carlos Teste', 'carlos@test.com', NULL, 'email', 'user', NOW(), NOW(), NOW()),
  (101, 'test-user-101', 'Maria Teste', 'maria@test.com', NULL, 'email', 'user', NOW(), NOW(), NOW());
