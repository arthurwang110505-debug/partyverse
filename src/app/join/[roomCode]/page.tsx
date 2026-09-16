import JoinRoomClient from "./JoinRoomClient";
export default function Page({ params }: { params: { roomCode: string } }) {
  return <JoinRoomClient roomCode={params.roomCode} />;
}
