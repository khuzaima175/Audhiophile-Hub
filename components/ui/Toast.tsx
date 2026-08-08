import React, { useEffect } from 'react';
import Led, { LedColor } from './Led';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'warn' | 'error' | 'info';
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.duration || 3500);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const ledColor: LedColor = {
    success: 'green' as const,
    warn: 'amber' as const,
    error: 'red' as const,
    info: 'teal' as const,
  }[toast.type || 'info'];

  return (
    <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
      <div className="panel px-4 py-3 rounded-xl border border-audio-border shadow-2xl flex items-start gap-3 max-w-sm bg-[#1A1410]">
        <Led color={ledColor} pulse size="md" className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-audio-text font-display tracking-tight">
            {toast.title}
          </div>
          {toast.description && (
            <div className="text-[11px] text-audio-muted font-sans mt-0.5 leading-snug">
              {toast.description}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-audio-muted hover:text-audio-text text-xs p-1 -mr-1 -mt-1 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default Toast;
