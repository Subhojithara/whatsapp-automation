import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { emitEvent } from './protocol.js';

const puppeteer = (puppeteerExtra as any).default || puppeteerExtra;
const stealth = typeof StealthPlugin === 'function' ? StealthPlugin() : (StealthPlugin as any).default?.();
puppeteer.use(stealth);

export class WebJsEngineSocket {
  private client: any = null;
  private sessionId: string;
  private idlePresenceTimer: NodeJS.Timeout | null = null;

  public resetIdlePresence(delayMs = 8000): void {
    if (this.idlePresenceTimer) {
      clearTimeout(this.idlePresenceTimer);
    }
    this.idlePresenceTimer = setTimeout(async () => {
      try {
        if (this.client) {
          console.error(`[WebJS Engine] Session ${this.sessionId} transitioned to idle -> 'unavailable'`);
          await this.client.sendPresenceUnavailable();
        }
      } catch (e: any) {
        console.error(`[WebJS Engine] Idle presence update warning: ${e?.message}`);
      }
    }, delayMs);
  }

  async setPresence(presence: 'available' | 'unavailable'): Promise<void> {
    if (!this.client) return;
    try {
      console.error(`[WebJS Engine] Setting presence to '${presence}' for ${this.sessionId}`);
      if (presence === 'available') {
        await this.client.sendPresenceAvailable();
      } else {
        await this.client.sendPresenceUnavailable();
      }
    } catch (e: any) {
      console.error(`[WebJS Engine] Failed to set presence: ${e?.message}`);
    }
  }

  async markChatRead(jid: string): Promise<void> {
    if (!this.client) return;
    try {
      const chat = await this.client.getChatById(jid);
      if (chat) {
        await chat.sendSeen();
      }
      emitEvent('chat.marked_read', this.sessionId, { jid });
    } catch (e: any) {
      console.error(`[WebJS Engine] markChatRead warning: ${e?.message}`);
    }
  }

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  private findExecutablePath(): string | undefined {
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
      console.error(`[WebJS Engine] Using custom browser path: ${process.env.CHROME_PATH}`);
      return process.env.CHROME_PATH;
    }

