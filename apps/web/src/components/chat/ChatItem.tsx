"use client";

import { Chat, Contact } from '@/types/chat';
import {
  formatPhoneNumber,
  getAvatarColor,
  getInitials,
  formatRelativeTime,
  isPhoneNumberOrLid,
} from '@/lib/chat-utils';
import { Users, User, CheckCheck, Check } from 'lucide-react';
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
  const hasHumanName =
    (chat.name && !isPhoneNumberOrLid(chat.name)) ||
    (contact?.name && !isPhoneNumberOrLid(contact.name));
  const humanName = hasHumanName ? chat.name || contact?.name : null;

  const displayName =
    humanName ||
    formattedJidPhone ||
    (isLid ? 'WhatsApp Contact' : rawJidNumber && rawJidNumber !== '0' ? rawJidNumber : 'WhatsApp Contact');

  const phoneSubtext = humanName
    ? formattedJidPhone || (contact?.phoneNumber && !isLid ? formatPhoneNumber(contact.phoneNumber) : null)
    : null;

  const avatarUrl = useProfilePicture(chat.sessionId, chat.jid, contact?.avatarUrl || chat.avatarUrl);
  const avatarColorClass = getAvatarColor(chat.id || chat.jid);
  const initials = getInitials(humanName || displayName, '');
  const relativeTime = formatRelativeTime(chat.lastMessageAt || chat.updatedAt);

  return (
    <button
      onClick={onClick}
      className={`w-[calc(100%-0.75rem)] mx-1.5 my-0.5 text-left p-2.5 flex items-center gap-3 transition-all duration-150 rounded-xl active:scale-[0.99] select-none ${
        isActive
          ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 shadow-xs'
          : 'hover:bg-zinc-100/80 dark:hover:bg-white/[0.05] border border-transparent'
      }`}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden ${
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
        {isActive && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0c0d10]" />
        )}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span
            className={`font-semibold text-xs truncate ${
              isActive
                ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                : 'text-zinc-900 dark:text-zinc-100'
            }`}
          >
            {displayName}
          </span>
          {relativeTime && (
            <span
              className={`text-[10px] shrink-0 font-medium ${
                chat.unreadCount > 0
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {relativeTime}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {chat.lastMessageBody ? chat.lastMessageBody : phoneSubtext || 'No messages yet'}
          </p>
          {chat.unreadCount > 0 && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] min-w-[18px] text-center shadow-xs">
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
