import * as readline from 'readline';
import { IncomingCommand, emitEvent } from './protocol.js';
import { WebJsEngineSocket } from './wwebjs-socket.js';
import { EngineSocket } from './socket.js';

const engineType = process.env.ENGINE_TYPE || 'baileys';
console.error(`[Engine Process] Started stdio listener (${engineType} engine).`);

let activeSocket: any = null;
let currentSessionId = '';

process.on('uncaughtException', (err) => {
  console.error('[Engine Process UncaughtException]', err);
  if (currentSessionId) {
    emitEvent('session.failed', currentSessionId, { error: err.message || 'Uncaught Exception' });
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[Engine Process UnhandledRejection]', reason);
});

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

async function processCommand(line: string): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const cmd: IncomingCommand = JSON.parse(trimmed);
    console.error(`[Engine Process] Executing command: ${cmd.cmd} for session: ${cmd.sessionId}`);
    currentSessionId = cmd.sessionId;

    switch (cmd.cmd) {
      case 'engine.start': {
        if (activeSocket) {
          await activeSocket.stop();
        }
        if (engineType === 'wwebjs') {
          console.error(`[Engine Process] Starting WebJsEngineSocket (Puppeteer) for ${cmd.sessionId}`);
          activeSocket = new WebJsEngineSocket(cmd.sessionId);
        } else {
          console.error(`[Engine Process] Starting EngineSocket (Baileys) for ${cmd.sessionId}`);
          activeSocket = new EngineSocket(cmd.sessionId, cmd.authDir);
        }
        await activeSocket.start(cmd.authDir);
        break;
      }

      case 'engine.stop': {
        if (activeSocket) {
          await activeSocket.stop();
          activeSocket = null;
        } else {
          emitEvent('session.stopped', cmd.sessionId);
        }
        break;
      }

      case 'engine.request_pairing_code': {
        if (activeSocket) {
          await activeSocket.requestPairingCode(cmd.phoneNumber);
        } else {
          emitEvent('session.failed', cmd.sessionId, {
            error: 'Session socket not initialized',
          });
        }
        break;
      }

      case 'engine.send_text': {
        if (activeSocket) {
          await activeSocket.sendText(cmd.chatId, cmd.text, cmd.messageId);
        } else {
          emitEvent('message.failed', cmd.sessionId, {
            messageId: cmd.messageId,
            error: 'Session socket not initialized',
          });
        }
        break;
      }

      case 'engine.send_media': {
        if (activeSocket) {
          await activeSocket.sendMedia(
            cmd.chatId,
            cmd.mediaType,
            cmd.mediaUrl,
            cmd.caption,
            cmd.fileName,
            cmd.mimetype,
            cmd.messageId
          );
        } else {
          emitEvent('message.failed', cmd.sessionId, {
            messageId: cmd.messageId,
            error: 'Session socket not initialized',
          });
        }
        break;
      }

      case 'engine.get_contacts': {
        if (activeSocket) {
          await activeSocket.getContacts();
        } else {
          emitEvent('session.failed', cmd.sessionId, { error: 'Session socket not initialized' });
        }
        break;
      }

      case 'engine.get_chats': {
        if (activeSocket) {
          await activeSocket.getChats();
        } else {
          emitEvent('session.failed', cmd.sessionId, { error: 'Session socket not initialized' });
        }
        break;
      }

      case 'engine.get_chat_messages': {
        if (activeSocket) {
          await activeSocket.getChatMessages(cmd.jid, cmd.limit ?? 50);
        } else {
          emitEvent('session.failed', cmd.sessionId, { error: 'Session socket not initialized' });
        }
        break;
      }

      case 'engine.get_profile_picture': {
        if (activeSocket) {
          await activeSocket.getProfilePicture(cmd.jid);
        } else {
          emitEvent('contact.profile_picture', cmd.sessionId, { jid: cmd.jid, avatarUrl: null });
        }
        break;
      }

      case 'engine.validate_phones': {
        if (activeSocket) {
          const phoneNumbers = (cmd as any).phoneNumbers || (cmd as any).phone_numbers || [];
          await activeSocket.validatePhones(phoneNumbers);
        } else {
          emitEvent('phones.validated', cmd.sessionId, { results: [] });
        }
        break;
      }

      case 'engine.simulate_presence': {
        if (activeSocket) {
          const durationMs = (cmd as any).durationMs ?? (cmd as any).duration_ms;
          await activeSocket.simulatePresence(cmd.jid, cmd.state, durationMs);
        } else {
          emitEvent('presence.simulated', cmd.sessionId, {
            jid: cmd.jid,
            state: cmd.state,
            success: false,
          });
        }
        break;
      }

      default:
        console.error(`[Engine Process] Unknown command: ${(cmd as any).cmd}`);
    }
  } catch (err: any) {
    console.error(`[Engine Process] Command execution error:`, err);
    if (currentSessionId) {
      emitEvent('session.failed', currentSessionId, {
        error: err?.message || 'Engine command execution failed',
      });
    }
  }
}

rl.on('line', (line) => {
  processCommand(line).catch((err) => {
    console.error('[Engine Process] Unhandled command processing error:', err);
  });
});
