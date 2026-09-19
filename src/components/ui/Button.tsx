import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "glass" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-white text-black hover:bg-white/90",
  glass: "glass text-white/80 hover:text-white",
  ghost: "bg-white/10 text-white hover:bg-white/15",
  danger: "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-8 py-4 text-base",
};

export function buttonClasses(variant: ButtonVariant = "ghost", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A real `<button>`. Always `type="button"` unless the caller says otherwise. */
export function Button({ variant = "ghost", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
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
export function LinkButton({ variant = "ghost", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
