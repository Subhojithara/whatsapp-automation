export interface Contact {
  id: string;
  jid: string;
  name?: string | null;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  isGroup: boolean;
  sessionId: string;
  syncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  jid: string;
  name?: string | null;
  isGroup: boolean;
  lastMessageBody?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  avatarUrl?: string | null;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  externalId?: string | null;
  sessionId: string;
  chatId: string;
  direction: 'INCOMING' | 'OUTGOING' | 'incoming' | 'outgoing' | string;
  messageType?: string;
  typeName?: string;
  body?: string | null;
  text?: string | null;
  mediaUrl?: string | null;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | string;
  error?: string | null;
  createdAt: string;
  sentAt?: string | null;
  updatedAt?: string;
  senderJid?: string | null;
  fromMe: boolean;
}

export interface SendTextMessagePayload {
  to: string;
  text: string;
}
