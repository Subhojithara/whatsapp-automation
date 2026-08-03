import makeWASocket, {
  WASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  WAMessage,
  Contact as BaileysContact,
  Chat as BaileysChat,
  Browsers,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';

import { Boom } from '@hapi/boom';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import QRCode from 'qrcode';
import { getAuthState } from './auth.js';
import { emitEvent } from './protocol.js';

export class EngineSocket {
  private sock: WASocket | null = null;
  private sessionId: string;
  private authDir: string;
  private isExplicitStop = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;
  private messageStore = new Map<string, WAMessage>();
  private contactStore = new Map<string, BaileysContact>();
  private chatStore = new Map<string, BaileysChat>();
  /** Tracks the current WhatsApp connection state */
  private connectionState: 'connecting' | 'open' | 'close' = 'close';
  /** In-memory LID↔PN mapping cache, populated from history sync and lid-mapping.update events */
  private lidToPn = new Map<string, string>();
  private pnToLid = new Map<string, string>();

  constructor(sessionId: string, authDir: string = '') {
    this.sessionId = sessionId;
    this.authDir = authDir;
  }

  private get storeFilePath(): string {
    return path.join(this.authDir, 'message_store.json');
  }

  private loadMessageStore(): void {
    try {
      if (fs.existsSync(this.storeFilePath)) {
        const raw = fs.readFileSync(this.storeFilePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item?.key?.id) {
              this.messageStore.set(item.key.id, item);
            }
          }
          console.error(`[Engine Socket] Loaded ${this.messageStore.size} persistent messages for ${this.sessionId}`);
        }
      }
    } catch (e: any) {
      console.error(`[Engine Socket] Failed to load message_store.json for ${this.sessionId}: ${e?.message}`);
    }
  }

  private saveMessageStore(): void {
    try {
      const items = Array.from(this.messageStore.values()).slice(-1000);
      fs.writeFileSync(this.storeFilePath, JSON.stringify(items), 'utf8');
    } catch (e: any) {
      console.error(`[Engine Socket] Failed to save message_store.json for ${this.sessionId}: ${e?.message}`);
    }
  }

  async start(authDir?: string): Promise<void> {
    try {
      if (authDir) {
        this.authDir = authDir;
      }
      console.error(`[Engine Socket] Starting session ${this.sessionId} at ${this.authDir}`);
      emitEvent('session.connecting', this.sessionId);

      this.loadMessageStore();

      const logger = pino({ level: 'silent' });
      const { state, saveCreds } = await getAuthState(this.authDir);

      let version: [number, number, number] = [2, 3000, 1015901307];
      try {
        const fetched = await fetchLatestBaileysVersion();
        version = fetched.version;
        console.error(`[Engine Socket] Using Baileys version ${version.join('.')}`);
      } catch (e) {
        console.error(`[Engine Socket] Using fallback Baileys version ${version.join('.')}`);
      }

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: logger as any,
        browser: Browsers.macOS('Desktop'),
        keepAliveIntervalMs: 15000,
        connectTimeoutMs: 30000,
        defaultQueryTimeoutMs: 30000,
        generateHighQualityLinkPreview: true,
        shouldSyncHistoryMessage: () => true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        getMessage: async (key) => {
          if (!key.id) return undefined;
          const cached = this.messageStore.get(key.id);
          return cached?.message || undefined;
        },
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('messages.upsert', async (m) => {
        if (m.messages) {
          for (const msg of m.messages) {
            if (msg.key?.id) {
              this.cacheMessage(msg.key.id, msg);
            }
            const rawJid = msg.key?.remoteJid || '';
            const mappedPn = rawJid.endsWith('@lid') ? this.lidToPn.get(rawJid) : undefined;
            const jid = mappedPn ? (mappedPn.endsWith('@s.whatsapp.net') ? mappedPn : `${mappedPn}@s.whatsapp.net`) : rawJid;
            const senderJid = msg.key?.participant || jid;
            const timestamp = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString();

            if (jid) {
              const existing = this.chatStore.get(jid) || ({ id: jid } as BaileysChat);
              this.chatStore.set(jid, {
                ...existing,
                id: jid,
                conversationTimestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) : ((existing as any).conversationTimestamp || Math.floor(Date.now() / 1000)),
              } as BaileysChat);
            }

            const msgContent = msg.message;
            let messageType = 'text';
            let body = '';
            let mediaUrl: string | undefined = undefined;

            if (msgContent) {
              if (msgContent.conversation) {
                body = msgContent.conversation;
                messageType = 'text';
              } else if (msgContent.extendedTextMessage) {
                body = msgContent.extendedTextMessage.text || '';
                messageType = 'text';
              } else if (msgContent.audioMessage) {
                messageType = 'audio';
                body = msgContent.audioMessage.ptt ? '🎙️ Voice Note' : '🎵 Audio File';
              } else if (msgContent.imageMessage) {
                messageType = 'image';
                body = msgContent.imageMessage.caption || '📷 Image';
              } else if (msgContent.videoMessage) {
                messageType = 'video';
                body = msgContent.videoMessage.caption || '🎥 Video';
              } else if (msgContent.documentMessage) {
                messageType = 'document';
                body = msgContent.documentMessage.fileName || msgContent.documentMessage.caption || '📄 Document';
              } else if (msgContent.stickerMessage) {
                messageType = 'sticker';
                body = '🏷️ Sticker';
              }

              if (messageType !== 'text' && this.sock) {
                try {
                  const buffer = await downloadMediaMessage(msg, 'buffer', {});
                  if (buffer && buffer.length > 0) {
                    const mime =
                      msgContent.audioMessage?.mimetype ||
                      msgContent.imageMessage?.mimetype ||
                      msgContent.videoMessage?.mimetype ||
                      msgContent.documentMessage?.mimetype ||
                      msgContent.stickerMessage?.mimetype ||
                      'application/octet-stream';
                    mediaUrl = `data:${mime};base64,${buffer.toString('base64')}`;
                  }
                } catch (err) {
                  console.error(`[Engine Socket] Failed to download media for ${msg.key.id}:`, err);
                }
              }
            }

            if ((body || mediaUrl) && !msg.key?.fromMe) {
              emitEvent('message.received', this.sessionId, {
                message: {
                  id: msg.key.id,
                  jid,
                  senderJid,
                  body,
                  messageType,
                  mediaUrl,
                  timestamp,
                  fromMe: false,
                },
              });
            }
          }
        }
      });

      this.sock.ev.on('messages.update', (updates) => {
        for (const { key, update } of updates) {
          if (key.id && update.status !== undefined) {
            let statusStr = 'sent';
            if (update.status === 2) {
              statusStr = 'delivered';
            } else if (update.status === 3 || update.status === 4) {
              statusStr = 'read';
            } else if (update.status === 0) {
              statusStr = 'failed';
            } else if (update.status === 1) {
              statusStr = 'sent';
            }

            console.error(`[Engine Socket] Message ${key.id} status update: ${update.status} (${statusStr})`);

            emitEvent('message.delivery_update', this.sessionId, {
              externalId: key.id,
              status: statusStr,
              statusCode: update.status,
            });
          }
        }
      });

      // Capture LID↔PN mappings and store contacts from contacts events
      const processContacts = (contacts: Partial<BaileysContact>[]) => {
        for (const c of contacts) {
          if (c.id) {
            const existing = this.contactStore.get(c.id) || ({} as BaileysContact);
            this.contactStore.set(c.id, { ...existing, ...c } as BaileysContact);
          }
          const phone = (c as any).phoneNumber || (c.id?.endsWith('@s.whatsapp.net') ? c.id : undefined);
          if (c.lid && phone) {
            this.addLidMapping(c.lid, phone);
          }
        }
      };

      const processChats = (chats: Partial<BaileysChat>[]) => {
        for (const chat of chats) {
          if (chat.id) {
            const existing = this.chatStore.get(chat.id) || ({} as BaileysChat);
            this.chatStore.set(chat.id, { ...existing, ...chat } as BaileysChat);
          }
        }
      };

      this.sock.ev.on('contacts.upsert', (contacts) => processContacts(contacts));
      this.sock.ev.on('contacts.update', (updates) => processContacts(updates));
      this.sock.ev.on('chats.upsert', (chats) => processChats(chats));
      this.sock.ev.on('chats.update', (updates) => processChats(updates));

      // Capture LID↔PN mappings, contacts, and chats from history sync
      this.sock.ev.on('messaging-history.set', (history: any) => {
        const mappings = history?.lidPnMappings;
        if (Array.isArray(mappings)) {
          for (const m of mappings) {
            if (m.lid && m.pn) {
              this.addLidMapping(m.lid, m.pn);
            }
          }
          console.error(`[Engine Socket] History sync: loaded ${mappings.length} LID↔PN mappings for ${this.sessionId}`);
        }
        if (Array.isArray(history?.contacts)) {
          processContacts(history.contacts);
        }
        if (Array.isArray(history?.chats)) {
          processChats(history.chats);
        }
        if (Array.isArray(history?.messages)) {
          for (const msg of history.messages) {
            if (msg?.key?.id) {
              this.cacheMessage(msg.key.id, msg);
            }
          }
        }
      });

      // Capture live LID↔PN mapping updates pushed by WhatsApp
      this.sock.ev.on('lid-mapping.update' as any, (update: any) => {
        if (update?.lid && update?.pn) {
          this.addLidMapping(update.lid, update.pn);
          console.error(`[Engine Socket] LID mapping update: ${update.pn} → ${update.lid} for ${this.sessionId}`);
        }
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Track connection state for sendText pre-flight checks
        if (connection) {
          this.connectionState = connection;
        }

        if (qr) {
          console.error(`[Engine Socket] QR code generated for ${this.sessionId}`);
          try {
            const qrDataUrl = await QRCode.toDataURL(qr);
            emitEvent('session.qr', this.sessionId, { qr: qrDataUrl });
          } catch (err: any) {
            emitEvent('session.qr', this.sessionId, { qr });
          }
        }

        if (connection === 'connecting') {
          console.error(`[Engine Socket] Connecting event for ${this.sessionId}`);
          emitEvent('session.connecting', this.sessionId);
        }

        if (connection === 'open') {
          console.error(`[Engine Socket] Session ${this.sessionId} connected READY!`);
          this.reconnectAttempts = 0;

          // Force registered: true and persist creds when connection is open
          if (state && state.creds && !state.creds.registered) {
            state.creds.registered = true;
            try {
              await saveCreds();
              console.error(`[Engine Socket] Session ${this.sessionId} creds saved with registered: true`);
            } catch (e: any) {
              console.error(`[Engine Socket] Failed to save registered creds: ${e?.message}`);
            }
          }

          const user = this.sock?.user;
          const phoneNumber = user?.id ? user.id.split(':')[0].split('@')[0] : undefined;
          const displayName = user?.name || undefined;

          emitEvent('session.ready', this.sessionId, {
            phoneNumber,
            displayName,
          });
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const errorMsg = lastDisconnect?.error?.message || 'Connection closed';
          console.error(`[Engine Socket] Connection closed for ${this.sessionId}, status: ${statusCode}, reason: ${errorMsg}`);

          if (this.isExplicitStop) {
            emitEvent('session.stopped', this.sessionId);
            return;
          }

          const isNetworkError =
            errorMsg.includes('ENOTFOUND') ||
            errorMsg.includes('ETIMEDOUT') ||
            errorMsg.includes('ECONNRESET') ||
            errorMsg.includes('WebSocket') ||
            errorMsg.includes('Connection Lost') ||
            errorMsg.includes('Timed Out') ||
            statusCode === 408 ||
            statusCode === 428 ||
            statusCode === 503 ||
            statusCode === DisconnectReason.connectionLost ||
            statusCode === DisconnectReason.connectionClosed ||
            statusCode === DisconnectReason.timedOut;

          // Status 515 (restartRequired) or transient stream conflicts / network errors
          if (
            statusCode === DisconnectReason.restartRequired ||
            statusCode === 515 ||
            isNetworkError ||
            errorMsg.includes('conflict') ||
            errorMsg.includes('Stream Errored')
          ) {
            console.error(`[Engine Socket] Code ${statusCode} / network drop received for ${this.sessionId} (${errorMsg}). Reconnecting session...`);
            emitEvent('session.reconnecting', this.sessionId);
            setTimeout(() => this.start(), 2000);
            return;
          }

          if (statusCode === DisconnectReason.loggedOut && !errorMsg.includes('conflict') && !isNetworkError) {
            console.error(`[Engine Socket] Device logged out for ${this.sessionId}`);
            emitEvent('session.failed', this.sessionId, {
              error: 'loggedOut',
              statusCode,
            });
            return;
          }

          // Automatic bounded reconnect for transient drops
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 20000);
            console.error(`[Engine Socket] Reconnecting transient disconnect for ${this.sessionId} in ${delay}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            emitEvent('session.reconnecting', this.sessionId);
            setTimeout(() => this.start(), delay);
          } else {
            console.error(`[Engine Socket] Max reconnect attempts reached for ${this.sessionId}`);
            emitEvent('session.disconnected', this.sessionId, {
              statusCode,
              reason: errorMsg,
            });
          }
        }
      });
    } catch (err: any) {
      console.error(`[Engine Socket] Fatal error starting session ${this.sessionId}:`, err);
      emitEvent('session.failed', this.sessionId, {
        error: err?.message || 'Engine socket initialization failed',
      });
    }
  }

  /** Store a LID↔PN mapping in both directions */
  private addLidMapping(lid: string, pn: string): void {
    this.lidToPn.set(lid, pn);
    this.pnToLid.set(pn, lid);
    const pnBare = pn.replace(/@.*$/, '');
    const pnJid = `${pnBare}@s.whatsapp.net`;
    this.pnToLid.set(pnJid, lid);
    this.pnToLid.set(pnBare, lid);
    const lidBare = lid.replace(/@.*$/, '');
    this.lidToPn.set(`${lidBare}@lid`, pnJid);
    this.lidToPn.set(lidBare, pnJid);
  }

  /** Resolve any JID (LID or phone) to a deliverable @s.whatsapp.net JID */
  private async resolveJid(rawJid: string): Promise<string> {
    if (!rawJid || rawJid === '0' || rawJid === 'status@broadcast') return rawJid;
    let target = rawJid.trim();

    if (target.endsWith('@lid')) {
      let mapped = this.lidToPn.get(target);
      if (!mapped) {
        for (const c of this.contactStore.values()) {
          if (c.lid === target && (c.id || (c as any).phoneNumber)) {
            mapped = (c as any).phoneNumber || c.id;
            break;
          }
        }
      }
      if (mapped) {
        return mapped.endsWith('@s.whatsapp.net') ? mapped : `${mapped}@s.whatsapp.net`;
      }
      return target;
    }

    if (target.endsWith('@c.us')) {
      target = `${target.replace(/@c\.us$/, '')}@s.whatsapp.net`;
    } else if (!target.includes('@')) {
      const cleaned = target.replace(/\D/g, '');
      target = `${cleaned}@s.whatsapp.net`;
    }

    return target;
  }

  /**
   * Resolve and verify a phone-number JID.
   * Uses onWhatsApp to verify recipient existence and obtain the exact deliverable JID.
   */
  private async toDeliverableJid(jid: string): Promise<string> {
    const resolved = await this.resolveJid(jid);

    if (resolved.endsWith('@s.whatsapp.net') && this.sock) {
      try {
        const onWhatsAppPromise = this.sock.onWhatsApp(resolved);
        const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000));
        const results = (await Promise.race([onWhatsAppPromise, timeoutPromise])) as any;
        const hit = results?.[0];
        if (hit && hit.exists) {
          console.error(`[Engine Socket] onWhatsApp verified recipient: ${resolved} -> ${hit.jid}`);
          return hit.jid;
        } else if (results !== undefined && (!hit || !hit.exists)) {
          throw new Error(`Phone number ${resolved.replace('@s.whatsapp.net', '')} is not registered on WhatsApp`);
        }
      } catch (e: any) {
        if (e.message?.includes('not registered')) {
          throw e;
        }
        console.error(`[Engine Socket] onWhatsApp check warning: ${e?.message}, sending directly to ${resolved}`);
        return resolved;
      }
    }

    return resolved;
  }

  private cacheMessage(id: string, msg: WAMessage): void {
    this.messageStore.set(id, msg);
    if (this.messageStore.size > 2000) {
      const firstKey = this.messageStore.keys().next().value;
      if (firstKey) {
        this.messageStore.delete(firstKey);
      }
    }
    this.saveMessageStore();
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.sock) {
      throw new Error('Socket not initialized');
    }

    const cleanedNumber = phoneNumber.replace(/[^0-9]/g, '');
    const code = await this.sock.requestPairingCode(cleanedNumber);

    emitEvent('session.pairing_code', this.sessionId, { code });
    return code;
  }

  async sendText(chatId: string, text: string, messageId: string): Promise<void> {
    // If socket exists but connection is transiently reconnecting/connecting, wait up to 10s for open state
    if (this.sock && (this.connectionState as string) !== 'open') {
      console.error(`[Engine Socket] Connection state is '${this.connectionState}' for ${this.sessionId}. Waiting up to 10s for connection to open...`);
      const startTime = Date.now();
      while ((this.connectionState as string) !== 'open' && Date.now() - startTime < 10000) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (!this.sock || this.connectionState !== 'open') {
      const errorMsg = !this.sock
        ? 'Socket not initialized or engine not ready'
        : `WhatsApp connection is not open (current state: ${this.connectionState}). Cannot send message.`;
      console.error(`[Engine Socket] Send text failed for session ${this.sessionId}: ${errorMsg}`);
      emitEvent('message.failed', this.sessionId, {
        messageId,
        error: errorMsg,
      });
      return;
    }

    try {
      let jid = chatId.trim();

      // Resolve to the correct deliverable JID (handles LID migration & onWhatsApp lookup)
      let targetJid = await this.toDeliverableJid(jid);

      // Detect self-messaging (sending message to session's own phone number)
      const selfUser = this.sock.user;
      if (selfUser?.id) {
        const selfNumber = selfUser.id.split(':')[0].split('@')[0];
        const targetNumber = targetJid.split('@')[0];
        if (selfNumber === targetNumber) {
          targetJid = jidNormalizedUser(selfUser.id);
          console.error(`[Engine Socket] Self-messaging detected on session ${this.sessionId}. Target JID normalized to ${targetJid}`);
        }
      }

      let result: WAMessage | null = null;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (!this.sock || (this.connectionState as string) !== 'open') {
            if (attempt < 3) {
              console.error(`[Engine Socket] Send text attempt ${attempt}: connectionState is '${this.connectionState}'. Waiting 2.5s for open state...`);
              await new Promise((resolve) => setTimeout(resolve, 2500));
              if (!this.sock || (this.connectionState as string) !== 'open') continue;
            }
          }

          console.error(`[Engine Socket] Sending text message ${messageId} to ${targetJid} on session ${this.sessionId} (attempt ${attempt})`);
          const sendPromise = this.sock!.sendMessage(targetJid, { text });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('WhatsApp sendMessage timed out after 20 seconds')), 20000)
          );

          result = (await Promise.race([sendPromise, timeoutPromise])) as WAMessage;
          if (result) break;
        } catch (err: any) {
          lastErr = err;
          const isConnClosed = err?.message?.includes('Connection Closed') || err?.output?.statusCode === 428 || err?.message?.includes('conflict');
          if (isConnClosed && attempt < 3) {
            console.error(`[Engine Socket] Send text attempt ${attempt} hit '${err.message}'. Waiting 2.5s for reconnect before retry...`);
            await new Promise((resolve) => setTimeout(resolve, 2500));
            continue;
          }
          throw err;
        }
      }

      if (!result && lastErr) {
        throw lastErr;
      }

      const externalId = result?.key?.id || undefined;

      if (result && result.key?.id) {
        this.cacheMessage(result.key.id, result);
      }

      console.error(`[Engine Socket] Message ${messageId} sent successfully to ${targetJid}, externalId: ${externalId}`);
      emitEvent('message.sent', this.sessionId, {
        messageId,
        externalId,
      });
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to send WhatsApp text message';
      console.error(`[Engine Socket] Error sending message ${messageId} on session ${this.sessionId}:`, err);
      emitEvent('message.failed', this.sessionId, {
        messageId,
        error: errorMsg,
      });
    }
  }

  async getContacts(): Promise<void> {
    const contactsPromises = Array.from(this.contactStore.values())
      .filter((c) => c.id && c.id !== '0' && c.id !== '0@s.whatsapp.net' && c.id !== 'status@broadcast')
      .map(async (c) => {
        let jid = await this.resolveJid(c.id);

        const rawNumber = jid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');
        const name = c.name || c.notify || c.verifiedName || undefined;

        let avatarUrl: string | undefined = (c as any).imgUrl || undefined;
        if (!avatarUrl && this.sock && jid && jid.endsWith('@s.whatsapp.net')) {
          try {
            avatarUrl = await this.sock.profilePictureUrl(jid, 'image');
          } catch (e) {
            // Profile picture may be restricted or unavailable
          }
        }

        return {
          jid,
          name: name || rawNumber,
          phoneNumber: rawNumber !== '0' ? rawNumber : undefined,
          avatarUrl,
          isGroup: jid.endsWith('@g.us'),
        };
      });

    const contacts = await Promise.all(contactsPromises);
    emitEvent('contacts.synced', this.sessionId, { contacts });
  }

  async getChats(): Promise<void> {
    const jidToMessages = new Map<string, WAMessage[]>();
    for (const msg of this.messageStore.values()) {
      const jid = msg.key?.remoteJid;
      if (!jid || jid === '0' || jid === '0@s.whatsapp.net' || jid === 'status@broadcast') continue;
      if (!jidToMessages.has(jid)) {
        jidToMessages.set(jid, []);
      }
      jidToMessages.get(jid)!.push(msg);
    }

    const allJids = Array.from(
      new Set<string>([...this.chatStore.keys(), ...jidToMessages.keys()])
    ).filter((jid: string) => jid && jid !== '0' && jid !== '0@s.whatsapp.net' && jid !== 'status@broadcast');

    const chatsPromises = allJids.map(async (rawJid: string) => {
      let jid: string = await this.resolveJid(rawJid);

      const chatObj = this.chatStore.get(rawJid) || this.chatStore.get(jid);
      const contactObj = this.contactStore.get(rawJid) || this.contactStore.get(jid);
      const msgs = jidToMessages.get(rawJid) || jidToMessages.get(jid) || [];
      msgs.sort((a, b) => Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0));
      const lastMsg = msgs[msgs.length - 1];

      let lastMessageBody = '';
      let lastMessageAt: string | undefined = undefined;

      if (lastMsg) {
        lastMessageBody = lastMsg.message?.conversation || lastMsg.message?.extendedTextMessage?.text || lastMsg.message?.imageMessage?.caption || '';
        if (lastMsg.messageTimestamp) {
          lastMessageAt = new Date(Number(lastMsg.messageTimestamp) * 1000).toISOString();
        }
      }

      const isGroup = jid.endsWith('@g.us');
      const rawNumber = jid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');
      const name = (chatObj as any)?.name || contactObj?.name || contactObj?.notify || contactObj?.verifiedName || (rawNumber !== '0' ? rawNumber : undefined);

      let avatarUrl: string | undefined = (contactObj as any)?.imgUrl || undefined;
      if (!avatarUrl && this.sock && jid) {
        try {
          avatarUrl = await this.sock.profilePictureUrl(jid, 'image');
        } catch (e) {
          try {
            avatarUrl = await this.sock.profilePictureUrl(jid, 'preview');
          } catch (e2) {
            // Unavailable or restricted privacy
          }
        }
      }

      return {
        jid,
        name: name || rawNumber,
        isGroup,
        lastMessageBody,
        lastMessageAt,
        unreadCount: chatObj?.unreadCount || 0,
        avatarUrl,
      };
    });

    const rawChats = await Promise.all(chatsPromises);
    const chatsMap = new Map<string, any>();
    for (const c of rawChats) {
      if (!c.jid) continue;
      const existing = chatsMap.get(c.jid);
      if (!existing) {
        chatsMap.set(c.jid, c);
      } else {
        chatsMap.set(c.jid, {
          ...existing,
          ...c,
          lastMessageBody: c.lastMessageBody || existing.lastMessageBody,
          lastMessageAt: c.lastMessageAt || existing.lastMessageAt,
          unreadCount: Math.max(existing.unreadCount || 0, c.unreadCount || 0),
          avatarUrl: c.avatarUrl || existing.avatarUrl,
        });
      }
    }
    const chats = Array.from(chatsMap.values());
    emitEvent('chats.synced', this.sessionId, { chats });
  }

  async getChatMessages(targetJid: string, limit: number = 50): Promise<void> {
    const resolvedTargetJid = await this.resolveJid(targetJid);
    const filtered = Array.from(this.messageStore.values())
      .filter((m) => {
        const rJid = m.key?.remoteJid;
        return rJid === targetJid || rJid === resolvedTargetJid || (rJid && this.lidToPn.get(rJid) === resolvedTargetJid);
      })
      .sort((a, b) => Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0));

    const sliced = limit <= 0 ? [] : filtered.slice(-limit);

    const messages = sliced.map((m) => {
      const body = m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || '';
      const timestamp = m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000).toISOString() : new Date().toISOString();
      return {
        id: m.key.id || '',
        jid: resolvedTargetJid,
        senderJid: m.key.participant || (m.key.fromMe ? (this.sock?.user?.id ? jidNormalizedUser(this.sock.user.id) : resolvedTargetJid) : resolvedTargetJid),
        body,
        timestamp,
        fromMe: m.key.fromMe || false,
      };
    });

    emitEvent('chat.messages', this.sessionId, { jid: resolvedTargetJid, messages });
  }

  async getProfilePicture(jid: string): Promise<void> {
    if (!this.sock) {
      emitEvent('contact.profile_picture', this.sessionId, { jid, avatarUrl: null });
      return;
    }
    try {
      const resolvedJid = await this.resolveJid(jid);
      let avatarUrl: string | null = null;
      try {
        const res = await this.sock.profilePictureUrl(resolvedJid, 'image');
        avatarUrl = res || null;
      } catch (e) {
        try {
          const resPrev = await this.sock.profilePictureUrl(resolvedJid, 'preview');
          avatarUrl = resPrev || null;
        } catch (e2) {
          avatarUrl = null;
        }
      }
      emitEvent('contact.profile_picture', this.sessionId, { jid, avatarUrl });
    } catch (e) {
      emitEvent('contact.profile_picture', this.sessionId, { jid, avatarUrl: null });
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
    if (!this.sock || this.connectionState !== 'open') {
      const err = `WhatsApp connection is not open (current state: ${this.connectionState})`;
      if (messageId) {
        emitEvent('message.failed', this.sessionId, { messageId, error: err });
      }
      return;
    }

    try {
      let targetJid = await this.toDeliverableJid(chatId);

      let buffer: Buffer;
      if (mediaBufferOrUrl.startsWith('data:')) {
        const base64Data = mediaBufferOrUrl.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else if (fs.existsSync(mediaBufferOrUrl)) {
        buffer = fs.readFileSync(mediaBufferOrUrl);
      } else {
        throw new Error('Invalid media input data');
      }

      let messageContent: any = {};
      if (mediaType === 'image') {
        messageContent = { image: buffer, caption };
      } else if (mediaType === 'audio') {
        messageContent = { audio: buffer, mimetype: mimetype || 'audio/mp4', ptt: true };
      } else if (mediaType === 'video') {
        messageContent = { video: buffer, caption };
      } else if (mediaType === 'document') {
        messageContent = { document: buffer, mimetype: mimetype || 'application/pdf', fileName: fileName || 'file', caption };
      } else if (mediaType === 'sticker') {
        messageContent = { sticker: buffer };
      }

      const sentMsg = await this.sock.sendMessage(targetJid, messageContent);
      if (messageId && sentMsg?.key?.id) {
        emitEvent('message.sent', this.sessionId, {
          messageId,
          externalId: sentMsg.key.id,
        });
      }
    } catch (err: any) {
      console.error(`[Engine Socket] Send media failed for session ${this.sessionId}:`, err);
      if (messageId) {
        emitEvent('message.failed', this.sessionId, {
          messageId,
          error: err?.message || 'Send media failed',
        });
      }
    }
  }

  async validatePhones(phoneNumbers: string[]): Promise<void> {
    if (!this.sock) {
      emitEvent('phones.validated', this.sessionId, { results: [] });
      return;
    }

    const normalizePhone = (p: string): string => {
      let clean = p.replace(/\D/g, '');
      if (!clean) return '';
      if (clean.length === 10 && clean.startsWith('0')) {
        clean = '91' + clean.slice(1);
      } else if (clean.length === 11 && clean.startsWith('0')) {
        clean = '91' + clean.slice(1);
      } else if (clean.length === 10 && /^[6-9]/.test(clean)) {
        clean = '91' + clean;
      }
      return clean;
    };

    const results: Array<{ phone_number: string; phoneNumber: string; jid?: string; exists: boolean }> = [];
    const chunkSize = 50;

    for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
      const chunk = phoneNumbers.slice(i, i + chunkSize);
      try {
        const queryList = chunk.map((p) => {
          const clean = normalizePhone(p);
          return clean ? `${clean}@s.whatsapp.net` : p;
        });

        const checkPromise = this.sock.onWhatsApp(...queryList);
        const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 10000));
        const res = (await Promise.race([checkPromise, timeoutPromise])) as any[];

        for (let j = 0; j < chunk.length; j++) {
          const originalPhone = chunk[j];
          const queryJid = queryList[j];
          const cleanDigits = normalizePhone(originalPhone);

          if (cleanDigits.length === 0) {
            results.push({
              phone_number: originalPhone,
              phoneNumber: originalPhone,
              jid: undefined,
              exists: false,
            });
            continue;
          }

          const hit = res?.find((r: any) => {
            if (!r || !r.jid) return false;
            const rJidDigits = r.jid.replace(/\D/g, '') || 'xyz';
            return (
              r.jid === queryJid ||
              (cleanDigits.length >= 7 && r.jid.includes(cleanDigits)) ||
              (cleanDigits.length >= 10 && cleanDigits.endsWith(rJidDigits))
            );
          });

          if (hit && hit.exists) {
            results.push({
              phone_number: originalPhone,
              phoneNumber: originalPhone,
              jid: hit.jid,
              exists: true,
            });
          } else {
            results.push({
              phone_number: originalPhone,
              phoneNumber: originalPhone,
              exists: false,
            });
          }
        }
      } catch (err: any) {
        console.error(`[Engine Socket] Batch phone validation error for chunk:`, err);
        for (const p of chunk) {
          results.push({ phone_number: p, phoneNumber: p, exists: false });
        }
      }
    }

    emitEvent('phones.validated', this.sessionId, { results });
  }

  async simulatePresence(jid: string, state: string, durationMs?: number): Promise<void> {
    if (!this.sock) {
      emitEvent('presence.simulated', this.sessionId, { jid, state, success: false });
      return;
    }

    try {
      const targetJid = await this.resolveJid(jid);
      const baileysState = state === 'recording' ? 'recording' : (state === 'composing' ? 'composing' : 'paused');

      await this.sock.sendPresenceUpdate(baileysState as any, targetJid);

      if (durationMs && durationMs > 0 && (baileysState === 'composing' || baileysState === 'recording')) {
        await new Promise((resolve) => setTimeout(resolve, durationMs));
        await this.sock.sendPresenceUpdate('paused', targetJid);
      }

      emitEvent('presence.simulated', this.sessionId, {
        jid: targetJid,
        state,
        success: true,
      });
    } catch (err: any) {
      console.error(`[Engine Socket] Presence simulation error for ${jid}:`, err);
      emitEvent('presence.simulated', this.sessionId, {
        jid,
        state,
        success: false,
      });
    }
  }

  async stop(): Promise<void> {
    this.isExplicitStop = true;
    if (this.sock) {
      this.sock.end(undefined);
    } else {
      emitEvent('session.stopped', this.sessionId);
    }
  }
}
