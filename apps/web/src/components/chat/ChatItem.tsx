"use client";

import { Chat, Contact } from '@/types/chat';
import {
  formatPhoneNumber,
  getAvatarColor,
  getInitials,
  formatRelativeTime,
  isPhoneNumberOrLid,
} from '@/lib/chat-utils';
import { Users, User } from 'lucide-react';

import { useProfilePicture } from '@/lib/avatar-cache';

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  contact?: Contact;
}

export function ChatItem({ chat, isActive, onClick, contact }: ChatItemProps) {
  const rawJidNumber = chat.jid.split('@')[0];
  const isLid = chat.jid.endsWith('@lid') || rawJidNumber.length > 13;
  const formattedJidPhone = isLid ? '' : formatPhoneNumber(rawJidNumber);

  // If there's a contact or chat name that is NOT just raw digits
  const hasHumanName = (chat.name && !isPhoneNumberOrLid(chat.name)) || (contact?.name && !isPhoneNumberOrLid(contact.name));
  const humanName = hasHumanName ? (chat.name || contact?.name) : null;

  const displayName =
    humanName ||
    formattedJidPhone ||
    (isLid ? 'WhatsApp Contact' : (rawJidNumber && rawJidNumber !== '0' ? rawJidNumber : 'WhatsApp Contact'));

  const phoneSubtext = humanName ? (formattedJidPhone || (contact?.phoneNumber && !isLid ? formatPhoneNumber(contact.phoneNumber) : null)) : null;

  const avatarUrl = useProfilePicture(chat.sessionId, chat.jid, contact?.avatarUrl || chat.avatarUrl);
  const avatarColorClass = getAvatarColor(chat.id || chat.jid);
  const initials = getInitials(humanName || displayName, '');
  const relativeTime = formatRelativeTime(chat.lastMessageAt || chat.updatedAt);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 flex items-center gap-3 transition-colors border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
        isActive
          ? 'bg-zinc-100 dark:bg-zinc-800/80 border-l-4 border-emerald-500'
          : ''
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden ${
          avatarUrl ? 'bg-zinc-200 dark:bg-zinc-800' : avatarColorClass
        }`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : chat.isGroup ? (
          <Users className="w-5 h-5 text-white" />
        ) : initials ? (
          initials
        ) : (
          <User className="w-5 h-5 text-white/90" />
        )}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
            {displayName}
          </span>
          {relativeTime && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 font-medium">
              {relativeTime}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {chat.lastMessageBody ? chat.lastMessageBody : phoneSubtext || 'No messages yet'}
          </p>
          {chat.unreadCount > 0 && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-[10px] min-w-[18px] text-center shadow-sm">
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

