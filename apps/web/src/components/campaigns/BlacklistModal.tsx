"use client";

import { useState, useEffect } from "react";
import { X, ShieldAlert, Plus, Trash2, Search, UserX } from "lucide-react";
import { BlacklistEntry } from "@/types/campaign";
import { apiClient } from "@/lib/api-client";

interface BlacklistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BlacklistModal({ isOpen, onClose }: BlacklistModalProps) {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [search, setSearch] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBlacklist();
    }
  }, [isOpen]);

  const loadBlacklist = async () => {
    try {
      const data = await apiClient.getBlacklist();
      setEntries(data);
    } catch (err: any) {
      setError(err.message || "Failed to load blacklist");
    }
  };

  const handleAdd = async () => {
    if (!newPhone.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiClient.addToBlacklist(newPhone.trim(), "MANUAL");
      setNewPhone("");
      await loadBlacklist();
    } catch (err: any) {
      setError(err.message || "Failed to add to blacklist");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (phone: string) => {
    try {
      await apiClient.removeFromBlacklist(phone);
      await loadBlacklist();
    } catch (err: any) {
      setError(err.message || "Failed to remove from blacklist");
    }
  };

  if (!isOpen) return null;

  const filtered = entries.filter(
    (e) =>
      e.phoneNumber.includes(search) ||
      e.reason.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Global "Do Not Contact" Blacklist
              </h2>
              <p className="text-xs text-zinc-500">
                Numbers on this list are automatically blocked across all campaigns
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
              {error}
            </div>
          )}

          {/* Add Form */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Enter phone number (e.g. 919876543210)"
              className="flex-1 px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              onClick={handleAdd}
              disabled={loading || !newPhone.trim()}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-40 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Number
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blacklisted numbers..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-xs focus:outline-none"
            />
          </div>

          {/* Blacklist Table */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 text-xs flex flex-col items-center">
                <UserX className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mb-2" />
                <span>No blacklisted numbers found</span>
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  <tr>
                    <th className="p-2.5 font-semibold">Phone Number</th>
                    <th className="p-2.5 font-semibold">Reason</th>
                    <th className="p-2.5 font-semibold">Added At</th>
                    <th className="p-2.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/20"
                    >
                      <td className="p-2.5 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {entry.phoneNumber}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 text-[10px] font-bold">
                          {entry.reason}
                        </span>
                      </td>
                      <td className="p-2.5 text-zinc-400 text-[11px]">
                        {new Date(entry.addedAt).toLocaleDateString()}
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => handleRemove(entry.phoneNumber)}
                          className="text-zinc-400 hover:text-rose-500 p-1 rounded transition-colors"
                          title="Remove from blacklist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
