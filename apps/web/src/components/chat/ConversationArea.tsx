"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useProfilePicture } from '@/lib/avatar-cache';
import { Chat, Contact, Message } from '@/types/chat';
import { MessageBubble } from './MessageBubble';
import { MessageInputBar } from './MessageInputBar';
import { ThreeDotsMenu, MenuItem } from '@/components/ui/ThreeDotsMenu';
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
  Copy,
  Check,
  XCircle,
  ShieldCheck,
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
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

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
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50/50 dark:bg-[#0a0b0e] text-center select-none">
        <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm border border-emerald-500/20">
          <MessageSquare className="w-10 h-10" />
        </div>
        <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 mb-1">
          WhatsApp Web Messaging
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed mb-6">
          Select a chat from the sidebar or click &quot;+ New Chat&quot; to send messages to any WhatsApp contact.
        </p>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 bg-white dark:bg-[#121316] px-3.5 py-1.5 rounded-full border border-zinc-200 dark:border-white/10 shadow-sm">
          <Lock className="w-3.5 h-3.5 text-emerald-500" />
          <span>End-to-end encrypted connection via Baileys API</span>
        </div>
      </div>
    );
  }

  const rawJidNumber = activeChat.jid.split('@')[0];
  const isLid = activeChat.jid.endsWith('@lid') || rawJidNumber.length > 13;
  const formattedJidPhone = isLid ? '' : formatPhoneNumber(rawJidNumber);

  const hasHumanName =
    (activeChat.name && !isPhoneNumberOrLid(activeChat.name)) ||
    (contact?.name && !isPhoneNumberOrLid(contact?.name));
  const humanName = hasHumanName ? activeChat.name || contact?.name : null;

  const displayName =
    humanName ||
    formattedJidPhone ||
    (isLid ? 'WhatsApp Contact' : rawJidNumber && rawJidNumber !== '0' ? rawJidNumber : 'WhatsApp Contact');

  const rawPhone = contact?.phoneNumber && !isLid ? contact.phoneNumber : isLid ? '' : rawJidNumber;
  const formattedPhone = formatPhoneNumber(rawPhone);
  const initials = getInitials(humanName || displayName, '');

  const handleCopyPhone = () => {
    const textToCopy = rawPhone || activeChat.jid;
    navigator.clipboard.writeText(textToCopy);
    setCopiedNotification('Phone copied to clipboard');
    setTimeout(() => setCopiedNotification(null), 2500);
  };

  const handleCopyJid = () => {
    navigator.clipboard.writeText(activeChat.jid);
    setCopiedNotification('JID copied to clipboard');
    setTimeout(() => setCopiedNotification(null), 2500);
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Copy phone number',
      icon: Copy,
      onClick: handleCopyPhone,
    },
    {
      label: 'Copy WhatsApp JID',
      icon: ShieldCheck,
      onClick: handleCopyJid,
    },
    {
      label: 'Refresh messages',
      icon: RefreshCw,
      onClick: () => onRefreshMessages && onRefreshMessages(),
    },
    {
      label: 'Close conversation',
      icon: XCircle,
      onClick: () => onBackToSidebar && onBackToSidebar(),
      destructive: true,
    },
  ];

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

    // End-to-end encryption header notice at top of conversation
    elements.push(
      <div key="e2ee-notice" className="flex justify-center my-3 select-none">
        <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] max-w-sm text-center border border-amber-500/20 shadow-xs flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Messages are end-to-end encrypted with Signal Protocol.</span>
        </div>
      </div>
    );

    messages.forEach((msg) => {
      const msgDate = msg.createdAt || msg.sentAt;
      const dateSeparatorText = msgDate ? formatDateSeparator(msgDate) : null;
      const dateKey = msgDate ? new Date(msgDate).toDateString() : 'unknown';

      if (dateSeparatorText && dateKey !== lastDateStr) {
        lastDateStr = dateKey;
        elements.push(
          <div key={`sep-${msg.id}-${dateKey}`} className="flex justify-center my-3 select-none">
            <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-[#181a20] text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 shadow-sm border border-zinc-200/80 dark:border-white/10">
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
    <div className="flex flex-col h-full bg-white dark:bg-[#0c0d10] relative">
      {/* Header Bar with Authentic WhatsApp Mobile ergonomics */}
      <div className="px-3.5 py-2.5 border-b border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-between bg-white/90 dark:bg-[#0c0d10]/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile Back Button: Left Arrow */}
          {onBackToSidebar && (
            <button
              onClick={onBackToSidebar}
              className="md:hidden p-1.5 -ml-1.5 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
              title="Back to conversations"
              aria-label="Back to conversations"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}

          {/* Contact Avatar with Status Indicator Ring */}
          <div className="relative">
            <div
              className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden ring-2 ring-emerald-500/20 ${
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
            {/* Live Online Dot */}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0c0d10]" />
          </div>

          {/* Contact Details */}
          <div className="min-w-0">
            <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
              {displayName}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">online</span>
              {formattedPhone && formattedPhone !== displayName && (
                <>
                  <span>•</span>
                  <span>{formattedPhone}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Action Icons & Three-Dots Menu */}
        <div className="flex items-center gap-1">
          {onRefreshMessages && (
            <button
              onClick={onRefreshMessages}
              disabled={isLoadingMessages}
              title="Refresh conversation"
              className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin text-emerald-500' : ''}`}
              />
            </button>
          )}

          {/* WhatsApp Authentic Three-Dots Menu */}
          <ThreeDotsMenu items={menuItems} title="Chat options" />
        </div>
      </div>

      {/* Copied notification toast */}
      {copiedNotification && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/90 text-white text-[11px] px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1.5 animate-in fade-in zoom-in-95">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* Messages Scrollable Area with WhatsApp Wallpaper Theme */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2]/60 dark:bg-[#0b141a]/95">
        {renderMessageContent()}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Bar */}
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
