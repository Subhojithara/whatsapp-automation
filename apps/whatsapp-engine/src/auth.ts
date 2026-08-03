import { useMultiFileAuthState, AuthenticationState, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';

export async function getAuthState(authDir: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const resolvedPath = path.resolve(authDir);
  if (!fs.existsSync(resolvedPath)) {
    fs.mkdirSync(resolvedPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(resolvedPath);
  const logger = pino({ level: 'silent' });
  state.keys = makeCacheableSignalKeyStore(state.keys, logger as any);

  return { state, saveCreds };
}

