"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function HostGameControls() {
  const { endRound, endGame, isHost } = useRoom();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<"restart" | "end" | null>(null);
  const [pending, setPending] = useState(false);
  const run = async () => {
    if (pending) return;
    setPending(true);
    try {
      await (confirm === "restart" ? endRound() : endGame());
      setConfirm(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "操作失敗，請再試一次");
    } finally {
      setPending(false);
    }
  };
  if (!isHost) return null;
  return (
    <>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="ghost" onClick={() => setConfirm("restart")}>
          重新開始整場
        </Button>
        <Button variant="danger" onClick={() => setConfirm("end")}>
          結束並結算
        </Button>
      </div>
      <Modal
        open={confirm !== null}
        onClose={() => {
          if (!pending) setConfirm(null);
        }}
        title={confirm === "restart" ? "確定重新開始整場？" : "提早結束遊戲？"}
        role="alertdialog"
      >
        <p className="mb-5 text-sm text-white/70">
          {confirm === "restart"
            ? "本場所有積分會歸零，所有在線玩家重新加入。房間代碼不變。"
            : "保留目前積分並前往結算，未完成的挑戰不會額外計分。"}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => setConfirm(null)}>
            取消
          </Button>
          <Button variant="danger" loading={pending} onClick={() => void run()}>
            確認{confirm === "restart" ? "重開" : "結算"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
