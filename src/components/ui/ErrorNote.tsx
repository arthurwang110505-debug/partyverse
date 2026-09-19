import { cn } from "@/lib/utils";

/**
 * Inline error banner. `role="alert"` makes it interrupt a screen reader the
 * moment it appears — the old banners were silent `<div>`s.
 */
export function ErrorNote({ children, className }: { children: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn("rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400", className)}
    >
      {children}
    </p>
  );
}
