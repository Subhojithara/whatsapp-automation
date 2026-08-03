"use client";

import React, { useEffect, useRef } from 'react';
import { useProfilePicture } from '@/lib/avatar-cache';
import { Chat, Contact, Message } from '@/types/chat';
import { MessageBubble } from './MessageBubble';
import { MessageInputBar } from './MessageInputBar';
import {
  formatPhoneNumber,
  getAvatarColor,
  getInitials,
  formatDateSeparator,
  isPhoneNumberOrLid,
} from '@/lib/chat-utils';
import {
  ChevronLeft,
  RefreshCw,
  MessageSquare,
  Users,
  User,
  Lock,
  Phone,
} from 'lucide-react';

interface ConversationAreaProps {
  activeChat: Chat | null;
  contact?: Contact;
  messages: Message[];
  isLoadingMessages: boolean;
  onSendMessage: (text: string) => Promise<void> | void;
  onSendMedia?: (payload: {
    mediaType: 'image' | 'audio' | 'video' | 'document' | 'sticker';
    mediaUrl: string;
    caption?: string;
    fileName?: string;
    mimetype?: string;
  }) => Promise<void> | void;
  onBackToSidebar?: () => void;
  onRefreshMessages?: () => void;
  isSessionReady?: boolean;
}

export function ConversationArea({
  activeChat,
  contact,
  messages,
  isLoadingMessages,
  onSendMessage,
  onSendMedia,
  onBackToSidebar,
  onRefreshMessages,
  isSessionReady = true,
}: ConversationAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const avatarUrl = useProfilePicture(
    activeChat?.sessionId,
    activeChat?.jid,
    contact?.avatarUrl || activeChat?.avatarUrl
  );

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [activeChat?.id, activeChat?.jid]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length]);

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50/50 dark:bg-[#08080a] text-center select-none">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm">
          <MessageSquare className="w-10 h-10" />
        </div>
        <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 mb-1">
          WhatsApp Web Messaging
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed mb-6">
          Select a chat from the sidebar or click &quot;+ New Chat&quot; to send messages to any WhatsApp contact.
        </p>
        <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-600 bg-white dark:bg-zinc-900/60 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800">
          <Lock className="w-3 h-3 text-emerald-500" />
          <span>End-to-end connected via Baileys API</span>
        </div>
      </div>
    );
  }

  const rawJidNumber = activeChat.jid.split('@')[0];
  const isLid = activeChat.jid.endsWith('@lid') || rawJidNumber.length > 13;
  const formattedJidPhone = isLid ? '' : formatPhoneNumber(rawJidNumber);

  const hasHumanName = (activeChat.name && !isPhoneNumberOrLid(activeChat.name)) || (contact?.name && !isPhoneNumberOrLid(contact?.name));
  const humanName = hasHumanName ? (activeChat.name || contact?.name) : null;

  const displayName =
    humanName ||
    formattedJidPhone ||
    (isLid ? 'WhatsApp Contact' : (rawJidNumber && rawJidNumber !== '0' ? rawJidNumber : 'WhatsApp Contact'));

  const rawPhone = (contact?.phoneNumber && !isLid) ? contact.phoneNumber : (isLid ? '' : rawJidNumber);
  const formattedPhone = formatPhoneNumber(rawPhone);
  const initials = getInitials(humanName || displayName, '');

  const renderMessageContent = () => {
    if (isLoadingMessages && messages.length === 0) {
      return (
        <div className="p-8 text-center text-xs text-zinc-400 flex flex-col items-center justify-center h-full gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
          <span>Loading messages...</span>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="p-8 text-center text-xs text-zinc-400 flex flex-col items-center justify-center h-full gap-2">
          <MessageSquare className="w-8 h-8 opacity-30 text-zinc-400" />
          <span>No message history found for this chat.</span>
          <p className="text-[11px] text-zinc-500">
            Type a message below to start chatting!
          </p>
        </div>
      );
    }

    const elements: React.ReactNode[] = [];
    let lastDateStr: string | null = null;

    messages.forEach((msg) => {
      const msgDate = msg.createdAt || msg.sentAt;
      const dateSeparatorText = msgDate ? formatDateSeparator(msgDate) : null;
      const dateKey = msgDate ? new Date(msgDate).toDateString() : 'unknown';

      if (dateSeparatorText && dateKey !== lastDateStr) {
        lastDateStr = dateKey;
        elements.push(
          <div key={`sep-${msg.id}-${dateKey}`} className="flex justify-center my-3">
            <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 shadow-xs border border-zinc-200/50 dark:border-zinc-700/50">
              {dateSeparatorText}
            </span>
          </div>
        );
      }

      elements.push(<MessageBubble key={msg.id} message={msg} />);
    });

    return elements;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c0c0e]">
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#0c0c0e] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back Button */}
          {onBackToSidebar && (
            <button
              onClick={onBackToSidebar}
              className="md:hidden p-1 -ml-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Back to chat list"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Avatar */}
          <div
            className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden ${
              avatarUrl ? 'bg-zinc-200 dark:bg-zinc-800' : getAvatarColor(activeChat.id || activeChat.jid)
            }`}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : activeChat.isGroup ? (
              <Users className="w-4 h-4 text-white" />
            ) : initials ? (
              initials
            ) : (
              <User className="w-4 h-4 text-white/90" />
            )}
          </div>

          {/* Contact Details */}
          <div className="min-w-0">
            <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
              {displayName}
            </h3>
            {formattedPhone && formattedPhone !== displayName && (
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                <Phone className="w-2.5 h-2.5" />
                <span>{formattedPhone}</span>
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {onRefreshMessages && (
            <button
              onClick={onRefreshMessages}
              disabled={isLoadingMessages}
              title="Refresh Messages"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin text-emerald-500' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f0f2f5]/40 dark:bg-[#09090b]">
        {renderMessageContent()}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <MessageInputBar
        onSendMessage={onSendMessage}
        onSendMedia={onSendMedia}
        disabled={!isSessionReady}
        placeholder={
          isSessionReady
            ? `Message ${displayName}...`
            : 'Session not ready. Select a connected session to send messages.'
        }
      />
    </div>
  );
}
