import { ApiResponse, Session } from '@/types/session';
import { MessageResponse, SendTextRequest } from '@/types/message';
import { Contact, Chat, Message } from '@/types/chat';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();
  let envelope: ApiResponse<T> | null = null;
  try {
    envelope = text ? JSON.parse(text) : null;
  } catch {
    // text was non-JSON
  }

  if (!res.ok || !envelope?.success) {
    const errorMsg =
      envelope?.error?.message ||
      (text && text.length < 200 ? text : `HTTP ${res.status} ${res.statusText}`);
    throw new Error(errorMsg);
  }

  return envelope.data as T;
}

export const apiClient = {
  getSessions: () => fetchJson<Session[]>(`${API_BASE}/sessions`),
  getSession: (id: string) => fetchJson<Session>(`${API_BASE}/sessions/${id}`),
  createSession: (name: string, engine = 'baileys') =>
    fetchJson<Session>(`${API_BASE}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ name, engine }),
    }),
  deleteSession: (id: string) =>
    fetchJson<{ id: string }>(`${API_BASE}/sessions/${id}`, { method: 'DELETE' }),
  startSession: (id: string) =>
    fetchJson<Session>(`${API_BASE}/sessions/${id}/start`, { method: 'POST' }),
  stopSession: (id: string) =>
    fetchJson<Session>(`${API_BASE}/sessions/${id}/stop`, { method: 'POST' }),
  restartSession: (id: string) =>
    fetchJson<Session>(`${API_BASE}/sessions/${id}/restart`, { method: 'POST' }),
  getQr: (id: string) =>
    fetchJson<{ sessionId: string; qr?: string }>(`${API_BASE}/sessions/${id}/qr`),
  requestPairingCode: (id: string, phoneNumber: string) =>
    fetchJson<{ sessionId: string; phoneNumber: string; code?: string }>(
      `${API_BASE}/sessions/${id}/pairing-code`,
      {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
      }
    ),
  // Contact API
  getContacts: (sessionId: string) =>
    fetchJson<Contact[]>(`${API_BASE}/sessions/${sessionId}/contacts`),

  searchContacts: (sessionId: string, q: string) =>
    fetchJson<Contact[]>(
      `${API_BASE}/sessions/${sessionId}/contacts/search?q=${encodeURIComponent(q)}`
    ),

  syncContacts: (sessionId: string) =>
    fetchJson<{ message: string; sessionId: string }>(
      `${API_BASE}/sessions/${sessionId}/contacts/sync`,
      { method: 'POST' }
    ),

  createContact: (sessionId: string, payload: { phoneNumber: string; name?: string }) =>
    fetchJson<Contact>(`${API_BASE}/sessions/${sessionId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getProfilePicture: (sessionId: string, contactId: string) =>
    fetchJson<{ jid: string; avatarUrl?: string | null }>(
      `${API_BASE}/sessions/${sessionId}/contacts/${encodeURIComponent(contactId)}/profile-picture`
    ),

  // Chat API
  getChats: (sessionId: string) =>
    fetchJson<Chat[]>(`${API_BASE}/sessions/${sessionId}/chats`),

  syncChats: (sessionId: string) =>
    fetchJson<{ message: string; sessionId: string }>(
      `${API_BASE}/sessions/${sessionId}/chats/sync`,
      { method: 'POST' }
    ),

  getChatMessages: (sessionId: string, chatId: string, limit = 50, offset = 0) =>
    fetchJson<Message[]>(
      `${API_BASE}/sessions/${sessionId}/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}&offset=${offset}`
    ),

  markChatRead: (sessionId: string, chatId: string) =>
    fetchJson<Chat>(
      `${API_BASE}/sessions/${sessionId}/chats/${encodeURIComponent(chatId)}/read`,
      { method: 'POST' }
    ),

  sendTextMessage: (sessionId: string, payload: SendTextRequest, apiKey?: string) =>
    fetchJson<MessageResponse>(`${API_BASE}/sessions/${sessionId}/messages/send-text`, {
      method: 'POST',
      headers: apiKey ? { 'X-API-Key': apiKey } : undefined,
      body: JSON.stringify(payload),
    }),

  sendMediaMessage: (
    sessionId: string,
    payload: {
      to: string;
      mediaType: 'image' | 'audio' | 'video' | 'document' | 'sticker';
      mediaUrl: string;
      caption?: string;
      fileName?: string;
      mimetype?: string;
    }
  ) =>
    fetchJson<MessageResponse>(`${API_BASE}/sessions/${sessionId}/messages/send-media`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Campaign API
  getCampaigns: () => fetchJson<import('@/types/campaign').Campaign[]>(`${API_BASE}/campaigns`),
  getCampaign: (id: string) => fetchJson<import('@/types/campaign').Campaign>(`${API_BASE}/campaigns/${id}`),
  createCampaign: (payload: import('@/types/campaign').CreateCampaignInput) =>
    fetchJson<import('@/types/campaign').Campaign>(`${API_BASE}/campaigns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCampaign: (id: string, payload: Partial<import('@/types/campaign').CreateCampaignInput>) =>
    fetchJson<import('@/types/campaign').Campaign>(`${API_BASE}/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteCampaign: (id: string) =>
    fetchJson<{ id: string }>(`${API_BASE}/campaigns/${id}`, { method: 'DELETE' }),
  startCampaign: (id: string) =>
    fetchJson<import('@/types/campaign').Campaign>(`${API_BASE}/campaigns/${id}/start`, { method: 'POST' }),
  pauseCampaign: (id: string) =>
    fetchJson<import('@/types/campaign').Campaign>(`${API_BASE}/campaigns/${id}/pause`, { method: 'POST' }),
  stopCampaign: (id: string) =>
    fetchJson<import('@/types/campaign').Campaign>(`${API_BASE}/campaigns/${id}/stop`, { method: 'POST' }),
  retryCampaign: (id: string) =>
    fetchJson<{ retriedCount: number }>(`${API_BASE}/campaigns/${id}/retry`, { method: 'POST' }),
  cloneCampaign: (id: string) =>
    fetchJson<import('@/types/campaign').Campaign>(`${API_BASE}/campaigns/${id}/clone`, { method: 'POST' }),

  // Campaign Recipients & Logs API
  getCampaignRecipients: (id: string) =>
    fetchJson<import('@/types/campaign').CampaignRecipientResponse[]>(`${API_BASE}/campaigns/${id}/recipients`),
  getCampaignLogs: (id: string) =>
    fetchJson<import('@/types/campaign').CampaignLogEntry[]>(`${API_BASE}/campaigns/${id}/logs`),
  updateCampaignRecipient: (campaignId: string, recipientId: string, payload: import('@/types/campaign').UpdateRecipientPayload) =>
    fetchJson<import('@/types/campaign').CampaignRecipientResponse>(`${API_BASE}/campaigns/${campaignId}/recipients/${recipientId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Blacklist API
  getBlacklist: () => fetchJson<import('@/types/campaign').BlacklistEntry[]>(`${API_BASE}/blacklist`),
  addToBlacklist: (phoneNumber: string, reason = 'MANUAL') =>
    fetchJson<import('@/types/campaign').BlacklistEntry>(`${API_BASE}/blacklist`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, reason }),
    }),
  removeFromBlacklist: (phoneNumber: string) =>
    fetchJson<{ phoneNumber: string }>(`${API_BASE}/blacklist/${encodeURIComponent(phoneNumber)}`, {
      method: 'DELETE',
    }),

  // Templates API
  getCampaignTemplates: () =>
    fetchJson<import('@/types/campaign').CampaignTemplate[]>(`${API_BASE}/campaign-templates`),
  saveCampaignTemplate: (name: string, steps: any[], antiBanConfig: any) =>
    fetchJson<import('@/types/campaign').CampaignTemplate>(`${API_BASE}/campaign-templates`, {
      method: 'POST',
      body: JSON.stringify({ name, steps, antiBanConfig }),
    }),
  deleteCampaignTemplate: (id: string) =>
    fetchJson<{ id: string }>(`${API_BASE}/campaign-templates/${id}`, { method: 'DELETE' }),

  // Phone Validation API
  validatePhoneNumbers: (session_id: string, phones: string[]) =>
    fetchJson<{ results: Array<{ phone: string; exists: boolean; jid?: string }> }>(
      `${API_BASE}/phone-validation/check`,
      {
        method: 'POST',
        body: JSON.stringify({ session_id, phones }),
      }
    ),
};

