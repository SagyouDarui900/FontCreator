import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ThemeMode, isLightTheme } from '../utils/theme';

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
  const isLight = isLightTheme(theme);

  return (
    <div className="fixed bottom-14 sm:bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 z-50 flex flex-col items-center sm:items-end space-y-1.5 w-auto max-w-[calc(100vw-24px)] sm:max-w-sm pointer-events-none pb-[max(env(safe-area-inset-bottom),0px)]">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success' || !toast.type;
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full sm:rounded-xl border shadow-md sm:shadow-lg text-[11px] sm:text-xs font-medium backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150 max-w-full ${
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
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 shrink-0" />
            ) : isWarning ? (
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 shrink-0" />
            )}
            <span className="leading-tight truncate max-w-[70vw] sm:max-w-none">{toast.text}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-0.5 rounded-full hover:opacity-75 shrink-0 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              title="閉じる"
            >
              <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
