import type { Metadata } from "next";
import HostPage from "./HostPage";

export const metadata: Metadata = {
  title: "遊戲大廳",
  robots: { index: false, follow: false },
};

export default function Page({ params }: { params: { roomCode: string } }) {
  return <HostPage roomCode={params.roomCode} />;
}
