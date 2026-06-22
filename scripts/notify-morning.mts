import { notifyOwner } from '../server/_core/notification.js';

const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const atualizadas = process.env.ATUALIZADAS || '0';
const status = process.env.STATUS || 'ONLINE ✅';
const problemas = process.env.PROBLEMAS || 'Nenhum problema encontrado';

const result = await notifyOwner({
  title: `${status.includes('ONLINE') ? '✅' : '🚨'} CobraPro - Verificação Matinal`,
  content: `📅 ${hora} (Brasília)\n🌐 cobrapro.online: ${status}\n📊 Parcelas atualizadas: ${atualizadas}\n${status.includes('ONLINE') ? '✅' : '❌'} ${problemas}`
});

console.log('Notificação enviada:', result);
