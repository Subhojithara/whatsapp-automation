export type CampaignStatus = 
  | 'DRAFT'
  | 'VALIDATING'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export type RecipientStatus = 
  | 'PENDING'
  | 'VALIDATING'
  | 'VALID'
  | 'INVALID'
  | 'SENDING'
  | 'WAITING'
  | 'FAILED'
  | 'REPLIED'
  | 'OPTED_OUT'
  | 'BLACKLISTED';

export interface AntiBanConfig {
  minDelaySecs: number;
  maxDelaySecs: number;
  typingPresenceEnabled: boolean;
  typingMinSecs: number;
  typingMaxSecs: number;
  spintaxEnabled: boolean;
  workingHoursEnabled: boolean;
  workingHoursStart: string; // e.g. "09:00"
  workingHoursEnd: string;   // e.g. "19:00"
  timezoneAware: boolean;
  sessionIds: string[];      // empty array = all active sessions
}

export interface CampaignStep {
  id?: string;
  stepIndex: number;
  delaySeconds: number;
  messageTemplate: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'document' | 'audio' | 'video' | null;
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  phoneNumber: string;
  jid?: string | null;
  variables: Record<string, string>;
  status: RecipientStatus;
  currentStepIndex: number;
  nextActionAt?: string | null;
  assignedSessionId?: string | null;
  retryCount: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Response shape from GET /campaigns/{id}/recipients (matches backend RecipientResponse)
export interface CampaignRecipientResponse {
  id: string;
  campaignId: string;
  phoneNumber: string;
  jid: string;
  customVariables?: Record<string, string> | null;
  currentStep: number;
  status: string;
  nextScheduledAt?: string | null;
  lastSentAt?: string | null;
}

// Response shape from GET /campaigns/{id}/logs
export interface CampaignLogEntry {
  id: string;
  recipientId: string;
  phoneNumber: string;
  stepNumber: number;
  messageBody: string;
  status: string;
  errorMessage?: string | null;
  sentAt: string;
}

// Payload for PUT /campaigns/{id}/recipients/{recipientId}
export interface UpdateRecipientPayload {
  customVariablesJson?: Record<string, string>;
  nextScheduledAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  repliedCount: number;
  optedOutCount: number;
  createdAt: string;
  updatedAt: string;
  antiBanConfig: AntiBanConfig;
  steps: CampaignStep[];
}

export interface CreateCampaignInput {
  name: string;
  recipients: Array<{
    phoneNumber: string;
    variables?: Record<string, string>;
  }>;
  steps: Array<{
    stepIndex: number;
    delaySeconds: number;
    messageTemplate: string;
    mediaUrl?: string | null;
    mediaType?: 'image' | 'document' | 'audio' | 'video' | null;
  }>;
  antiBanConfig?: Partial<AntiBanConfig>;
  sessionIds?: string[];
}

export interface BlacklistEntry {
  id: string;
  phoneNumber: string;
  jid?: string | null;
  reason: 'OPT_OUT_KEYWORD' | 'WHATSAPP_BLOCK' | 'MANUAL' | 'DELIVERY_FAILURE';
  sourceCampaignId?: string | null;
  addedAt: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  steps: CampaignStep[];
  antiBanConfig: AntiBanConfig;
  createdAt: string;
  updatedAt: string;
}
