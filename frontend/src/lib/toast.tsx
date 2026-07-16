import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  meta?: string;
}

interface ToastContextValue {
  push: (t: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
  success: (title: string, message?: string) => number;
  error: (title: string, message?: string, meta?: string) => number;
  info: (title: string, message?: string) => number;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, string> = {
  success: 'M20 6 9 17l-5-5',
  error: 'M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  info: 'M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
};

const ACCENT: Record<ToastKind, string> = {
  success: 'text-emerald-400',
  error: 'text-rose-400',
  info: 'text-brand-300',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++seq.current;
      setToasts((prev) => [...prev, { ...t, id }].slice(-4));
      timers.current[id] = setTimeout(() => dismiss(id), t.kind === 'error' ? 7000 : 4200);
      return id;
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      dismiss,
      success: (title, message) => push({ kind: 'success', title, message }),
      error: (title, message, meta) => push({ kind: 'error', title, message, meta }),
      info: (title, message) => push({ kind: 'info', title, message }),
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-slide-in items-start gap-3 rounded-xl border border-line bg-surface/95 p-3.5 shadow-card-lg backdrop-blur"
          >
            <svg
              className={`mt-0.5 h-5 w-5 shrink-0 ${ACCENT[t.kind]}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={ICONS[t.kind]} />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-fg">{t.title}</div>
              {t.message && <div className="mt-0.5 break-words text-xs text-muted">{t.message}</div>}
              {t.meta && <div className="mt-1 font-mono text-[10px] text-subtle">{t.meta}</div>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="btn-subtle -m-1 rounded-md p-1"
              aria-label="Dismiss notification"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
