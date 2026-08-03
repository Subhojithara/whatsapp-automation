import { SessionStatus } from "@/types/session";
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, XCircle, Ban } from "lucide-react";

interface StatusBadgeProps {
  status: SessionStatus;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  switch (status) {
    case "READY":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Ready
        </span>
      );

    case "STARTING":
    case "CONNECTING":
    case "AUTHENTICATING":
    case "RECONNECTING":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 ${className}`}
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
      );

    case "QR_READY":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 ${className}`}
        >
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          QR Ready
        </span>
      );

    case "STOPPED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border/60 ${className}`}
        >
          <Ban className="w-3.5 h-3.5" />
          Stopped
        </span>
      );

    case "FAILED":
    case "DISCONNECTED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 ${className}`}
        >
          <XCircle className="w-3.5 h-3.5" />
          {status === "FAILED" ? "Failed" : "Disconnected"}
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border ${className}`}
        >
          <Clock className="w-3.5 h-3.5" />
          Created
        </span>
      );
  }
}
