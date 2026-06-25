"use client";

import { Loader2, Monitor, Smartphone } from "lucide-react";

export type AuditDevice = "mobile" | "desktop";

interface AuditDeviceToggleProps {
  value: AuditDevice;
  onChange: (device: AuditDevice) => void;
  disabled?: boolean;
  scanning?: AuditDevice | null;
  available?: Partial<Record<AuditDevice, boolean>>;
}

export function AuditDeviceToggle({
  value,
  onChange,
  disabled = false,
  scanning = null,
  available = {},
}: AuditDeviceToggleProps) {
  const options: {
    id: AuditDevice;
    label: string;
    short: string;
    icon: typeof Smartphone;
  }[] = [
    { id: "mobile", label: "Mobile", short: "Phone", icon: Smartphone },
    { id: "desktop", label: "Desktop", short: "Desktop", icon: Monitor },
  ];

  return (
    <div
      className="inline-flex flex-col gap-1"
      role="group"
      aria-label="Audit device type"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
        Device
      </span>
      <div className="inline-flex p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 shadow-inner">
        {options.map((opt) => {
          const active = value === opt.id;
          const isScanning = scanning === opt.id;
          const hasData = available[opt.id];
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled || isScanning}
              onClick={() => onChange(opt.id)}
              className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all min-w-[108px] justify-center ${
                active
                  ? "bg-white text-violet-700 shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {isScanning ? (
                <Loader2 size={16} className="animate-spin text-violet-600 shrink-0" />
              ) : (
                <Icon size={16} className={`shrink-0 ${active ? "text-violet-600" : ""}`} />
              )}
              <span className="hidden sm:inline">{opt.label}</span>
              <span className="sm:hidden">{opt.short}</span>
              {hasData && !isScanning && (
                <span
                  className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white ${
                    active ? "bg-emerald-500" : "bg-emerald-400/80"
                  }`}
                  title="Scanned"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
