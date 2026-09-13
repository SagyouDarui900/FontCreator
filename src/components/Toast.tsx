import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ThemeMode } from '../utils/theme';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  theme: ThemeMode;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss, theme }) => {
  if (toasts.length === 0) return null;
  const isLight = theme === 'light';

  return (
    <div className="fixed bottom-14 sm:bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success' || !toast.type;
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg border shadow-lg text-xs font-medium backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              isLight
                ? isError
                  ? 'bg-rose-50/95 border-rose-200 text-rose-900'
                  : isWarning
                  ? 'bg-amber-50/95 border-amber-200 text-amber-900'
                  : isSuccess
                  ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
                  : 'bg-white/95 border-stone-200 text-stone-900'
                : isError
                ? 'bg-rose-950/90 border-rose-800 text-rose-200'
                : isWarning
                ? 'bg-amber-950/90 border-amber-800 text-amber-200'
                : isSuccess
                ? 'bg-[#122319]/95 border-emerald-700 text-emerald-100'
                : 'bg-[#18231c]/95 border-[#2d4034] text-stone-200'
            }`}
          >
            {isError ? (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            ) : isWarning ? (
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            <span className="flex-1 leading-snug">{toast.text}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-0.5 rounded hover:opacity-75 shrink-0 text-stone-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
