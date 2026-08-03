export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function isPhoneNumberOrLid(str?: string | null): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  // Check if string is digits only, or starts with +/digits
  const cleaned = cleanPhoneNumber(trimmed);
  if (!cleaned) return false;
  // If the raw text is mostly digits or formatted phone (e.g. +91 94777 62699 or 229777243918580)
  return /^[+0-9\s()-]+$/.test(trimmed) || cleaned.length >= 10;
}

export function formatPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned || cleaned === '0') return '';

  // LIDs are usually 14-16 digits long. Don't format LIDs as phone numbers.
  if (cleaned.length > 13) {
    return '';
  }

  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }

  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }

  return `+${cleaned}`;
}

export function getAvatarColor(identifier?: string | null): string {
  const colors = [
    'bg-emerald-600 text-white',
    'bg-teal-600 text-white',
    'bg-indigo-600 text-white',
    'bg-violet-600 text-white',
    'bg-amber-600 text-white',
    'bg-rose-600 text-white',
    'bg-cyan-600 text-white',
    'bg-blue-600 text-white',
  ];
  const str = identifier || 'default';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(name?: string | null, fallback = ''): string {
  if (!name || !name.trim()) return fallback;
  const trimmed = name.trim();

  // If name is a raw phone number or LID digits (e.g. "+91 89109 98321" or "919477762699")
  if (isPhoneNumberOrLid(trimmed)) {
    const cleaned = cleanPhoneNumber(trimmed);
    if (cleaned.length >= 10) {
      const numOnly = cleaned.startsWith('91') && cleaned.length === 12 ? cleaned.slice(2) : cleaned;
      return numOnly.substring(0, 2);
    }
    return fallback;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

export function formatMessageTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

