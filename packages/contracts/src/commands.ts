export interface StartCommand {
  cmd: 'engine.start';
  sessionId: string;
  authDir: string;
  v: number;
}

export interface StopCommand {
  cmd: 'engine.stop';
  sessionId: string;
  v: number;
}

export interface RequestPairingCodeCommand {
  cmd: 'engine.request_pairing_code';
  sessionId: string;
  phoneNumber: string;
  v: number;
}

export interface SendTextCommand {
  cmd: 'engine.send_text';
  sessionId: string;
  chatId: string;
  text: string;
  messageId: string;
  v: number;
}

export type EngineCommand =
  | StartCommand
  | StopCommand
  | RequestPairingCodeCommand
  | SendTextCommand;

