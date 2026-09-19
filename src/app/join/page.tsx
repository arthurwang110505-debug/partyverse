import type { Metadata } from "next";
import JoinClient from "./JoinClient";

export const metadata: Metadata = {
  title: "加入房間",
  description: "輸入朋友給你的五位數房間代碼，填個名字就能加入派對，不用下載也不用註冊。",
  openGraph: {
    title: "加入房間 — PARTYVERSE",
    description: "輸入房間代碼，立刻加入朋友的派對。",
  },
};

export default function JoinPage() {
  return <JoinClient />;
}
