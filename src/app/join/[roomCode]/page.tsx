import type { Metadata } from "next";
import JoinRoomClient from "./JoinRoomClient";

export const metadata: Metadata = {
  title: "加入房間",
  description: "輸入暱稱，立刻加入這個派對房間。",
  // The code is in the URL, so there is nothing worth indexing here.
  robots: { index: false, follow: false },
};

export default function Page({ params }: { params: { roomCode: string } }) {
  return <JoinRoomClient roomCode={params.roomCode} />;
}
