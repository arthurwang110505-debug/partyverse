import HostPage from "./HostPage";
export default function Page({ params }: { params: { roomCode: string } }) {
  return <HostPage roomCode={params.roomCode} />;
}
