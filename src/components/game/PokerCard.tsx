import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-10 w-7 text-[10px] rounded-md",
  md: "h-14 w-10 text-sm rounded-lg",
  lg: "h-20 w-14 text-lg rounded-xl",
} as const;

/** A face-up playing card, or a face-down back when `hidden`. */
export function PokerCard({ card, hidden = false, size = "md" }: { card?: string; hidden?: boolean; size?: keyof typeof SIZES }) {
  if (hidden || !card) {
    return (
      <div
        className={cn(SIZES[size], "shrink-0 border-2 border-indigo-300/40 bg-gradient-to-br from-indigo-700 to-indigo-950 shadow")}
        aria-hidden="true"
      />
    );
  }
  const rank = card.length === 3 ? card.slice(0, 2) : card[0];
  const suit = card[card.length - 1];
  const red = suit === "♥" || suit === "♦";
  return (
    <div
      className={cn(
        SIZES[size],
        "flex shrink-0 flex-col items-center justify-center border-2 border-white/40 bg-white font-black shadow",
        red ? "text-red-600" : "text-slate-900",
      )}
      aria-label={`牌：${card}`}
    >
      <span className="leading-none">{rank}</span>
      <span className="leading-none">{suit}</span>
    </div>
  );
}
