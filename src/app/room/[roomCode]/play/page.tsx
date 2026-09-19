import type { Metadata } from "next";
import PlayPage from "./PlayPage";

export const metadata: Metadata = {
  title: "遊戲中",
  robots: { index: false, follow: false },
};

export default function Page({ params }: { params: { roomCode: string } }) {
  return <PlayPage roomCode={params.roomCode} />;
}
