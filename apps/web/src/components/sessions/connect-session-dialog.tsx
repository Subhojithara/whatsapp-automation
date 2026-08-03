"use client";

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Session } from '@/types/session';
import { QrCode, Phone, Loader2, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';

interface ConnectSessionDialogProps {
  session: Session;
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectSessionDialog({ session, isOpen, onClose }: ConnectSessionDialogProps) {
  const [activeTab, setActiveTab] = useState<'qr' | 'pairing'>('qr');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startEngine() {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.startSession(session.id);
    } catch (err: any) {
      if (err.message && !err.message.includes('already running')) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function restartEngine() {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.restartSession(session.id);
    } catch (err: any) {
      setError(err.message || 'Failed to restart engine');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    startEngine();

    const interval = setInterval(async () => {
      try {
        const data = await apiClient.getQr(session.id);
        if (isMounted && data.qr) {
          setQrCode(data.qr);
        }
      } catch (_) {}
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, session.id]);

  if (!isOpen) return null;

  async function handleRequestPairingCode(e: React.FormEvent) {
    e.preventDefault();
    const cleanNumber = phoneNumber.trim().replace(/[^0-9]/g, '');
    if (!cleanNumber) {
      setError('Please enter a valid phone number with digits only');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.requestPairingCode(session.id, cleanNumber);
      if (res.code) {
        setPairingCode(res.code);
      } else {
        setError('Pairing code requested, waiting for engine response...');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request pairing code');
    } finally {
      setIsLoading(false);
    }
  }

  const isConnected = session.status === 'READY';
  const isFailed = session.status === 'FAILED' || session.status === 'DISCONNECTED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-colors">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Connect WhatsApp</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{session.name} ({session.id})</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-transparent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isConnected ? (
            <div className="py-6 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Session Connected!</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                Account <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{session.displayName || session.phoneNumber}</span> is actively linked and READY.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Tab Selector */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setActiveTab('qr')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
                    activeTab === 'qr'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  QR Code
                </button>
                <button
                  onClick={() => setActiveTab('pairing')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
                    activeTab === 'pairing'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Pairing Code
                </button>
              </div>

              {(error || isFailed) && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error || session.lastError || 'Connection lost. Please retry.'}</span>
                  </div>
                  <button
                    onClick={restartEngine}
                    className="self-end px-3 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-500"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry Engine
                  </button>
                </div>
              )}

              {/* QR Tab */}
              {activeTab === 'qr' && (
                <div className="text-center space-y-4 py-2">
                  {qrCode ? (
                    <div className="p-4 bg-white rounded-2xl inline-block shadow-md border border-zinc-200 mx-auto">
                      <img
                        src={
                          qrCode.startsWith('data:')
                            ? qrCode
                            : `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrCode)}&size=200x200`
                        }
                        alt="WhatsApp QR Code"
                        className="w-48 h-48 mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 mx-auto bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 flex flex-col items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin text-zinc-900 dark:text-zinc-100" />
                      <span className="text-xs">Initializing {session.engine === 'wwebjs' ? 'Google Chrome Engine' : 'WhatsApp Engine'}...</span>
                    </div>
                  )}
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                    Open WhatsApp on your phone → Linked Devices → Link a Device, then point your camera at the QR code.
                  </p>
                </div>
              )}

              {/* Pairing Code Tab */}
              {activeTab === 'pairing' && (
                <div className="space-y-4">
                  {pairingCode ? (
                    <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl text-center space-y-2 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-xs text-zinc-500">Your Pairing Code:</span>
                      <div className="text-2xl font-mono font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
                        {pairingCode}
                      </div>
                      <p className="text-xs text-zinc-500 pt-2">
                        Enter this 8-digit code in WhatsApp under Linked Devices → Link with Phone Number.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestPairingCode} className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Phone Number (E.164 without +)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 919876543210"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-700"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-zinc-50 dark:text-zinc-950 font-semibold text-xs rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Get Pairing Code
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
