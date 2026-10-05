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
import { getAuthState, cleanStaleSessions, purgeSessionForJid } from './auth.js';
import { emitEvent } from './protocol.js';

export class EngineSocket {
  private sock: WASocket | null = null;
  private sessionId: string;
  private authDir: string;
  private isExplicitStop = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private preKeyTimer: NodeJS.Timeout | null = null;
  private saveStoreTimer: NodeJS.Timeout | null = null;
  private messageStore = new Map<string, WAMessage>();
  private contactStore = new Map<string, BaileysContact>();
  private chatStore = new Map<string, BaileysChat>();
  /** Tracks the current WhatsApp connection state */
  private connectionState: 'connecting' | 'open' | 'close' = 'close';
  /** In-memory LID↔PN mapping cache, populated from history sync and lid-mapping.update events */
  private lidToPn = new Map<string, string>();
  private pnToLid = new Map<string, string>();
  private idlePresenceTimer: NodeJS.Timeout | null = null;
  private sendQueue: Promise<any> = Promise.resolve();
  private lastMessageSentAt = 0;

  private enqueueSend<T>(task: () => Promise<T>): Promise<T> {
    const runTask = async () => {
      const now = Date.now();
      const elapsed = now - this.lastMessageSentAt;
      if (this.lastMessageSentAt > 0 && elapsed < 800) {
        const jitter = Math.floor(Math.random() * 400) + (800 - elapsed);
        await new Promise((resolve) => setTimeout(resolve, jitter));
      }
      try {
        return await task();
      } finally {
        this.lastMessageSentAt = Date.now();
      }
    };

    const next = this.sendQueue.then(runTask, runTask);
    this.sendQueue = next.then(
      () => {},
      () => {}
    );
    return next;
  }

  public resetIdlePresence(delayMs = 60000): void {
    if (this.idlePresenceTimer) {
      clearTimeout(this.idlePresenceTimer);
    }
    this.idlePresenceTimer = setTimeout(async () => {
      try {
        if (this.sock && this.connectionState === 'open') {
          console.error(`[Engine Socket] Session ${this.sessionId} transitioned to idle -> 'unavailable'`);
          await this.sock.sendPresenceUpdate('unavailable');
        }
      } catch (e: any) {
        console.error(`[Engine Socket] Idle presence update warning: ${e?.message}`);
      }
    }, delayMs);
  }

