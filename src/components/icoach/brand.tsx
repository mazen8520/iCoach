import { Activity } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="brand-mark">
        <Activity size={18} strokeWidth={2.6} />
      </span>
      {!compact && (
        <span className="font-display text-xl font-extrabold tracking-normal">
          i<span className="text-primary">Coach</span>
        </span>
      )}
    </div>
  );
}
