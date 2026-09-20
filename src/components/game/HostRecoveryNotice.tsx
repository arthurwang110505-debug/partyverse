"use client";

import { useEffect, useState } from "react";
import { HOST_STALE_MS } from "@/constants/room";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import { Button } from "@/components/ui/Button";

/** Independent clock: an absent host cannot trigger React renders for us. */
export function HostRecoveryNotice() {
  const { room, isHost, claimHost, connectionStatus } = useRoom();
  const { toast } = useToast();
  const [now, setNow] = useState(0);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!room || room.status !== "PLAYING") return null;
  const disconnected = connectionStatus === "disconnected" || connectionStatus === "reconnecting";
  const stale =
    !isHost &&
    (room.players[room.hostPlayerId]?.isConnected === false || now - (room.lastTickAt ?? now) > HOST_STALE_MS);
  if (!disconnected && !stale) return null;
  const takeOver = async () => {
    setPending(true);
    try {
      await claimHost();
      toast("已接管房主，遊戲繼續");
    } catch (error) {
      toast(error instanceof Error ? error.message : "接管失敗，請重試");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-center" role="status">
      <p className="text-sm text-amber-200">
        {disconnected ? "正在重新連線，請保留此頁面…" : "房主連線停滯，可以接管以繼續遊戲。"}
      </p>
      {stale && !disconnected && (
        <Button className="mt-2" size="sm" variant="ghost" loading={pending} onClick={() => void takeOver()}>
          由我接管房主
        </Button>
      )}
    </div>
  );
}
