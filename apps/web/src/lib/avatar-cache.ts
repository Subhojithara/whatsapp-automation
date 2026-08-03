import { useState, useEffect } from 'react';
import { apiClient } from './api-client';

const CACHE_KEY = 'wa_avatar_cache_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL for valid URLs
const NULL_CACHE_TTL_MS = 15 * 1000; // 15 seconds TTL for nulls (allows quick re-fetch)

interface CacheEntry {
  avatarUrl: string | null;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();

// Load from localStorage on init
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed: Record<string, CacheEntry> = JSON.parse(raw);
      const now = Date.now();
      Object.entries(parsed).forEach(([key, entry]) => {
        const ttl = entry.avatarUrl ? CACHE_TTL_MS : NULL_CACHE_TTL_MS;
        if (now - entry.timestamp < ttl) {
          memoryCache.set(key, entry);
        }
      });
    }
  } catch (e) {
    // Ignore storage parse errors
  }
}

function saveCacheToStorage() {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, CacheEntry> = {};
    memoryCache.forEach((val, key) => {
      // Only persist valid URLs to localStorage so nulls don't linger across page refreshes
      if (val.avatarUrl) {
        obj[key] = val;
      }
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    // Ignore storage write errors
  }
}

export function getCachedAvatar(sessionId: string, jid: string): string | null | undefined {
  const cacheKey = `${sessionId}:${jid}`;
  const entry = memoryCache.get(cacheKey);
  if (!entry) return undefined; // Cache miss

  const ttl = entry.avatarUrl ? CACHE_TTL_MS : NULL_CACHE_TTL_MS;
  if (Date.now() - entry.timestamp > ttl) {
    memoryCache.delete(cacheKey);
    return undefined; // Expired
  }

  return entry.avatarUrl;
}

export function setCachedAvatar(sessionId: string, jid: string, avatarUrl: string | null) {
  const cacheKey = `${sessionId}:${jid}`;
  memoryCache.set(cacheKey, {
    avatarUrl,
    timestamp: Date.now(),
  });
  saveCacheToStorage();
}

const pendingFetches = new Set<string>();

export function useProfilePicture(sessionId?: string, jid?: string, initialUrl?: string | null) {
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(() => {
    if (!sessionId || !jid) return initialUrl;
    if (initialUrl) {
      setCachedAvatar(sessionId, jid, initialUrl);
      return initialUrl;
    }
    return getCachedAvatar(sessionId, jid);
  });

  useEffect(() => {
    if (!sessionId || !jid) return;

    if (initialUrl) {
      setCachedAvatar(sessionId, jid, initialUrl);
      setAvatarUrl(initialUrl);
      return;
    }

    const cached = getCachedAvatar(sessionId, jid);
    if (cached !== undefined) {
      setAvatarUrl(cached);
      return;
    }

    const fetchKey = `${sessionId}:${jid}`;
    if (pendingFetches.has(fetchKey)) return;

    pendingFetches.add(fetchKey);

    apiClient
      .getProfilePicture(sessionId, jid)
      .then((res) => {
        const url = res.avatarUrl || null;
        setCachedAvatar(sessionId, jid, url);
        setAvatarUrl(url);
      })
      .catch(() => {
        setCachedAvatar(sessionId, jid, null);
        setAvatarUrl(null);
      })
      .finally(() => {
        pendingFetches.delete(fetchKey);
      });
  }, [sessionId, jid, initialUrl]);

  return avatarUrl;
}
