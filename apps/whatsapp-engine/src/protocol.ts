export interface BaseCommand {
  cmd: string;
  sessionId: string;
  v: number;
}

export interface StartCommand extends BaseCommand {
  cmd: 'engine.start';
  authDir: string;
}

export interface StopCommand extends BaseCommand {
  cmd: 'engine.stop';
}

export interface RequestPairingCodeCommand extends BaseCommand {
  cmd: 'engine.request_pairing_code';
  phoneNumber: string;
}

export interface SendTextCommand extends BaseCommand {
  cmd: 'engine.send_text';
  chatId: string;
  text: string;
  messageId: string;
}

export interface GetProfilePictureCommand extends BaseCommand {
  cmd: 'engine.get_profile_picture';
  jid: string;
}

export interface SendMediaCommand extends BaseCommand {
  cmd: 'engine.send_media';
  chatId: string;
  mediaType: 'image' | 'audio' | 'video' | 'document' | 'sticker';
  mediaUrl: string;
  caption?: string;
  fileName?: string;
  mimetype?: string;
  messageId: string;
}

export interface ValidatePhonesCommand extends BaseCommand {
  cmd: 'engine.validate_phones';
  phoneNumbers?: string[];
  phone_numbers?: string[];
}

export interface SimulatePresenceCommand extends BaseCommand {
  cmd: 'engine.simulate_presence';
  jid: string;
  state: 'composing' | 'paused' | string;
  durationMs?: number;
  duration_ms?: number;
}

export type IncomingCommand =
  | StartCommand
  | StopCommand
  | RequestPairingCodeCommand
  | SendTextCommand
  | SendMediaCommand
  | GetContactsCommand
  | GetChatsCommand
  | GetChatMessagesCommand
  | GetProfilePictureCommand
  | ValidatePhonesCommand
  | SimulatePresenceCommand;

export interface GetContactsCommand extends BaseCommand {
  cmd: 'engine.get_contacts';
}

export interface GetChatsCommand extends BaseCommand {
  cmd: 'engine.get_chats';
}

export interface GetChatMessagesCommand extends BaseCommand {
  cmd: 'engine.get_chat_messages';
  jid: string;
  limit?: number;
}


export function emitEvent(event: string, sessionId: string, data?: Record<string, any>): void {
  const payload = {
    event,
    sessionId,
    timestamp: new Date().toISOString(),
    ...(data ? { data } : {}),
    v: 1,
  };
  process.stdout.write(JSON.stringify(payload) + '\n');
}
