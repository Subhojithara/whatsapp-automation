"use client";

import { useState } from 'react';
import { Contact } from '@/types/chat';
import { apiClient } from '@/lib/api-client';
import { cleanPhoneNumber, formatPhoneNumber, getAvatarColor, getInitials, isPhoneNumberOrLid } from '@/lib/chat-utils';
import { X, Search, UserPlus, Phone, User, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  contacts?: Contact[];
  onSelectChat: (jidOrId: string) => void;
}

export function NewChatModal({
  isOpen,
  onClose,
  sessionId,
  contacts = [],
  onSelectChat,
}: NewChatModalProps) {
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    const cName = c.name?.toLowerCase() || '';
    const cPhone = (c.phoneNumber || c.jid).toLowerCase();
    return cName.includes(q) || cPhone.includes(q);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = cleanPhoneNumber(phoneNumber);

    if (!cleaned || cleaned.length < 8) {
      setError('Please enter a valid phone number with country code (e.g. 919876543210)');
      return;
    }

    if (!sessionId) {
      setError('No active session selected.');
      return;
    }

    try {
      setIsSubmitting(true);
      const contact = await apiClient.createContact(sessionId, {
        phoneNumber: cleaned,
        name: name.trim() || undefined,
      });

      await queryClient.invalidateQueries({ queryKey: ['contacts', sessionId] });
      await queryClient.invalidateQueries({ queryKey: ['chats', sessionId] });

      const targetJid = contact.jid || `${cleaned}@s.whatsapp.net`;
      onSelectChat(targetJid);
      handleResetAndClose();
    } catch (err: any) {
      console.error('Failed to create contact:', err);
      setError(err?.message || 'Failed to initiate new chat');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectExisting = (contact: Contact) => {
    onSelectChat(contact.jid);
    handleResetAndClose();
  };

  const handleResetAndClose = () => {
    setPhoneNumber('');
    setName('');
    setContactSearch('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
              New Conversation
            </h3>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Form to enter new phone number */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Phone Number (with Country Code)
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 919876543210 for India (+91)"
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Do not include + or dashes. Enter digits only with country code prefix.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Contact Name (Optional)
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !phoneNumber.trim()}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Starting Chat...</span>
                </>
              ) : (
                <span>Start Chat</span>
              )}
            </button>
          </form>

          {/* Existing Contacts Divider */}
          {contacts.length > 0 && (
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Or pick from Synced Contacts ({contacts.length})
              </label>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search existing contacts..."
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1 border border-zinc-100 dark:border-zinc-800/80 rounded-xl p-1">
                {filteredContacts.length === 0 ? (
                  <p className="text-center py-4 text-xs text-zinc-400">
                    No contacts match search
                  </p>
                ) : (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.id || contact.jid}
                      onClick={() => handleSelectExisting(contact)}
                      className="w-full text-left p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-2.5 transition-colors"
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${getAvatarColor(
                          contact.id || contact.jid
                        )}`}
                      >
                        {getInitials(contact.name || contact.phoneNumber)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {contact.name || formatPhoneNumber(contact.phoneNumber) || contact.jid}
                        </p>
                        {contact.name && contact.phoneNumber && (
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                            {formatPhoneNumber(contact.phoneNumber)}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