  private checkIfSessionClosed(userOrJid: string): boolean {
    try {
      if (!this.authDir || !fs.existsSync(this.authDir)) return false;
      const cleanId = userOrJid.replace(/[^0-9]/g, '');
      if (!cleanId) return false;
      const files = fs.readdirSync(this.authDir);
      for (const file of files) {
        if (file.startsWith(`session-${cleanId}`) && file.endsWith('.json')) {
          const filePath = path.join(this.authDir, file);
          const raw = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(raw);
          const sessions = data?._sessions;
          if (sessions && typeof sessions === 'object') {
            const keys = Object.keys(sessions);
            if (keys.length > 0) {
              const allClosed = keys.every(
                (k) => sessions[k]?.indexInfo?.closed && sessions[k].indexInfo.closed !== -1
              );
              if (allClosed) return true;
            }
          }
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  async setPresence(presence: 'available' | 'unavailable'): Promise<void> {
    if (!this.sock) return;
    try {
      console.error(`[Engine Socket] Setting presence to '${presence}' for ${this.sessionId}`);
      await this.sock.sendPresenceUpdate(presence);
    } catch (e: any) {
      console.error(`[Engine Socket] Failed to set presence: ${e?.message}`);
    }
  }

  async markChatRead(rawJid: string): Promise<void> {
    if (!this.sock) return;
    try {
      const normalized = jidNormalizedUser(rawJid);
      const targetJid = await this.resolveJid(normalized);

      const keysToRead: any[] = [];
      for (const msg of this.messageStore.values()) {
        const msgJid = jidNormalizedUser(msg.key?.remoteJid || '');
        if ((msgJid === normalized || msgJid === targetJid) && !msg.key?.fromMe && msg.key?.id) {
          keysToRead.push({
            remoteJid: msg.key.remoteJid,
            id: msg.key.id,
            participant: msg.key.participant,
          });
        }
      }

      if (keysToRead.length > 0) {
        const recentKeys = keysToRead.slice(-20);
        console.error(`[Engine Socket] Sending read receipts for ${recentKeys.length} messages in chat ${targetJid}`);
        await this.sock.readMessages(recentKeys);
      }

      const chat = this.chatStore.get(rawJid) || this.chatStore.get(targetJid);
      if (chat) {
        chat.unreadCount = 0;
      }

      try {
        if ((this.sock as any).chatModify) {
          await (this.sock as any).chatModify({ markRead: true, lastMessages: keysToRead.slice(-1) }, targetJid);
        }
      } catch (_) {}

      emitEvent('chat.marked_read', this.sessionId, { jid: targetJid });
    } catch (err: any) {
      console.error(`[Engine Socket] Failed to mark chat ${rawJid} read:`, err?.message);
    }
  }

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
      const items = Array.from(this.messageStore.values()).slice(-2000);
      fs.writeFileSync(this.storeFilePath, JSON.stringify(items), 'utf8');
    } catch (e: any) {
      console.error(`[Engine Socket] Failed to save message_store.json for ${this.sessionId}: ${e?.message}`);
    }
  }

  private scheduleSaveMessageStore(): void {
    if (this.saveStoreTimer) return;
    this.saveStoreTimer = setTimeout(() => {
      this.saveStoreTimer = null;
      this.saveMessageStore();
    }, 1500);
  }

  async start(authDir?: string): Promise<void> {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.sock) {
        console.error(`[Engine Socket] Cleaning up existing socket before start for ${this.sessionId}`);
        try {
          this.sock.ev.removeAllListeners('connection.update');
          this.sock.ev.removeAllListeners('creds.update');
          this.sock.ev.removeAllListeners('messages.upsert');
          this.sock.ev.removeAllListeners('messages.update');
          this.sock.ev.removeAllListeners('contacts.upsert');
          this.sock.ev.removeAllListeners('chats.upsert');
          this.sock.ev.removeAllListeners('messaging-history.set');
          this.sock.ev.removeAllListeners('call');
          this.sock.end(undefined);
          this.sock.ws?.close();
        } catch (e: any) {
          console.error(`[Engine Socket] Cleanup warning: ${e?.message}`);
        }
        this.sock = null;
      }

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
        browser: Browsers.windows('Chrome'),
        keepAliveIntervalMs: 25000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        generateHighQualityLinkPreview: true,
        shouldSyncHistoryMessage: (msg: any) => {
          // Allow INITIAL_BOOTSTRAP and RECENT so Baileys can load LID<->PN mappings,
          // recent chats, and contacts without loading gigabytes of years-old messages.
          const syncType = msg?.syncType;
          return syncType !== 2; // 2 is HistorySyncType.FULL
        },
        syncFullHistory: false,
        enableAutoSessionRecreation: true,
        enableRecentMessageCache: true,
        maxMsgRetryCount: 5,
        markOnlineOnConnect: false,
        getMessage: async (key: any) => {
          if (!key.id) return undefined;
          console.error(`[Engine Socket] getMessage called for: id=${key.id}, remoteJid=${key.remoteJid}, fromMe=${key.fromMe}`);

          // Extend presence while handling retries so connection doesn't drop to unavailable mid-handshake
          this.resetIdlePresence(60000);

          // 1. Direct key.id lookup
          let cached: any = this.messageStore.get(key.id);

          // 2. Device prefix stripping (e.g., '3EB0...:1@s.whatsapp.net')
          if (!cached && key.id.includes(':')) {
            const parts = key.id.split(':');
            const bareId = parts[parts.length - 1];
            if (bareId) cached = this.messageStore.get(bareId);
          }

          // 3. Fallback search across cached keys
          if (!cached) {
            for (const [k, v] of this.messageStore.entries()) {
              if (k.endsWith(key.id) || key.id.endsWith(k) || (v?.key?.id && (v.key.id === key.id || key.id.includes(v.key.id)))) {
                cached = v;
                break;
              }
            }
          }

          if (cached?.message) {
            console.error(`[Engine Socket] getMessage resolved payload for ${key.id}`);
            return cached.message;
          }

          if (cached?.body) {
            console.error(`[Engine Socket] getMessage synthesized conversation payload for ${key.id}`);
            return { conversation: cached.body };
          }

          console.warn(`[Engine Socket] getMessage payload not found for key.id=${key.id}`);
          return undefined;
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
            const normalizedRawJid = jidNormalizedUser(rawJid);
            const mappedPn = normalizedRawJid.endsWith('@lid') ? this.lidToPn.get(normalizedRawJid) : undefined;
            const jid = mappedPn ? (mappedPn.endsWith('@s.whatsapp.net') ? mappedPn : `${mappedPn}@s.whatsapp.net`) : normalizedRawJid;
            const senderJid = jidNormalizedUser(msg.key?.participant || jid);
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

      this.sock.ev.on('call', async (callEvents) => {
        for (const call of callEvents) {
          if (call.status === 'offer') {
            console.error(`[Engine Socket] Incoming WhatsApp call detected from ${call.from} (id: ${call.id}). Declining call...`);
            try {
              await this.sock?.rejectCall(call.id, call.from);
              emitEvent('call.rejected', this.sessionId, {
                callId: call.id,
                from: call.from,
                isVideo: call.isVideo || false,
                timestamp: call.date ? call.date.toISOString() : new Date().toISOString(),
              });
            } catch (err: any) {
              console.error(`[Engine Socket] Failed to decline call ${call.id}: ${err?.message}`);
            }
          }
        }
      });

      let contactsSyncTimer: NodeJS.Timeout | null = null;
      let chatsSyncTimer: NodeJS.Timeout | null = null;

      const scheduleEmitContacts = () => {
        if (contactsSyncTimer) clearTimeout(contactsSyncTimer);
        contactsSyncTimer = setTimeout(() => {
          contactsSyncTimer = null;
          this.getContacts().catch((err) => console.error('[Engine Socket] Error emitting contacts:', err));
        }, 1500);
      };

      const scheduleEmitChats = () => {
        if (chatsSyncTimer) clearTimeout(chatsSyncTimer);
        chatsSyncTimer = setTimeout(() => {
          chatsSyncTimer = null;
          this.getChats().catch((err) => console.error('[Engine Socket] Error emitting chats:', err));
        }, 1500);
      };

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
        scheduleEmitContacts();
      };

      const processChats = (chats: Partial<BaileysChat>[]) => {
        for (const chat of chats) {
          if (chat.id) {
            const existing = this.chatStore.get(chat.id) || ({} as BaileysChat);
            this.chatStore.set(chat.id, { ...existing, ...chat } as BaileysChat);
          }
        }
        scheduleEmitChats();
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
        console.error(`[Engine Socket] History sync complete. Emitting contacts and chats for ${this.sessionId}...`);
        this.getContacts().catch((err) => console.error('[Engine Socket] Error emitting contacts on history set:', err));
        this.getChats().catch((err) => console.error('[Engine Socket] Error emitting chats on history set:', err));
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

          // Anti-ban protection: immediately set presence to unavailable so VPS does not stay online 24/7
          try {
            await this.sock?.sendPresenceUpdate('unavailable');
            console.error(`[Engine Socket] Session ${this.sessionId} initial presence set to 'unavailable' (anti-ban protection)`);
          } catch (e: any) {
            console.error(`[Engine Socket] Initial presence update warning: ${e?.message}`);
          }

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

          // Proactively upload pre-keys to avoid 'Waiting for this message' on recipients
          try {
            await this.sock?.uploadPreKeysToServerIfRequired();
            console.error(`[Engine Socket] Pre-keys verified and uploaded if required for ${this.sessionId}`);
          } catch (e: any) {
            console.error(`[Engine Socket] uploadPreKeysToServerIfRequired error: ${e?.message}`);
          }

          if (!this.preKeyTimer) {
            this.preKeyTimer = setInterval(async () => {
              try {
                if (this.sock && this.connectionState === 'open') {
                  await this.sock.uploadPreKeysToServerIfRequired();
                }
                if (this.authDir) {
                  const cleaned = cleanStaleSessions(this.authDir);
                  if (cleaned > 0) {
                    console.error(`[Engine Socket] Self-healed ${cleaned} stale session files for ${this.sessionId}`);
                  }
                }
              } catch (e: any) {
                console.error(`[Engine Socket] Periodic maintenance warning: ${e?.message}`);
              }
            }, 10 * 60 * 1000);
          }

          const user = this.sock?.user;
          const phoneNumber = user?.id ? user.id.split(':')[0].split('@')[0] : undefined;
          const displayName = user?.name || undefined;

          emitEvent('session.ready', this.sessionId, {
            phoneNumber,
            displayName,
          });

          // Proactive app state resync and initial contacts/chats emission
          try {
            if (typeof (this.sock as any)?.resyncAppState === 'function') {
              console.error(`[Engine Socket] Requesting app state resync for ${this.sessionId}...`);
              (this.sock as any).resyncAppState(
                ['critical_block', 'critical_unblock_low', 'regular_high', 'regular_low', 'regular'],
                false
              ).catch((e: any) => console.error(`[Engine Socket] resyncAppState warning: ${e?.message}`));
            }
          } catch (e: any) {
            console.error(`[Engine Socket] resyncAppState setup warning: ${e?.message}`);
          }

          // Emit contacts and chats 2 seconds after connect so UI is immediately refreshed
          setTimeout(() => {
            this.getContacts().catch((err) => console.error('[Engine Socket] Initial contacts sync error:', err));
            this.getChats().catch((err) => console.error('[Engine Socket] Initial chats sync error:', err));
          }, 2000);
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
            this.scheduleReconnect(2000);
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
            this.scheduleReconnect(delay);
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

  private scheduleReconnect(delay: number = 2000): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start().catch((err) => console.error(`[Engine Socket] Reconnect start error:`, err));
    }, delay);
  }

