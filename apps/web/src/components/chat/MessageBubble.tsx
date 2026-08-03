"use client";

import { Message } from '@/types/chat';
import { formatMessageTime } from '@/lib/chat-utils';
import { Check, CheckCheck, Clock, AlertCircle, FileText, Download, Mic } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutgoing = message.fromMe || message.direction?.toUpperCase() === 'OUTGOING';
  const timestamp = formatMessageTime(message.createdAt || message.sentAt);
  const messageText = message.body || message.text || '';
  const msgType = message.messageType || message.typeName || 'text';
  const mediaUrl = message.mediaUrl;

  const renderStatusIcon = () => {
    if (!isOutgoing) return null;

    const status = (message.status || '').toUpperCase();

    switch (status) {
      case 'PENDING':
        return <Clock className="w-3 h-3 text-white/70 animate-spin" />;
      case 'SENT':
        return <Check className="w-3 h-3 text-white/80" />;
      case 'DELIVERED':
        return <CheckCheck className="w-3 h-3 text-white/80" />;
      case 'READ':
      case 'RECEIVED':
        return <CheckCheck className="w-3 h-3 text-sky-300" />;
      case 'FAILED':
        return <AlertCircle className="w-3 h-3 text-red-300" />;
      default:
        return <Check className="w-3 h-3 text-white/80" />;
    }
  };

  const renderMediaContent = () => {
    if (msgType === 'audio') {
      return (
        <div className="my-1 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold opacity-90 mb-1">
            <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Voice Note / Audio</span>
          </div>
          {mediaUrl ? (
            <audio controls src={mediaUrl} className="w-full max-w-[260px] h-9 rounded-lg" />
          ) : (
            <div className="p-2 rounded bg-black/10 dark:bg-white/10 text-[11px] italic">
              🎵 Audio Message
            </div>
          )}
        </div>
      );
    }

    if (msgType === 'image') {
      return (
        <div className="my-1">
          {mediaUrl ? (
            <img
              src={mediaUrl}
              alt="Image attachment"
              className="max-w-full max-h-64 rounded-lg object-cover border border-black/10 dark:border-white/10"
            />
          ) : (
            <div className="p-2 rounded bg-black/10 dark:bg-white/10 text-[11px] italic">
              📷 Image Attachment
            </div>
          )}
        </div>
      );
    }

    if (msgType === 'video') {
      return (
        <div className="my-1">
          {mediaUrl ? (
            <video
              controls
              src={mediaUrl}
              className="max-w-full max-h-64 rounded-lg border border-black/10 dark:border-white/10"
            />
          ) : (
            <div className="p-2 rounded bg-black/10 dark:bg-white/10 text-[11px] italic">
              🎥 Video Attachment
            </div>
          )}
        </div>
      );
    }

    if (msgType === 'document') {
      return (
        <div className="my-1 p-2 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-between gap-3 border border-black/5 dark:border-white/10">
          <div className="flex items-center gap-2 truncate">
            <FileText className="w-5 h-5 shrink-0 text-emerald-400" />
            <span className="text-xs font-medium truncate">
              {messageText || 'Document File'}
            </span>
          </div>
          {mediaUrl && (
            <a
              href={mediaUrl}
              download="document"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
              title="Download File"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
        </div>
      );
    }

    if (msgType === 'sticker') {
      return (
        <div className="my-1">
          {mediaUrl ? (
            <img src={mediaUrl} alt="Sticker" className="w-28 h-28 object-contain" />
          ) : (
            <div className="p-2 rounded bg-black/10 dark:bg-white/10 text-[11px] italic">
              🏷️ Sticker
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`flex w-full ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3.5 py-2 text-xs shadow-sm relative group ${
          isOutgoing
            ? 'bg-emerald-600 dark:bg-emerald-700 text-white rounded-tr-xs'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-xs'
        }`}
      >
        {/* Media rendering */}
        {renderMediaContent()}

        {/* Text body if present */}
        {messageText && msgType !== 'audio' && (
          <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed mt-0.5">
            {messageText}
          </p>
        )}

        {/* Footer timestamp and status indicator */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
            isOutgoing ? 'text-emerald-100/90' : 'text-zinc-400 dark:text-zinc-500'
          }`}
        >
          <span>{timestamp}</span>
          {renderStatusIcon()}
        </div>

        {/* Error message tooltip if failed */}
        {message.error && (
          <p className="text-[10px] text-red-200 mt-1 font-medium italic">
            Error: {message.error}
          </p>
        )}
      </div>
    </div>
  );
}
