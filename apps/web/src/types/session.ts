export type SessionStatus =
  | 'CREATED'
  | 'STARTING'
  | 'CONNECTING'
  | 'QR_READY'
  | 'AUTHENTICATING'
  | 'READY'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'STOPPING'
  | 'STOPPED'
  | 'FAILED'
  | 'DELETED';

export interface Session {
  id: string;
  name: string;
  engine: string;
  status: SessionStatus;
  phoneNumber?: string | null;
  displayName?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string | null;
  lastDisconnectedAt?: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
