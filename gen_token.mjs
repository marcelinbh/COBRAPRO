import { createHmac } from 'crypto';

// Gerar JWT manualmente sem dependências externas
function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const secret = process.env.JWT_SECRET;
if (!secret) { console.log('JWT_SECRET not found'); process.exit(1); }

const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const now = Math.floor(Date.now() / 1000);
const payload = base64url(JSON.stringify({
  openId: 'admin-cobrapro-koletor3',
  appId: process.env.VITE_APP_ID || 'cobrapro',
  name: 'Admin CobraPro',
  iat: now,
  exp: now + 365 * 24 * 60 * 60,
}));

const sig = createHmac('sha256', secret)
  .update(`${header}.${payload}`)
  .digest('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const token = `${header}.${payload}.${sig}`;
console.log('TOKEN:', token);
