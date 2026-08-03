export interface MessageResponse {
  id: string;
  externalId?: string | null;
  sessionId: string;
  to: string;
  typeName: string;
  text?: string | null;
  status: string;
  createdAt: string;
  sentAt?: string | null;
  error?: string | null;
}

export interface SendTextRequest {
  to: string;
  text: string;
}
