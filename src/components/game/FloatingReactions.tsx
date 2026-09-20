"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoom } from "@/providers/RoomContext";
import type { ReactionItem } from "@/types";

interface ActiveReaction extends ReactionItem {
  randomX: number;
}

export function FloatingReactions() {
  const { room } = useRoom();
  const [activeList, setActiveList] = useState<ActiveReaction[]>([]);

  useEffect(() => {
    const reactions = room?.reactions;
    if (!reactions) return;

    const items = Object.values(reactions);
    if (items.length === 0) return;

    setActiveList((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const newItems = items
        .filter((item) => !existingIds.has(item.id))
        .map((item) => ({
          ...item,
          randomX: 15 + Math.random() * 70, // percent across screen (15% to 85%)
        }));

      if (newItems.length === 0) return prev;
      return [...prev, ...newItems].slice(-15); // keep max 15 active
    });
  }, [room?.reactions]);

  const handleComplete = (id: string) => {
    setActiveList((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {activeList.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: "90vh", x: `${item.randomX}vw`, scale: 0.5 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: ["80vh", "35vh", "15vh"],
              scale: [0.5, 1.3, 1],
              rotate: [0, (item.randomX % 2 === 0 ? 1 : -1) * 15, 0],
            }}
            transition={{
              duration: 2.8,
              ease: "easeOut",
              times: [0, 0.15, 0.75, 1],
            }}
            onAnimationComplete={() => handleComplete(item.id)}
            className="absolute flex flex-col items-center"
          >
            <span className="text-4xl drop-shadow-lg select-none filter">{item.emoji}</span>
            <span className="mt-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm shadow">
              {item.nickname}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
