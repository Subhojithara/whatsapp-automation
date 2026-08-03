export interface BaseEngineEvent {
  event: string;
  sessionId: string;
  timestamp: string;
  v: number;
}

export interface ConnectingEvent extends BaseEngineEvent {
  event: 'session.connecting';
}

export interface QrEvent extends BaseEngineEvent {
  event: 'session.qr';
  data: {
    qr: string;
  };
}

export interface PairingCodeEvent extends BaseEngineEvent {
  event: 'session.pairing_code';
  data: {
    code: string;
  };
}

export interface AuthenticatingEvent extends BaseEngineEvent {
  event: 'session.authenticating';
}

export interface ReconnectingEvent extends BaseEngineEvent {
  event: 'session.reconnecting';
}

export interface ReadyEvent extends BaseEngineEvent {
  event: 'session.ready';
  data: {
    phoneNumber?: string;
    displayName?: string;
  };
}

export interface DisconnectedEvent extends BaseEngineEvent {
  event: 'session.disconnected';
  data: {
    statusCode?: number;
    reason?: string;
  };
}

export interface FailedEvent extends BaseEngineEvent {
  event: 'session.failed';
  data: {
    error: string;
    statusCode?: number;
  };
}

export interface StoppedEvent extends BaseEngineEvent {
  event: 'session.stopped';
}

export interface MessageSentEvent extends BaseEngineEvent {
  event: 'message.sent';
  data: {
    messageId: string;
    externalId?: string;
  };
}

export interface MessageFailedEvent extends BaseEngineEvent {
  event: 'message.failed';
  data: {
    messageId: string;
    error: string;
  };
}

export type EngineEvent =
  | ConnectingEvent
  | QrEvent
  | PairingCodeEvent
  | AuthenticatingEvent
  | ReconnectingEvent
  | ReadyEvent
  | DisconnectedEvent
  | FailedEvent
  | StoppedEvent
  | MessageSentEvent
  | MessageFailedEvent;