    const linuxCandidates = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
    ];
    for (const cand of linuxCandidates) {
      if (fs.existsSync(cand)) {
        console.error(`[WebJS Engine] Using system Linux browser: ${cand}`);
        return cand;
      }
    }

    // Check Puppeteer cache directory first
    const cacheHome = process.env.PUPPETEER_CACHE_DIR || path.join(process.env.USERPROFILE || process.env.HOME || '', '.cache', 'puppeteer');
    const chromeDir = path.join(cacheHome, 'chrome');
    if (fs.existsSync(chromeDir)) {
      try {
        const versions = fs.readdirSync(chromeDir);
        for (const ver of versions) {
          const exe = path.join(chromeDir, ver, 'chrome-win64', 'chrome.exe');
          if (fs.existsSync(exe)) {
            console.error(`[WebJS Engine] Using Puppeteer cache Chrome: ${exe}`);
            return exe;
          }
        }
      } catch (e) {}
    }

    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        console.error(`[WebJS Engine] Using system browser: ${cand}`);
        return cand;
      }
    }
    return undefined;
  }

  private async removeStaleSingletonFiles(profileDir: string): Promise<void> {
    for (const name of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
      try {
        await fs.promises.rm(path.join(profileDir, name), { force: true });
      } catch (error) {
        // Best-effort cleanup
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('qr', async (qr: string) => {
      console.error(`[WebJS Engine] QR code received for session ${this.sessionId}`);
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        emitEvent('session.qr', this.sessionId, { qr: qrDataUrl });
      } catch (err: any) {
        emitEvent('session.qr', this.sessionId, { qr });
      }
    });

    this.client.on('authenticated', () => {
      console.error(`[WebJS Engine] Session ${this.sessionId} authenticated`);
      emitEvent('session.authenticating', this.sessionId);
    });

    this.client.on('auth_failure', (msg: string) => {
      console.error(`[WebJS Engine] Session ${this.sessionId} auth failure: ${msg}`);
      emitEvent('session.failed', this.sessionId, { error: msg });
    });

    this.client.on('ready', async () => {
      console.error(`[WebJS Engine] Session ${this.sessionId} connected READY!`);
      try {
        await this.client.sendPresenceUnavailable();
        console.error(`[WebJS Engine] Session ${this.sessionId} initial presence set to 'unavailable' (anti-ban protection)`);
      } catch (e: any) {
        console.error(`[WebJS Engine] Failed to set initial unavailable presence: ${e?.message}`);
      }

      const info = this.client.info;
      const phoneNumber = info?.wid?.user || undefined;
      const displayName = info?.pushname || info?.wid?.user || undefined;

      emitEvent('session.ready', this.sessionId, {
        phoneNumber,
        displayName,
      });
    });

    this.client.on('disconnected', (reason: string) => {
      console.error(`[WebJS Engine] Session ${this.sessionId} disconnected: ${reason}`);
      emitEvent('session.disconnected', this.sessionId, { reason });
    });

    this.client.on('message', (msg: any) => {
      if (!msg.fromMe) {
        emitEvent('message.received', this.sessionId, {
          message: {
            id: msg.id?.id || String(Date.now()),
            jid: msg.from,
            senderJid: msg.author || msg.from,
            body: msg.body || '',
            timestamp: new Date(msg.timestamp * 1000).toISOString(),
            fromMe: false,
          },
        });
      }
    });
  }

  async start(authDir: string): Promise<void> {
    const resolvedAuthDir = path.resolve(authDir);
    const profileDir = path.join(resolvedAuthDir, `session-${this.sessionId}`);

    console.error(`[WebJS Engine] Starting session ${this.sessionId} with dataPath ${resolvedAuthDir}`);
    emitEvent('session.connecting', this.sessionId);

    const executablePath = this.findExecutablePath();

    const isHeadless = process.env.PUPPETEER_HEADLESS !== 'false';
    const clientOptions: any = {
      authStrategy: new LocalAuth({
        clientId: this.sessionId,
        dataPath: resolvedAuthDir,
      }),
      webVersionCache: {
        type: 'none',
      },
      puppeteer: {
        headless: isHeadless,
        executablePath,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--disable-blink-features=AutomationControlled',
        ],
      },
    };

    let retries = 0;
    const maxRetries = 3;

    while (retries <= maxRetries) {
      await this.removeStaleSingletonFiles(profileDir);

      this.client = new Client(clientOptions);
      this.setupEventHandlers();

      try {
        await this.client.initialize();
        break; // Success!
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isContextDestroyed = /execution context was destroyed/i.test(errMsg);

        if (isContextDestroyed && retries < maxRetries) {
          retries++;
          console.error(
            `[WebJS Engine] "Execution context was destroyed" caught during initialize for session ${this.sessionId}. Retrying attempt ${retries}/${maxRetries} after 2s...`
          );
          try {
            await this.client.destroy();
          } catch (e) {}
          this.client = null;
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        console.error(`[WebJS Engine] Failed to initialize session ${this.sessionId}: ${errMsg}`);
        emitEvent('session.failed', this.sessionId, { error: errMsg });
        break;
      }
    }
  }

  async stop(): Promise<void> {
    if (this.idlePresenceTimer) {
      clearTimeout(this.idlePresenceTimer);
      this.idlePresenceTimer = null;
    }
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e: any) {
        console.error(`[WebJS Engine] Error stopping session ${this.sessionId}: ${e?.message}`);
      }
      this.client = null;
    }
    emitEvent('session.stopped', this.sessionId);
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.client) {
      throw new Error('Engine client not initialized');
    }
    try {
      if (typeof (this.client as any).requestPairingCode === 'function') {
        const cleanedNumber = phoneNumber.replace(/[^0-9]/g, '');
        const code = await (this.client as any).requestPairingCode(cleanedNumber);
        emitEvent('session.pairing_code', this.sessionId, { code });
        return code;
      } else {
        throw new Error('Pairing code is not supported by WebJS engine. Please scan the QR code instead.');
      }
    } catch (err: any) {
      emitEvent('session.failed', this.sessionId, { error: err?.message || 'Failed to request pairing code' });
      throw err;
    }
  }

  async sendText(chatId: string, text: string, messageId: string): Promise<void> {
    if (!this.client) {
      throw new Error(`Engine not ready for session ${this.sessionId}`);
    }

    const trimmedChatId = chatId.trim();
    let targetJid: string;

    if (trimmedChatId.endsWith('@g.us')) {
      targetJid = trimmedChatId;
    } else {
      const cleanNumber = trimmedChatId.replace(/[^0-9]/g, '');
      targetJid = `${cleanNumber}@c.us`;

      try {
        const numberId = await this.client.getNumberId(cleanNumber);
        if (numberId?._serialized) {
          targetJid = numberId._serialized;
          console.error(`[WebJS Engine] Verified number ID: ${cleanNumber} -> ${targetJid}`);
        } else {
          console.error(`[WebJS Engine] Number ${cleanNumber} not found via getNumberId, attempting send to ${targetJid}`);
        }
      } catch (e: any) {
        console.error(`[WebJS Engine] getNumberId warning: ${e?.message}`);
      }
    }

    console.error(`[WebJS Engine] Sending text message ${messageId} to ${targetJid} on session ${this.sessionId}`);

    try {
      const msg = await this.client.sendMessage(targetJid, text);
      const externalId = msg?.id?.id || msg?.id?._serialized || undefined;

      console.error(`[WebJS Engine] Message ${messageId} sent successfully to ${targetJid}, externalId: ${externalId}`);
      emitEvent('message.sent', this.sessionId, {
        messageId,
        externalId,
      });
    } catch (err: any) {
      console.error(`[WebJS Engine] Failed to send text message ${messageId} to ${targetJid}: ${err?.message}`);
      emitEvent('message.failed', this.sessionId, {
        messageId,
        error: err?.message || 'Failed to send text message',
      });
    } finally {
      this.resetIdlePresence();
    }
  }

  async sendMedia(
    chatId: string,
    mediaType: 'image' | 'audio' | 'video' | 'document' | 'sticker',
    mediaBufferOrUrl: string,
    caption?: string,
    fileName?: string,
    mimetype?: string,
    messageId?: string
  ): Promise<void> {
    if (!this.client) {
      const err = `Engine not ready for session ${this.sessionId}`;
      if (messageId) {
        emitEvent('message.failed', this.sessionId, { messageId, error: err });
      }
      return;
    }

    const trimmedChatId = chatId.trim();
    let targetJid: string;

    if (trimmedChatId.endsWith('@g.us')) {
      targetJid = trimmedChatId;
    } else {
      const cleanNumber = trimmedChatId.replace(/[^0-9]/g, '');
      targetJid = `${cleanNumber}@c.us`;

      try {
        const numberId = await this.client.getNumberId(cleanNumber);
        if (numberId?._serialized) {
          targetJid = numberId._serialized;
        }
      } catch (e) {}
    }

    try {
      let media: any;
      if (mediaBufferOrUrl.startsWith('data:')) {
        const parts = mediaBufferOrUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimetype || (mimeMatch ? mimeMatch[1] : 'application/octet-stream');
        const b64 = parts[1];
        media = new MessageMedia(mime, b64, fileName || 'file');
      } else if (mediaBufferOrUrl.startsWith('http://') || mediaBufferOrUrl.startsWith('https://')) {
        media = await MessageMedia.fromUrl(mediaBufferOrUrl, { unsafeMime: true });
      } else if (fs.existsSync(mediaBufferOrUrl)) {
        media = MessageMedia.fromFilePath(mediaBufferOrUrl);
      } else {
        throw new Error('Invalid media input data');
      }

      const options: any = { caption };
      if (mediaType === 'audio') {
        options.sendAudioAsVoice = true;
      } else if (mediaType === 'sticker') {
        options.sendMediaAsSticker = true;
      }

      const msg = await this.client.sendMessage(targetJid, media, options);
      const externalId = msg?.id?.id || msg?.id?._serialized || undefined;

      console.error(`[WebJS Engine] Media ${messageId} sent successfully to ${targetJid}, externalId: ${externalId}`);
      if (messageId) {
        emitEvent('message.sent', this.sessionId, {
          messageId,
          externalId,
        });
      }
    } catch (err: any) {
      console.error(`[WebJS Engine] Failed to send media ${messageId} to ${targetJid}: ${err?.message}`);
      if (messageId) {
        emitEvent('message.failed', this.sessionId, {
          messageId,
          error: err?.message || 'Failed to send media message',
        });
      }
    } finally {
      this.resetIdlePresence();
    }
  }

  async getProfilePicture(jid: string): Promise<void> {
    if (!this.client) {
      emitEvent('contact.profile_picture', this.sessionId, { jid, avatarUrl: null });
      return;
    }
    try {
      let cleanJid = jid.trim();
      if (cleanJid.endsWith('@s.whatsapp.net')) {
        cleanJid = cleanJid.replace('@s.whatsapp.net', '@c.us');
      } else if (!cleanJid.includes('@')) {
        cleanJid = `${cleanJid.replace(/\D/g, '')}@c.us`;
      }
      const avatarUrl = await this.client.getProfilePicUrl(cleanJid);
      emitEvent('contact.profile_picture', this.sessionId, { jid, avatarUrl: avatarUrl || null });
    } catch (e: any) {
      emitEvent('contact.profile_picture', this.sessionId, { jid, avatarUrl: null });
    }
  }

  async getContacts(): Promise<void> {
    if (!this.client) throw new Error('WebJS client not initialized');
    const rawContacts = await this.client.getContacts();
    const contacts = (rawContacts || []).map((c: any) => ({
      jid: c.id?._serialized || `${c.number || c.id?.user}@s.whatsapp.net`,
      name: c.name || c.pushname || c.shortName || c.number || c.id?.user,
      phoneNumber: c.number || c.id?.user,
      avatarUrl: undefined,
      isGroup: c.isGroup || false,
    }));
    emitEvent('contacts.synced', this.sessionId, { contacts });
  }

  async getChats(): Promise<void> {
    if (!this.client) throw new Error('WebJS client not initialized');
    const rawChats = await this.client.getChats();
    const chats = (rawChats || []).map((c: any) => ({
      jid: c.id?._serialized || `${c.id?.user}@s.whatsapp.net`,
      name: c.name || c.id?.user,
      isGroup: c.isGroup || false,
      lastMessageBody: c.lastMessage?.body || '',
      lastMessageAt: c.lastMessage?.timestamp ? new Date(c.lastMessage.timestamp * 1000).toISOString() : undefined,
      unreadCount: c.unreadCount || 0,
    }));
    emitEvent('chats.synced', this.sessionId, { chats });
  }

  async getChatMessages(jid: string, limit: number = 50): Promise<void> {
    if (!this.client) throw new Error('WebJS client not initialized');
    let targetJid = jid.trim();
    if (targetJid.endsWith('@s.whatsapp.net')) {
      targetJid = targetJid.replace('@s.whatsapp.net', '@c.us');
    } else if (!targetJid.endsWith('@c.us') && !targetJid.endsWith('@g.us')) {
      const cleanNumber = targetJid.replace(/[^0-9]/g, '');
      targetJid = `${cleanNumber}@c.us`;
    }

    try {
      const chat = await this.client.getChatById(targetJid);
      if (!chat) {
        emitEvent('chat.messages', this.sessionId, { jid, messages: [] });
        return;
      }
      const msgs = await chat.fetchMessages({ limit });
      const messages = (msgs || []).map((m: any) => ({
        id: m.id?.id || String(Date.now()),
        jid: m.from || jid,
        senderJid: m.author || m.from || jid,
        body: m.body || '',
        timestamp: m.timestamp ? new Date(m.timestamp * 1000).toISOString() : new Date().toISOString(),
        fromMe: m.fromMe || false,
      }));
      emitEvent('chat.messages', this.sessionId, { jid, messages });
    } catch (err: any) {
      console.error(`[WebJS Engine] Failed to get chat messages for ${targetJid}: ${err?.message}`);
      emitEvent('chat.messages', this.sessionId, { jid, messages: [] });
    }
  }

  async validatePhones(phoneNumbers: string[]): Promise<void> {
    if (!this.client) {
      emitEvent('phones.validated', this.sessionId, { results: [] });
      return;
    }

    const results: Array<{ phone_number: string; phoneNumber: string; jid?: string; exists: boolean }> = [];

    for (const phone of phoneNumbers) {
      const cleanNumber = phone.replace(/[^0-9]/g, '');
      try {
        const numberId = await this.client.getNumberId(cleanNumber);
        if (numberId?._serialized) {
          results.push({
            phone_number: phone,
            phoneNumber: phone,
            jid: numberId._serialized,
            exists: true,
          });
        } else {
          results.push({
            phone_number: phone,
            phoneNumber: phone,
            exists: false,
          });
        }
      } catch (err: any) {
        console.error(`[WebJS Engine] getNumberId error for ${phone}:`, err);
        results.push({ phone_number: phone, phoneNumber: phone, exists: false });
      }
    }

    emitEvent('phones.validated', this.sessionId, { results });
  }

  async simulatePresence(jid: string, state: string, durationMs?: number): Promise<void> {
    if (!this.client) {
      emitEvent('presence.simulated', this.sessionId, { jid, state, success: false });
      return;
    }

    try {
      const rawJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@c.us`;
      const cleanJid = rawJid.replace(/@s\.whatsapp\.net$/, '@c.us');
      const chat = await this.client.getChatById(cleanJid);

      if (state === 'composing') {
        await chat.sendStateTyping();
        if (durationMs && durationMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, durationMs));
          await chat.clearState();
        }
      } else {
        await chat.clearState();
      }

      emitEvent('presence.simulated', this.sessionId, {
        jid: cleanJid,
        state,
        success: true,
      });
    } catch (err: any) {
      console.error(`[WebJS Engine] Simulate presence error for ${jid}:`, err);
      emitEvent('presence.simulated', this.sessionId, {
        jid,
        state,
        success: false,
      });
    } finally {
      this.resetIdlePresence();
    }
  }
}