  /** Store a LID↔PN mapping in both directions */
  private addLidMapping(lid: string, pn: string): void {
    if (!lid || !pn) return;
    const pnClean = pn.replace(/@.*$/, '').replace(/:.*$/, '');
    if (!pnClean) return;
    const pnJid = `${pnClean}@s.whatsapp.net`;
    const lidClean = lid.replace(/@.*$/, '').replace(/:.*$/, '');
    const lidJid = `${lidClean}@lid`;

    this.lidToPn.set(lid, pnJid);
    this.lidToPn.set(lidJid, pnJid);
    this.lidToPn.set(lidClean, pnJid);

    this.pnToLid.set(pn, lidJid);
    this.pnToLid.set(pnJid, lidJid);
    this.pnToLid.set(pnClean, lidJid);
  }

  /** Resolve any JID (LID or phone) to a deliverable @s.whatsapp.net JID */
  private async resolveJid(rawJid: string): Promise<string> {
    if (!rawJid || rawJid === '0' || rawJid === 'status@broadcast') return rawJid;
    let target = rawJid.trim();

    if (target.endsWith('@lid')) {
      const bareLid = target.replace(/@.*$/, '').replace(/:.*$/, '');
      let mapped = this.lidToPn.get(target) || this.lidToPn.get(bareLid);

      // Check reverse mapping files on disk
      if (!mapped && this.authDir) {
        try {
          const rf = path.join(this.authDir, `lid-mapping-${bareLid}_reverse.json`);
          if (fs.existsSync(rf)) {
            const raw = JSON.parse(fs.readFileSync(rf, 'utf8'));
            if (raw && typeof raw === 'string') {
              const cleanPn = raw.replace(/@.*$/, '').replace(/:.*$/, '');
              if (cleanPn) {
                mapped = `${cleanPn}@s.whatsapp.net`;
                this.addLidMapping(target, mapped);
              }
            }
          }
        } catch {}
      }

      // Check Baileys Signal lidMapping
      if (!mapped && (this.sock as any)?.signalRepository?.lidMapping) {
        try {
          const pn = await (this.sock as any).signalRepository.lidMapping.getPNForLID(target);
          if (pn) {
            const cleanPn = pn.replace(/@.*$/, '').replace(/:.*$/, '');
            const mappedPn: string = `${cleanPn}@s.whatsapp.net`;
            mapped = mappedPn;
            this.addLidMapping(target, mappedPn);
          }
        } catch {}
      }

      // Check contact store
      if (!mapped) {
        for (const c of this.contactStore.values()) {
          const cLidBare = c.lid ? c.lid.replace(/@.*$/, '').replace(/:.*$/, '') : '';
          if (cLidBare === bareLid && (c.id || (c as any).phoneNumber)) {
            const phone = (c as any).phoneNumber || c.id;
            const cleanPn = phone.replace(/@.*$/, '').replace(/:.*$/, '');
            mapped = `${cleanPn}@s.whatsapp.net`;
            this.addLidMapping(target, mapped);
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

    // Strip any device suffix e.g. 919477762699:0@s.whatsapp.net -> 919477762699@s.whatsapp.net
    if (target.includes(':') && target.endsWith('@s.whatsapp.net')) {
      target = `${target.replace(/:.*@/, '@')}`;
    }

    if ((this.sock as any)?.signalRepository?.lidMapping && target.endsWith('@s.whatsapp.net')) {
      try {
        const barePn = target.replace(/@.*$/, '');
        const lid = await (this.sock as any).signalRepository.lidMapping.getLIDForPN(barePn);
        if (lid) {
          this.addLidMapping(lid, target);
        }
      } catch {}
    }

    return target;
  }

  /**
   * Resolve and verify a phone-number JID.
   * Uses onWhatsApp to verify recipient existence and obtain the exact deliverable JID.
   */
  private async toDeliverableJid(jid: string): Promise<string> {
    const resolved = await this.resolveJid(jid);

    // If already a valid deliverable WhatsApp JID, return immediately without network overhead
    if (
      resolved.endsWith('@s.whatsapp.net') ||
      resolved.endsWith('@g.us') ||
      resolved.endsWith('@broadcast') ||
      resolved.endsWith('@lid')
    ) {
      return resolved;
    }

    if (this.sock) {
      try {
        const cleaned = resolved.replace(/\D/g, '');
        const queryJid = `${cleaned}@s.whatsapp.net`;
        const onWhatsAppPromise = this.sock.onWhatsApp(queryJid);
        const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000));
        const results = (await Promise.race([onWhatsAppPromise, timeoutPromise])) as any;
        const hit = results?.[0];
        if (hit && hit.exists) {
          console.error(`[Engine Socket] onWhatsApp verified recipient: ${queryJid} -> ${hit.jid}`);
          return hit.jid;
        } else if (results !== undefined && (!hit || !hit.exists)) {
          throw new Error(`Phone number ${cleaned} is not registered on WhatsApp`);
        }
        return queryJid;
      } catch (e: any) {
        if (e.message?.includes('not registered')) {
          throw e;
        }
        console.error(`[Engine Socket] onWhatsApp check warning: ${e?.message}, sending directly to ${resolved}`);
        const cleaned = resolved.replace(/\D/g, '');
        return `${cleaned}@s.whatsapp.net`;
      }
    }

    return resolved;
  }

  private cacheMessage(id: string, msg: WAMessage): void {
    if (!id || !msg) return;
    this.messageStore.set(id, msg);
    if (msg.key?.id && msg.key.id !== id) {
      this.messageStore.set(msg.key.id, msg);
    }
    if (this.messageStore.size > 3000) {
      const firstKey = this.messageStore.keys().next().value;
      if (firstKey) {
        this.messageStore.delete(firstKey);
      }
    }
    this.scheduleSaveMessageStore();
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
    return this.enqueueSend(async () => {
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

    let targetJid: string | null = null;
    try {
      let jid = chatId.trim();

      // Resolve to the correct deliverable JID (handles LID migration & onWhatsApp lookup)
      targetJid = await this.toDeliverableJid(jid);

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

      // Automatic Session Self-Healing:
      // Verify if recipient has a closed/broken Signal session in the auth directory.
      // If closed, purge the stale session file and force a fresh pre-key fetch.
      if (this.authDir) {
        const recipientUser = targetJid.split('@')[0];
        const isClosed = this.checkIfSessionClosed(recipientUser);
        if (isClosed) {
          console.error(`[Engine Socket] Stale/closed session detected for ${recipientUser}. Purging and fetching fresh pre-keys...`);
          purgeSessionForJid(this.authDir, recipientUser);
          try {
            if ((this.sock as any)?.assertSessions) {
              await (this.sock as any).assertSessions([targetJid], true);
            }
          } catch (e: any) {
            console.error(`[Engine Socket] assertSessions warning during self-heal: ${e?.message}`);
          }
        }
      }

      // Pre-warm the session ratchet with WhatsApp servers & simulate natural human typing
      try {
        if (this.sock) {
          if ((this.sock as any)?.assertSessions) {
            await (this.sock as any).assertSessions([targetJid]);
          }
          await this.sock.presenceSubscribe(targetJid);
          await this.sock.sendPresenceUpdate('composing', targetJid);
          const charSpeed = Math.floor(Math.random() * 15) + 20; // 20-35ms per character
          const typingMs = Math.min(Math.max((text?.length || 10) * charSpeed, 800), 4500);

          if (text && text.length > 70) {
            const firstSegment = Math.floor(typingMs * 0.55);
            const secondSegment = typingMs - firstSegment;
            await new Promise((resolve) => setTimeout(resolve, firstSegment));
            await this.sock.sendPresenceUpdate('paused', targetJid);
            const pauseMs = Math.floor(Math.random() * 400) + 400; // 400-800ms natural thought pause
            await new Promise((resolve) => setTimeout(resolve, pauseMs));
            await this.sock.sendPresenceUpdate('composing', targetJid);
            await new Promise((resolve) => setTimeout(resolve, secondSegment));
          } else {
            await new Promise((resolve) => setTimeout(resolve, typingMs));
          }
        }
      } catch (e: any) {
        console.error(`[Engine Socket] Presence/session pre-warm warning for ${targetJid}: ${e?.message}`);
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
          const isRetryable =
            err?.message?.includes('Connection Closed') ||
            err?.output?.statusCode === 428 ||
            err?.message?.includes('conflict') ||
            err?.message?.includes('timed out') ||
            err?.message?.includes('Connection Lost') ||
            err?.message?.includes('408');
          if (isRetryable && attempt < 3) {
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

      if (result) {
        if (!result.message) {
          result.message = { conversation: text };
        }
        (result as any).body = text;
        if (result.key?.id) {
          this.cacheMessage(result.key.id, result);
        }
        if (messageId) {
          this.cacheMessage(messageId, result);
        }
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
    } finally {
      try {
        if (this.sock && targetJid) {
          await this.sock.sendPresenceUpdate('paused', targetJid);
        }
      } catch (_) {}
      this.resetIdlePresence();
    }
    });
  }

  async getContacts(): Promise<void> {
    const contactsPromises = Array.from(this.contactStore.values())
      .filter((c) => c.id && c.id !== '0' && c.id !== '0@s.whatsapp.net' && c.id !== 'status@broadcast')
      .map(async (c) => {
        let jid = await this.resolveJid(c.id);

        const rawNumber = jid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');
        const name = c.name || c.notify || c.verifiedName || undefined;
        const avatarUrl: string | undefined = (c as any).imgUrl || undefined;

        return {
          jid,
          name: name || rawNumber,
          phoneNumber: rawNumber !== '0' ? rawNumber : undefined,
          avatarUrl,
          isGroup: jid.endsWith('@g.us'),
        };
      });

    const rawContacts = await Promise.all(contactsPromises);
    const contactsMap = new Map<string, any>();
    for (const c of rawContacts) {
      if (!c.jid) continue;
      const existing = contactsMap.get(c.jid);
      if (!existing) {
        contactsMap.set(c.jid, c);
      } else {
        const hasBetterName = c.name && c.name !== c.phoneNumber && (!existing.name || existing.name === existing.phoneNumber);
        contactsMap.set(c.jid, {
          ...existing,
          ...c,
          name: hasBetterName ? c.name : existing.name,
          phoneNumber: c.phoneNumber || existing.phoneNumber,
          avatarUrl: c.avatarUrl || existing.avatarUrl,
        });
      }
    }
    const contacts = Array.from(contactsMap.values());
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
      new Set<string>([...this.chatStore.keys(), ...jidToMessages.keys()].map((j) => jidNormalizedUser(j)))
    ).filter((jid: string) => jid && jid !== '0' && jid !== '0@s.whatsapp.net' && jid !== 'status@broadcast');

    const chatsPromises = allJids.map(async (rawJid: string) => {
      let jid: string = jidNormalizedUser(await this.resolveJid(rawJid));

      const chatObj = this.chatStore.get(rawJid) || this.chatStore.get(jid);
      let contactObj = this.contactStore.get(rawJid) || this.contactStore.get(jid);
      if (!contactObj) {
        for (const c of this.contactStore.values()) {
          if (
            (c.lid && (c.lid === rawJid || c.lid === jid)) ||
            (c.id && (c.id === rawJid || c.id === jid)) ||
            ((c as any).phoneNumber && (jid.includes((c as any).phoneNumber) || rawJid.includes((c as any).phoneNumber)))
          ) {
            contactObj = c;
            break;
          }
        }
      }

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
      let name = (chatObj as any)?.name || contactObj?.name || contactObj?.notify || contactObj?.verifiedName;
      if (!name || name === rawNumber || name.includes('@')) {
        for (const c of this.contactStore.values()) {
          const cName = c.name || c.notify || c.verifiedName;
          if (cName && (c.id === jid || c.lid === jid || ((c as any).phoneNumber && rawNumber.includes((c as any).phoneNumber)))) {
            name = cName;
            break;
          }
        }
      }
      const avatarUrl: string | undefined = (contactObj as any)?.imgUrl || undefined;

      return {
        jid,
        name: name || (rawNumber !== '0' ? rawNumber : undefined),
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
          name: (c.name && !c.name.includes('@')) ? c.name : existing.name,
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
    const normalizedTarget = jidNormalizedUser(targetJid);
    const resolvedTargetJid = jidNormalizedUser(await this.resolveJid(normalizedTarget));
    const filtered = Array.from(this.messageStore.values())
      .filter((m) => {
        const rJid = jidNormalizedUser(m.key?.remoteJid || '');
        return rJid === normalizedTarget || rJid === resolvedTargetJid || (rJid && this.lidToPn.get(rJid) === resolvedTargetJid);
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
    return this.enqueueSend(async () => {
      if (!this.sock || this.connectionState !== 'open') {
      const err = `WhatsApp connection is not open (current state: ${this.connectionState})`;
      if (messageId) {
        emitEvent('message.failed', this.sessionId, { messageId, error: err });
      }
      return;
    }

    let targetJid: string | null = null;
    try {
      targetJid = await this.toDeliverableJid(chatId);

      // Automatic Session Self-Healing:
      if (this.authDir) {
        const recipientUser = targetJid.split('@')[0];
        const isClosed = this.checkIfSessionClosed(recipientUser);
        if (isClosed) {
          console.error(`[Engine Socket] Stale/closed session detected for ${recipientUser}. Purging and fetching fresh pre-keys...`);
          purgeSessionForJid(this.authDir, recipientUser);
          try {
            if ((this.sock as any)?.assertSessions) {
              await (this.sock as any).assertSessions([targetJid], true);
            }
          } catch (e: any) {
            console.error(`[Engine Socket] assertSessions warning during self-heal: ${e?.message}`);
          }
        }
      }

      let buffer: Buffer;
      if (mediaBufferOrUrl.startsWith('data:')) {
        const base64Data = mediaBufferOrUrl.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else if (fs.existsSync(mediaBufferOrUrl)) {
        buffer = fs.readFileSync(mediaBufferOrUrl);
      } else {
        throw new Error('Invalid media input data');
      }

      // Media Hash Randomization (Anti-Detection):
      // Append subtle random trailing bytes to generate a unique SHA-256 hash
      // preventing WhatsApp from grouping bulk media distributions into spam fingerprints.
      if (buffer.length > 32 && (mediaType === 'image' || mediaType === 'document')) {
        const randomSalt = Buffer.from(`\n%_salt_${Math.random().toString(36).substring(2, 10)}`);
        buffer = Buffer.concat([buffer, randomSalt]);
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

      // Pre-warm the session ratchet & simulate human media preparation (recording for audio, composing for files)
      try {
        if (this.sock) {
          if ((this.sock as any)?.assertSessions) {
            await (this.sock as any).assertSessions([targetJid]);
          }
          await this.sock.presenceSubscribe(targetJid);
          const presenceState = mediaType === 'audio' ? 'recording' : 'composing';
          await this.sock.sendPresenceUpdate(presenceState, targetJid);
          const mediaWaitMs = Math.floor(Math.random() * 1000) + 1200; // 1.2s - 2.2s natural preparation
          await new Promise((resolve) => setTimeout(resolve, mediaWaitMs));
        }
      } catch (e: any) {
        console.error(`[Engine Socket] Presence/session pre-warm warning for ${targetJid}: ${e?.message}`);
      }

      const sentMsg = await this.sock.sendMessage(targetJid, messageContent);
      if (sentMsg) {
        if (!sentMsg.message) {
          sentMsg.message = messageContent;
        }
        (sentMsg as any).body = caption || fileName || '';
        if (sentMsg.key?.id) {
          this.cacheMessage(sentMsg.key.id, sentMsg);
        }
        if (messageId) {
          this.cacheMessage(messageId, sentMsg);
        }
      }

      try {
        if (this.sock && targetJid) {
          await this.sock.sendPresenceUpdate('paused', targetJid);
        }
      } catch (_) {}
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
    } finally {
      try {
        if (this.sock && targetJid) {
          await this.sock.sendPresenceUpdate('paused', targetJid);
        }
      } catch (_) {}
      this.resetIdlePresence();
    }
    });
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

      if (i + chunkSize < phoneNumbers.length) {
        const jitter = Math.floor(Math.random() * 1000) + 1500;
        await new Promise((resolve) => setTimeout(resolve, jitter));
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

      this.resetIdlePresence();

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
    if (this.idlePresenceTimer) {
      clearTimeout(this.idlePresenceTimer);
      this.idlePresenceTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.preKeyTimer) {
      clearInterval(this.preKeyTimer);
      this.preKeyTimer = null;
    }
    if (this.saveStoreTimer) {
      clearTimeout(this.saveStoreTimer);
      this.saveStoreTimer = null;
    }
    this.saveMessageStore();
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ev.removeAllListeners('messages.upsert');
        this.sock.ev.removeAllListeners('messages.update');
        this.sock.ev.removeAllListeners('contacts.upsert');
        this.sock.ev.removeAllListeners('chats.upsert');
        this.sock.ev.removeAllListeners('messaging-history.set');
        this.sock.ev.removeAllListeners('call');
        this.sock.end(undefined);
        this.sock.ws?.close();
      } catch (e: any) {
        console.error(`[Engine Socket] Error ending socket: ${e?.message}`);
      }
      this.sock = null;
    }
    emitEvent('session.stopped', this.sessionId);
  }
}
