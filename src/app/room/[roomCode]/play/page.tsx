import PlayPage from "./PlayPage";
export default function Page({ params }: { params: { roomCode: string } }) {
  return <PlayPage roomCode={params.roomCode} />;
}
