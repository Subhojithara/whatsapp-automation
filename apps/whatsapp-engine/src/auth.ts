import { useMultiFileAuthState, AuthenticationState, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';

export function cleanStaleSessions(authDir: string): number {
  let cleanedCount = 0;
  try {
    if (!fs.existsSync(authDir)) return 0;
    const files = fs.readdirSync(authDir);
    for (const file of files) {
      if (!file.startsWith('session-') || !file.endsWith('.json')) continue;
      const filePath = path.join(authDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        const sessions = data?._sessions;
        if (sessions && typeof sessions === 'object') {
          const keys = Object.keys(sessions);
          if (keys.length > 0) {
            const allClosed = keys.every(
              (k) => sessions[k]?.indexInfo?.closed && sessions[k].indexInfo.closed !== -1
            );
            if (allClosed) {
              fs.unlinkSync(filePath);
              cleanedCount++;
              console.error(`[Auth] Purged stale closed session file: ${file}`);
            }
          }
        }
      } catch (err: any) {
        try {
          fs.unlinkSync(filePath);
          cleanedCount++;
          console.error(`[Auth] Purged corrupted session file: ${file} (${err.message})`);
        } catch {}
      }
    }
  } catch (err: any) {
    console.error(`[Auth] Error while cleaning stale sessions: ${err.message}`);
  }
  return cleanedCount;
}

export function purgeSessionForJid(authDir: string, jidOrUser: string): boolean {
  try {
    if (!fs.existsSync(authDir)) return false;
    const cleanId = jidOrUser.replace(/[^0-9]/g, '');
    if (!cleanId) return false;
    const files = fs.readdirSync(authDir);
    let purged = false;
    for (const file of files) {
      if (file.startsWith(`session-${cleanId}`) && file.endsWith('.json')) {
        const filePath = path.join(authDir, file);
        fs.unlinkSync(filePath);
        console.error(`[Auth] Purged session file on demand for ${cleanId}: ${file}`);
        purged = true;
      }
    }
    return purged;
  } catch (err: any) {
    console.error(`[Auth] Failed to purge session for ${jidOrUser}: ${err.message}`);
    return false;
  }
}

export async function getAuthState(authDir: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const resolvedPath = path.resolve(authDir);
  if (!fs.existsSync(resolvedPath)) {
    fs.mkdirSync(resolvedPath, { recursive: true });
  }

  // Self-heal: purge any closed/stale session files on startup
  const cleaned = cleanStaleSessions(resolvedPath);
  if (cleaned > 0) {
    console.error(`[Auth] Cleaned ${cleaned} stale/closed Signal session records during auth initialization.`);
  }

  const { state, saveCreds } = await useMultiFileAuthState(resolvedPath);
  const logger = pino({ level: 'silent' });
  state.keys = makeCacheableSignalKeyStore(state.keys, logger as any);

  return { state, saveCreds };
}

