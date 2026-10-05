"use client";

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useWebSocket } from '@/hooks/use-websocket';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ConversationArea } from '@/components/chat/ConversationArea';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { Chat } from '@/types/chat';

export default function ChatPage() {
  useWebSocket();
  const queryClient = useQueryClient();

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'conversation'>('list');
  const [isNewChatOpen, setIsNewChatOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Fetch all WhatsApp sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiClient.getSessions(),
    refetchInterval: 5000,
  });

  // Auto-select session: prefer READY or connected/starting sessions
  useEffect(() => {
    if (sessions.length > 0) {
      const exists = sessions.some((s) => s.id === selectedSessionId);
      if (!selectedSessionId || !exists) {
        const preferred =
          sessions.find((s) => s.status === 'READY') ||
          sessions.find((s) => s.status === 'STARTING' || s.status === 'CONNECTING' || s.status === 'AUTHENTICATING') ||
          sessions[0];
        setSelectedSessionId(preferred.id);
      }
    }
  }, [sessions, selectedSessionId]);

  // 2. Fetch chats for selected session
  const { data: chats = [], isLoading: isLoadingChats } = useQuery({
    queryKey: ['chats', selectedSessionId],
    queryFn: () => apiClient.getChats(selectedSessionId),
    enabled: !!selectedSessionId,
  });

  // 3. Fetch contacts for selected session
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', selectedSessionId],
    queryFn: () => apiClient.getContacts(selectedSessionId),
    enabled: !!selectedSessionId,
  });

  // 4. Derive the active chat JID for message fetching
  // activeChatId always stores the JID (e.g. 919477762699@s.whatsapp.net)
  const activeChatJid = activeChatId;

  // 5. Fetch messages for active chat using JID
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ['messages', selectedSessionId, activeChatJid],
    queryFn: () => apiClient.getChatMessages(selectedSessionId, activeChatJid!),
    enabled: !!selectedSessionId && !!activeChatJid,
    placeholderData: (previousData) => previousData,
    refetchInterval: 3000,
  });

  // Select chat handler
  const handleSelectChat = async (chatJid: string) => {
    // Always store the JID as the active chat identifier
    setActiveChatId(chatJid);
    setMobileView('conversation');

    if (selectedSessionId && chatJid) {
      try {
        await apiClient.markChatRead(selectedSessionId, chatJid);
        queryClient.invalidateQueries({ queryKey: ['chats', selectedSessionId] });
      } catch (err) {
        console.error('Failed to mark chat read:', err);
      }
    }
  };

  // Send text message handler
  const handleSendMessage = async (text: string) => {
    if (!selectedSessionId || !activeChatJid) return;

    // activeChatJid IS the JID, send directly
    await apiClient.sendTextMessage(selectedSessionId, {
      to: activeChatJid,
      text,
    });

    queryClient.invalidateQueries({
      queryKey: ['messages', selectedSessionId, activeChatJid],
    });
    queryClient.invalidateQueries({
      queryKey: ['chats', selectedSessionId],
    });
  };

  // Send media message handler (audio, voice notes, image, video, document, sticker)
  const handleSendMedia = async (payload: {
    mediaType: 'image' | 'audio' | 'video' | 'document' | 'sticker';
    mediaUrl: string;
    caption?: string;
    fileName?: string;
    mimetype?: string;
  }) => {
    if (!selectedSessionId || !activeChatJid) return;

    await apiClient.sendMediaMessage(selectedSessionId, {
      to: activeChatJid,
      mediaType: payload.mediaType,
      mediaUrl: payload.mediaUrl,
      caption: payload.caption,
      fileName: payload.fileName,
      mimetype: payload.mimetype,
    });

    queryClient.invalidateQueries({
      queryKey: ['messages', selectedSessionId, activeChatJid],
    });
    queryClient.invalidateQueries({
      queryKey: ['chats', selectedSessionId],
    });
  };

  const handleRefreshMessages = () => {
    if (selectedSessionId && activeChatJid) {
      queryClient.invalidateQueries({
        queryKey: ['messages', selectedSessionId, activeChatJid],
      });
    }
  };

  // Derive active Chat object by JID match
  const foundChat = chats.find((c) => c.jid === activeChatJid);
  const activeContact = contacts.find(
    (c) => c.jid === activeChatJid || c.phoneNumber === activeChatJid?.split('@')[0]
  );

  const activeChat: Chat | null = foundChat
    ? foundChat
    : activeChatJid
    ? {
        id: activeChatJid,
        jid: activeChatJid.includes('@')
          ? activeChatJid
          : `${activeChatJid}@s.whatsapp.net`,
        name: activeContact?.name || null,
        isGroup: false,
        unreadCount: 0,
        sessionId: selectedSessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    : null;

  const activeSession = sessions.find((s) => s.id === selectedSessionId);
  const isSessionReady = activeSession ? activeSession.status !== 'FAILED' && activeSession.status !== 'STOPPED' && activeSession.status !== 'DELETED' : false;

  return (
    <div className="w-full h-full overflow-hidden flex flex-col md:flex-row bg-white dark:bg-[#0c0c0e]">
      {/* Left Sidebar Panel */}
      <div
        className={`w-full md:w-[380px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full ${
          mobileView === 'conversation' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ChatSidebar
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSelectSession={(id) => {
            setSelectedSessionId(id);
            setActiveChatId(null);
          }}
          chats={chats}
          isLoadingChats={isLoadingChats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          contacts={contacts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenNewChat={() => setIsNewChatOpen(true)}
        />
      </div>

      {/* Right Conversation Panel */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-full ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ConversationArea
          activeChat={activeChat}
          contact={activeContact}
          messages={messages}
          isLoadingMessages={isLoadingMessages}
          onSendMessage={handleSendMessage}
          onSendMedia={handleSendMedia}
          onBackToSidebar={() => setMobileView('list')}
          onRefreshMessages={handleRefreshMessages}
          isSessionReady={isSessionReady}
        />
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        sessionId={selectedSessionId}
        contacts={contacts}
        onSelectChat={handleSelectChat}
      />
    </div>
  );
}
