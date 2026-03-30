import http from 'http';
import net from 'net';

const koletor3Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJhZG1pbi1jb2JyYXByby1rb2xldG9yMyIsImFwcElkIjoiQmtxVzRXUTRuZFpISlFITHRUTWZ4diIsIm5hbWUiOiJBZG1pbiBDb2JyYVBybyIsImV4cCI6MTgwNjQyNTA4MX0.CtvXwo-D4vOgx046nCdY29THZwbhF1rIOUKZHccjha0';

// Obter lista de tabs
const tabs = await new Promise((resolve, reject) => {
  http.get('http://localhost:9222/json', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

const tab = tabs.find(t => t.url && t.url.includes('localhost:3000'));
if (!tab) { console.log('Tab not found'); process.exit(1); }

console.log('Found tab:', tab.url);
const wsUrl = new URL(tab.webSocketDebuggerUrl);
console.log('WS URL:', wsUrl.toString());

// WebSocket manual sem biblioteca externa
function createWebSocket(url) {
  return new Promise((resolve, reject) => {
    const wsUrl = new URL(url);
    const key = Buffer.from(Math.random().toString(36)).toString('base64');
    
    const socket = net.createConnection(parseInt(wsUrl.port) || 9222, wsUrl.hostname);
    
    socket.on('connect', () => {
      const handshake = [
        `GET ${wsUrl.pathname} HTTP/1.1`,
        `Host: ${wsUrl.host}`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${key}`,
        `Sec-WebSocket-Version: 13`,
        '', ''
      ].join('\r\n');
      socket.write(handshake);
    });
    
    let handshakeDone = false;
    let buffer = Buffer.alloc(0);
    const messages = [];
    const waiters = [];
    
    socket.on('data', (chunk) => {
      if (!handshakeDone) {
        const str = chunk.toString();
        if (str.includes('101 Switching Protocols')) {
          handshakeDone = true;
          const headerEnd = chunk.indexOf('\r\n\r\n');
          if (headerEnd !== -1) {
            buffer = chunk.slice(headerEnd + 4);
          }
          resolve({
            send: (msg) => {
              const data = Buffer.from(msg);
              const frame = Buffer.alloc(data.length + 10);
              frame[0] = 0x81; // text frame
              const mask = Buffer.from([0x01, 0x02, 0x03, 0x04]);
              if (data.length < 126) {
                frame[1] = 0x80 | data.length;
                mask.copy(frame, 2);
                for (let i = 0; i < data.length; i++) {
                  frame[6 + i] = data[i] ^ mask[i % 4];
                }
                socket.write(frame.slice(0, 6 + data.length));
              }
            },
            receive: () => new Promise(r => {
              if (messages.length > 0) r(messages.shift());
              else waiters.push(r);
            }),
            close: () => socket.destroy()
          });
        }
        return;
      }
      
      // Parse WebSocket frames
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const payloadLen = buffer[1] & 0x7f;
        let offset = 2;
        let len = payloadLen;
        if (payloadLen === 126) { len = buffer.readUInt16BE(2); offset = 4; }
        if (buffer.length < offset + len) break;
        const payload = buffer.slice(offset, offset + len).toString();
        buffer = buffer.slice(offset + len);
        const msg = JSON.parse(payload);
        if (waiters.length > 0) waiters.shift()(msg);
        else messages.push(msg);
      }
    });
    
    socket.on('error', reject);
  });
}

const ws = await createWebSocket(tab.webSocketDebuggerUrl);

// Definir o cookie via CDP
ws.send(JSON.stringify({
  id: 1,
  method: 'Network.setCookie',
  params: {
    name: 'app_session_id',
    value: koletor3Token,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'None',
    expires: 1806425426
  }
}));

const result = await ws.receive();
console.log('Set cookie result:', JSON.stringify(result));

// Recarregar a página
ws.send(JSON.stringify({ id: 2, method: 'Page.reload', params: {} }));
await new Promise(r => setTimeout(r, 2000));
ws.close();
console.log('Done!');
