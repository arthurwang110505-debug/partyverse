import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "glass" | "ghost" | "danger" | "accent";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex min-w-0 items-center justify-center gap-2 rounded-xl font-semibold transition-all " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-white text-black hover:bg-white/90",
  glass: "glass text-white/80 hover:text-white",
  ghost: "bg-white/10 text-white hover:bg-white/15",
  danger: "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20",
  /**
   * Game-themed call-to-action. The color comes from `--game-gradient` /
   * `--game-accent`, which the play/host shells (or any page) set as CSS
   * custom properties — so one variant renders red for 💣 and cyan for 🎆
   * without inline gradient styles at each call site.
   */
  accent: "text-white shadow-lg [background:var(--game-gradient,var(--game-accent,#a855f7))] hover:brightness-110",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3.5 text-sm sm:px-8 sm:py-4 sm:text-base",
  /** Square button for a single icon. Always pass `aria-label`. */
  icon: "h-10 w-10 p-0",
};

export function buttonClasses(variant: ButtonVariant = "ghost", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show a spinner and disable the button while an action is in flight. */
  loading?: boolean;
}

/** A real `<button>`. Always `type="button"` unless the caller says otherwise. */
export function Button({
  variant = "ghost",
  size = "md",
  loading = false,
  disabled,
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

/**
 * A link that *looks* like a button.
 *
 * The old code wrapped a `<button>` in a `<Link>`, which nests one interactive
 * element inside another — invalid HTML, unpredictable tab order, and announced
 * twice by screen readers.
 */
export function LinkButton({ variant = "ghost", size = "md", className, style, ...props }: LinkButtonProps) {
  const accentStyle: CSSProperties | undefined =
    variant === "accent" ? { background: "var(--game-gradient, var(--game-accent, #a855f7))", ...style } : style;
  return (
    <Link
      className={buttonClasses(variant, size, className)}
      style={accentStyle}
      {...props}
    />
  );
}
