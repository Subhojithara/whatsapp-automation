import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import path from 'path';

console.log('Testing wwebjs with puppeteer options...');

const authDir = path.resolve('data/sessions/ses_test_options/auth');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'session', dataPath: authDir }),
  puppeteer: {
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--ignore-certificate-errors',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('QR CODE EMITTED SUCCESSFULLY!', qr.substring(0, 30));
  process.exit(0);
});

client.on('auth_failure', (e) => console.error('Auth failure:', e));

client.initialize().catch(e => console.error('Init error:', e));
