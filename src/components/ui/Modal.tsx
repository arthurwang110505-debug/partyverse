"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Visible heading — also labels the dialog. Provide either this or `label`. */
  title?: ReactNode;
  /** Accessible name when there is no visible heading. */
  label?: string;
  /** Use "alertdialog" for confirmations that the user must acknowledge. */
  role?: "dialog" | "alertdialog";
  /** Extra classes for the panel. */
  className?: string;
  children: ReactNode;
}

/**
 * One modal primitive for the whole app.
 *
 * Replaces the three hand-rolled overlay blocks in the lobby (and the pages
 * that copied them): Escape closes, clicking the backdrop closes, focus moves
 * into the panel on open and is kept inside with a minimal Tab trap, and the
 * background can't scroll. Rendered through a portal so `overflow`/`z-index`
 * on ancestors can't break it.
 */
export function Modal({ open, onClose, title, label, role = "dialog", className, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && active === last) {
        first.focus();
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-ink/95 p-3 py-6 sm:p-6"
      onMouseDown={(e) => {
        // Only the backdrop itself closes — clicks inside the panel must not.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={label}
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex={-1}
        className={cn(
          "glass-card max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl p-4 outline-none motion-safe:animate-toast-in sm:p-6",
          className,
        )}
      >
        {title && (
          <h2 id="modal-title" className="mb-4 text-lg font-bold">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
