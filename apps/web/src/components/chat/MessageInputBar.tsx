"use client";

import React, { useRef, useState, useEffect } from 'react';
import {
  Send,
  Loader2,
  Paperclip,
  Smile,
  Mic,
  Square,
  X,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Sticker,
} from 'lucide-react';

interface MessageInputBarProps {
  onSendMessage: (text: string) => Promise<void> | void;
  onSendMedia?: (payload: {
    mediaType: 'image' | 'audio' | 'video' | 'document' | 'sticker';
    mediaUrl: string;
    caption?: string;
    fileName?: string;
    mimetype?: string;
  }) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
}

const COMMON_EMOJIS = [
  '👍', '❤️', '😂', '🔥', '🎉', '🙏', '😊', '🚀', '💯', '👏',
  '😍', '🥰', '👌', '✌️', '😎', '🙌', '🤝', '💡', '✅', '❌',
  '😭', '🤔', '😅', '🥳', '💪', '💬', '📢', '📌', '🎯', '⚡'
];

export function MessageInputBar({
  onSendMessage,
  onSendMedia,
  disabled = false,
  placeholder = 'Type a message...',
}: MessageInputBarProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'audio' | 'video' | 'document' | 'sticker'>('image');

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 120);
    el.style.height = `${newHeight}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [text]);

  const handleSendText = async () => {
    if (!text.trim() || disabled || isSending) return;
    const messageText = text.trim();
    setText('');
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    try {
      setIsSending(true);
      await onSendMessage(messageText);
    } catch (err) {
      console.error('Error sending text message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  // File Upload Handling
  const triggerFileSelect = (mediaType: 'image' | 'audio' | 'video' | 'document' | 'sticker') => {
    setSelectedMediaType(mediaType);
    setShowAttachMenu(false);
    if (fileInputRef.current) {
      if (mediaType === 'image') fileInputRef.current.accept = 'image/*';
      else if (mediaType === 'audio') fileInputRef.current.accept = 'audio/*';
      else if (mediaType === 'video') fileInputRef.current.accept = 'video/*';
      else if (mediaType === 'sticker') fileInputRef.current.accept = 'image/webp,image/png';
      else fileInputRef.current.accept = '*/*';

      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onSendMedia) return;

    try {
      setIsSending(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await onSendMedia({
          mediaType: selectedMediaType,
          mediaUrl: dataUrl,
          caption: text.trim() || undefined,
          fileName: file.name,
          mimetype: file.type,
        });
        setText('');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error sending media file:', err);
    } finally {
      setIsSending(false);
      if (e.target) e.target.value = '';
    }
  };

  // Voice Recording Handling
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Audio recording is not supported in this browser environment.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/ogg' });
        stream.getTracks().forEach((track) => track.stop());

        if (onSendMedia && audioBlob.size > 0) {
          setIsSending(true);
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = reader.result as string;
            await onSendMedia({
              mediaType: 'audio',
              mediaUrl: dataUrl,
              fileName: 'voice_note.ogg',
              mimetype: audioBlob.type || 'audio/ogg',
            });
            setIsSending(false);
          };
          reader.readAsDataURL(audioBlob);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start audio recording:', err);
      alert('Could not access microphone for audio recording.');
    }
  };

  const stopRecording = (send = true) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (!send) {
        mediaRecorderRef.current.onstop = () => {
          // Cancelled: stop tracks without sending
        };
      }
      mediaRecorderRef.current.stop();
    }
  };

  const formatSecs = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] relative">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <>
          {/* invisible backdrop: any click outside the picker closes it,
              the same way the session card's menu dismisses */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowEmojiPicker(false)}
          />
          <div className="absolute bottom-16 left-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-xl z-30 max-w-xs">
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Emojis</span>
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto p-1">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleInsertEmoji(emoji)}
                  className="text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1.5 rounded-lg transition-colors text-center select-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Attach File Menu Popover */}
      {showAttachMenu && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowAttachMenu(false)}
          />
          <div className="absolute bottom-16 left-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2 shadow-xl z-30 flex flex-col gap-1 min-w-[150px]">
          <button
            onClick={() => triggerFileSelect('image')}
            className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium"
          >
            <ImageIcon className="w-4 h-4 text-emerald-500" />
            <span>Image</span>
          </button>
          <button
            onClick={() => triggerFileSelect('audio')}
            className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium"
          >
            <Music className="w-4 h-4 text-purple-500" />
            <span>Audio File</span>
          </button>
          <button
            onClick={() => triggerFileSelect('video')}
            className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium"
          >
            <Film className="w-4 h-4 text-sky-500" />
            <span>Video</span>
          </button>
          <button
            onClick={() => triggerFileSelect('document')}
            className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium"
          >
            <FileText className="w-4 h-4 text-amber-500" />
            <span>Document</span>
          </button>
          <button
            onClick={() => triggerFileSelect('sticker')}
            className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium"
          >
            <Sticker className="w-4 h-4 text-rose-500" />
            <span>Sticker</span>
          </button>
          </div>
        </>
      )}

      {/* Main Bar / Voice Recording Bar */}
      {isRecording ? (
        <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2 text-xs text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2 font-bold animate-pulse">
            <Mic className="w-4 h-4 text-red-500" />
            <span>Recording Voice Note... {formatSecs(recordingTime)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => stopRecording(false)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"
              title="Cancel Recording"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={() => stopRecording(true)}
              className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
              title="Send Voice Note"
            >
              <Square className="w-3 h-3 fill-white" />
              <span>Send Note</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {/* Action Buttons: Emoji & Attach File */}
          <div className="flex items-center gap-1 pb-1">
            <button
              onClick={() => {
                setShowEmojiPicker((p) => !p);
                setShowAttachMenu(false);
              }}
              disabled={disabled}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
              title="Add Emoji"
            >
              <Smile className="w-5 h-5 text-amber-500" />
            </button>
            <button
              onClick={() => {
                setShowAttachMenu((p) => !p);
                setShowEmojiPicker(false);
              }}
              disabled={disabled}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
              title="Attach File or Media"
            >
              <Paperclip className="w-5 h-5 text-emerald-500" />
            </button>
          </div>

          {/* Text Area Input */}
          <div className="flex-1 relative bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus-within:ring-2 focus-within:ring-emerald-500 overflow-hidden transition-all">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder}
              rows={1}
              className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 text-xs px-3.5 py-2.5 outline-none resize-none placeholder:text-zinc-400 max-h-32 overflow-y-auto leading-relaxed"
            />
          </div>

          {/* Record Voice Note / Send Button */}
          {text.trim() ? (
            <button
              onClick={handleSendText}
              disabled={disabled || isSending}
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white disabled:text-zinc-400 shrink-0 flex items-center justify-center transition-colors shadow-sm disabled:shadow-none"
              title="Send Message (Enter)"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={disabled || isSending}
              className="w-10 h-10 rounded-full bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 shrink-0 flex items-center justify-center transition-colors shadow-xs"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
