import { Suspense } from "react";
import CreateRoomClient from "./CreateRoomClient";

interface Props {
  params: { game: string };
}

export default function CreateRoomPage({ params }: Props) {
  return <CreateRoomClient gameId={params.game} />;
}
