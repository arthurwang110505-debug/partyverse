import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface FieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Extra class names for the input itself. */
  inputClassName?: string;
}

/**
 * Label + input wired together with `htmlFor`/`id`, plus an error slot that is
 * announced. The previous inputs had floating `<label>` elements with no `for`,
 * so clicking a label did nothing and screen readers read "edit text" with no
 * name.
 */
export function Field({ label, hint, error, inputClassName, className, ...props }: FieldProps) {
  const generatedId = useId();
  const id = props.name ? `field-${props.name}` : generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-white/60">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error ? errorId : undefined, hint ? hintId : undefined) || undefined}
        className={cn(
          "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white",
          "placeholder-white/30 transition-all",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          error && "border-red-500/40",
          inputClassName,
        )}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-xs text-white/40">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
