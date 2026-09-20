"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  /** Show a transient message at the bottom of the screen. */
  toast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

/**
 * App-level transient feedback.
 *
 * Motivation: game action calls used to `catch { // Ignore }`, so a failed
 * write looked exactly like a successful one. Every action now either updates
 * the UI or says why it didn't. Toasts auto-dismiss and stack (max 3), sit in
 * a safe-area-aware bottom dock, and are announced via `role="status"`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string) => {
    const id = ++nextId.current;
    setItems((prev) => [...prev.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 dock-safe"
      >
        {items.map((item) => (
          <p
            key={item.id}
            role="status"
            className="glass-strong max-w-xs rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2.5 text-center text-sm font-medium text-red-200 shadow-lg animate-toast-in"
          >
            {item.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
