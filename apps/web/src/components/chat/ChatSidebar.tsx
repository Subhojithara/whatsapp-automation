"use client";

import { useState } from 'react';
import { Session } from '@/types/session';
import { Chat, Contact } from '@/types/chat';
import { ChatItem } from './ChatItem';
import { apiClient } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  RefreshCw,
  MessageSquare,
  Users,
  Smartphone,
  AlertCircle,
  Radio,
  Sparkles,
} from 'lucide-react';

type TabType = 'chats' | 'groups' | 'channels' | 'status';

interface ChatSidebarProps {
  sessions: Session[];
  selectedSessionId: string;
  onSelectSession: (id: string) => void;
  chats: Chat[];
  isLoadingChats: boolean;
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  contacts?: Contact[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenNewChat: () => void;
}

export function ChatSidebar({
  sessions,
  selectedSessionId,
  onSelectSession,
  chats,
  isLoadingChats,
  activeChatId,
  onSelectChat,
  contacts = [],
  searchQuery,
  onSearchChange,
  onOpenNewChat,
}: ChatSidebarProps) {
  const queryClient = useQueryClient();
  const [isSyncingChats, setIsSyncingChats] = useState(false);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('chats');

  const readySessions = sessions.filter((s) => s.status === 'READY');

  const contactMap = new Map<string, Contact>();
  contacts.forEach((c) => {
    contactMap.set(c.jid, c);
    if (c.phoneNumber) {
      contactMap.set(c.phoneNumber, c);
    }
  });

  // Calculate categorized counts
  const chatsList = chats.filter(
    (c) => !c.isGroup && !c.jid.endsWith('@g.us') && !c.jid.endsWith('@newsletter') && !c.jid.endsWith('@broadcast') && c.jid !== 'status@broadcast'
  );
  const groupsList = chats.filter(
    (c) => c.isGroup || c.jid.endsWith('@g.us')
  );
  const channelsList = chats.filter((c) => c.jid.endsWith('@newsletter'));
  const statusList = chats.filter((c) => c.jid.endsWith('@broadcast') || c.jid === 'status@broadcast');

  const getFilteredByTab = () => {
    switch (activeTab) {
      case 'groups':
        return groupsList;
      case 'channels':
        return channelsList;
      case 'status':
        return statusList;
      case 'chats':
      default:
        return chatsList;
    }
  };

  const currentTabChats = getFilteredByTab();

  const filteredChats = currentTabChats.filter((chat) => {
    const rawNumber = chat.jid.split('@')[0];
    if (rawNumber === '0' || chat.jid.startsWith('chat_')) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const contact = contactMap.get(chat.jid);
    const chatName = chat.name?.toLowerCase() || '';
    const contactName = contact?.name?.toLowerCase() || '';
    const phone = (contact?.phoneNumber || chat.jid).toLowerCase();
    const lastMsg = chat.lastMessageBody?.toLowerCase() || '';

    return (
      chatName.includes(q) ||
      contactName.includes(q) ||
      phone.includes(q) ||
      lastMsg.includes(q)
    );
  });

  const handleSyncChats = async () => {
    if (!selectedSessionId || isSyncingChats) return;
    try {
      setIsSyncingChats(true);
      await apiClient.syncChats(selectedSessionId);
      await queryClient.invalidateQueries({ queryKey: ['chats', selectedSessionId] });
    } catch (err) {
      console.error('Failed to sync chats:', err);
    } finally {
      setIsSyncingChats(false);
    }
  };

  const handleSyncContacts = async () => {
    if (!selectedSessionId || isSyncingContacts) return;
    try {
      setIsSyncingContacts(true);
      await apiClient.syncContacts(selectedSessionId);
      await queryClient.invalidateQueries({ queryKey: ['contacts', selectedSessionId] });
    } catch (err) {
      console.error('Failed to sync contacts:', err);
    } finally {
      setIsSyncingContacts(false);
    }
  };

  const tabs: { id: TabType; label: string; count: number; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'chats', label: 'Chats', count: chatsList.length, icon: MessageSquare },
    { id: 'groups', label: 'Groups', count: groupsList.length, icon: Users },
    { id: 'channels', label: 'Channels', count: channelsList.length, icon: Radio },
    { id: 'status', label: 'Status', count: statusList.length, icon: Sparkles },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c0c0e]">
      {/* Header with Session Dropdown & Sync Buttons */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            Messaging
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSyncChats}
              disabled={!selectedSessionId || isSyncingChats}
              title="Sync Chats"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncingChats ? 'animate-spin text-emerald-500' : ''}`}
              />
            </button>
            <button
              onClick={handleSyncContacts}
              disabled={!selectedSessionId || isSyncingContacts}
              title="Sync Contacts"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              <Users
                className={`w-3.5 h-3.5 ${isSyncingContacts ? 'animate-spin text-emerald-500' : ''}`}
              />
            </button>
            <button
              onClick={onOpenNewChat}
              disabled={!selectedSessionId}
              title="Start New Chat"
              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-40 transition-colors shadow-sm ml-1"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Session Selector */}
        <div>
          {readySessions.length > 0 ? (
            <div className="relative">
              <select
                value={selectedSessionId}
                onChange={(e) => onSelectSession(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {readySessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phoneNumber ? `+${s.phoneNumber}` : 'Connected'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>No READY session available. Please authenticate a session first.</span>
            </div>
          )}
        </div>

        {/* Categorized Filter Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-100 dark:bg-zinc-900/80 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all relative ${
                  isActive
                    ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-zinc-200/80 dark:border-zinc-700/80 scale-[1.02]'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </div>
                {tab.count > 0 && (
                  <span
                    className={`mt-0.5 text-[9px] px-1.5 py-0.2 rounded-full font-bold leading-none ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl pl-9 pr-3 py-2 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto relative">
        {isLoadingChats ? (
          <div className="p-8 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
            <span>Loading conversations...</span>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
            <Smartphone className="w-8 h-8 opacity-30 text-zinc-400" />
            <span>{searchQuery ? 'No matching chats found' : 'No chats found for this session'}</span>
            {selectedSessionId && !searchQuery && (
              <button
                onClick={onOpenNewChat}
                className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                + Start a new chat
              </button>
            )}
          </div>
        ) : (
          <div>
            {filteredChats.map((chat) => (
              <ChatItem
                key={chat.jid}
                chat={chat}
                isActive={activeChatId === chat.jid}
                onClick={() => onSelectChat(chat.jid)}
                contact={contactMap.get(chat.jid)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
